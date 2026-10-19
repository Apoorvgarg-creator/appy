package hub

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

const maxSnapshotBytes = 64 << 20

type storedResponse struct {
	Fingerprint string          `json:"fingerprint"`
	Status      int             `json:"status"`
	Body        json.RawMessage `json:"body"`
}
type snapshot struct {
	Version   int                       `json:"version"`
	Admission string                    `json:"admission"`
	Tasks     []Task                    `json:"tasks"`
	Keys      map[string]storedResponse `json:"keys"`
}
type Store struct {
	mu            sync.Mutex
	state         snapshot
	dir           string
	lock          *os.File
	now           func() time.Time
	persist       func(snapshot) error
	closed        bool
	poisoned      bool
	storageFailed bool
}

// OpenStore obtains a process lock before loading a restrictive, local snapshot.
// A malformed snapshot fails closed. Recovery never resumes interrupted work.
func OpenStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	info, err := os.Lstat(dir)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0077 != 0 {
		return nil, errors.New("data directory must be a real directory with permissions 0700")
	}
	lockPath := filepath.Join(dir, "process.lock")
	if info, err := os.Lstat(lockPath); err == nil && (!info.Mode().IsRegular() || info.Mode().Perm()&0077 != 0) {
		return nil, errors.New("unsafe process lock file")
	} else if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	fd, err := syscall.Open(lockPath, syscall.O_RDWR|syscall.O_CREAT|syscall.O_NOFOLLOW, 0600)
	if err != nil {
		return nil, err
	}
	lock := os.NewFile(uintptr(fd), lockPath)
	if err := syscall.Flock(fd, syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		lock.Close()
		return nil, errors.New("data directory is already in use")
	}
	s := &Store{dir: dir, lock: lock, now: func() time.Time { return time.Now().UTC() }}
	s.persist = s.persistFile
	s.state = snapshot{Version: 1, Admission: "open", Tasks: []Task{}, Keys: map[string]storedResponse{}}
	fail := func(err error) (*Store, error) { s.Close(); return nil, err }
	path := filepath.Join(dir, "state.json")
	info, err = os.Lstat(path)
	if os.IsNotExist(err) {
		if err := s.persist(s.state); err != nil {
			return fail(err)
		}
		return s, nil
	}
	if err != nil {
		return fail(err)
	}
	if !info.Mode().IsRegular() || info.Mode().Perm()&0077 != 0 || info.Size() > maxSnapshotBytes {
		return fail(errors.New("unsafe snapshot type, permissions, or size"))
	}
	fd, err = syscall.Open(path, syscall.O_RDONLY|syscall.O_NOFOLLOW, 0)
	if err != nil {
		return fail(err)
	}
	f := os.NewFile(uintptr(fd), path)
	body, err := io.ReadAll(io.LimitReader(f, maxSnapshotBytes+1))
	f.Close()
	if err != nil {
		return fail(err)
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	var loaded snapshot
	if err := dec.Decode(&loaded); err != nil {
		return fail(fmt.Errorf("invalid snapshot: %w", err))
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return fail(errors.New("invalid trailing snapshot data"))
	}
	if err := validateSnapshot(loaded); err != nil {
		return fail(err)
	}
	s.state = loaded
	recovered := clone(s.state)
	changed := false
	for i := range recovered.Tasks {
		t := &recovered.Tasks[i]
		switch t.Status {
		case "queued", "running":
			t.Status = "paused"
			s.event(t, "recovery", "Interrupted by restart. Resume explicitly to continue.")
			changed = true
		case "waiting_approval":
			t.Approval.ExpiresAt = s.now().Add(-time.Second)
			s.event(t, "recovery", "Approval expired on restart. Review a fresh request.")
			changed = true
		}
	}
	if changed {
		if err := s.persist(recovered); err != nil {
			return fail(err)
		}
		s.state = recovered
	}
	return s, nil
}

func validateSnapshot(st snapshot) error {
	if st.Version != 1 || (st.Admission != "open" && st.Admission != "stopped") || st.Tasks == nil || st.Keys == nil || len(st.Tasks) > 1000 || len(st.Keys) > 10000 {
		return errors.New("invalid snapshot metadata")
	}
	ids := map[string]bool{}
	for _, t := range st.Tasks {
		if !idPattern.MatchString(t.ID) || ids[t.ID] || t.Revision < 1 || t.Goal == "" || t.Recipe != "repository_summary" || t.Events == nil || t.CreatedAt.IsZero() || t.UpdatedAt.IsZero() || t.Progress < 0 || t.Progress > 100 {
			return errors.New("invalid persisted task")
		}
		ids[t.ID] = true
		switch t.Status {
		case "draft", "queued", "running", "paused", "cancelled", "failed":
		case "waiting_approval":
			if t.Approval == nil {
				return errors.New("missing persisted approval")
			}
		case "succeeded":
			if t.Artifact == nil {
				return errors.New("missing persisted artifact")
			}
		default:
			return errors.New("unknown persisted status")
		}
		if t.Approval != nil && (!idPattern.MatchString(t.Approval.ID) || t.Approval.SHA256 != digest(t.Approval.Preview) || t.Approval.Action != "save_fixture_report" || t.Approval.Target != "Local task journal" || t.Approval.ExpiresAt.IsZero()) {
			return errors.New("invalid persisted approval")
		}
		if t.Artifact != nil && (t.Status != "succeeded" || t.Artifact.SHA256 != digest(t.Artifact.Content) || t.Artifact.MediaType != "text/markdown" || t.Artifact.Filename != "example-repository-report.md") {
			return errors.New("invalid persisted artifact")
		}
	}
	for key, response := range st.Keys {
		if !keyPattern.MatchString(key) || len(response.Fingerprint) != 64 || response.Status < 200 || response.Status > 599 || !json.Valid(response.Body) {
			return errors.New("invalid persisted operation")
		}
	}
	return nil
}

func (s *Store) persistFile(st snapshot) error {
	body, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	if len(body) > maxSnapshotBytes {
		return errors.New("snapshot storage limit reached")
	}
	tmp, err := os.CreateTemp(s.dir, ".state-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err = tmp.Chmod(0600); err == nil {
		_, err = tmp.Write(append(body, '\n'))
	}
	if err == nil {
		err = tmp.Sync()
	}
	closeErr := tmp.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	if err = os.Rename(name, filepath.Join(s.dir, "state.json")); err != nil {
		return err
	}
	dir, err := os.Open(s.dir)
	if err == nil {
		err = dir.Sync()
		dir.Close()
	}
	// A failed directory fsync leaves publication uncertain: block further writes
	// until restart rather than advancing memory or claiming an acknowledged save.
	if err != nil {
		s.poisoned = true
	}
	return err
}
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true
	if s.lock == nil {
		return nil
	}
	return s.lock.Close()
}
func clone(st snapshot) snapshot {
	body, _ := json.Marshal(st)
	var out snapshot
	_ = json.Unmarshal(body, &out)
	return out
}
func newID(prefix string) string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return prefix + hex.EncodeToString(b[:])
}
func digest(text string) string {
	hash := sha256.Sum256([]byte(text))
	return hex.EncodeToString(hash[:])
}
func (s *Store) event(t *Task, kind, message string) {
	t.Revision++
	t.UpdatedAt = s.now()
	t.Summary = message
	t.Events = append(t.Events, Event{ID: newID("event_"), At: t.UpdatedAt, Kind: kind, Message: message})
}
func workspace(st snapshot) Workspace {
	return Workspace{Mode: "fixture", Admission: st.Admission, Tasks: st.Tasks, Worker: Worker{ID: "fixture", Name: "Local fixture runner", Kind: "fixture", State: "ready", Description: "Analyzes only the bundled example; no device, shell, model, or network access."}}
}
func (s *Store) Workspace() Workspace {
	s.mu.Lock()
	defer s.mu.Unlock()
	return workspace(clone(s.state))
}
func find(st *snapshot, id string) *Task {
	for i := range st.Tasks {
		if st.Tasks[i].ID == id {
			return &st.Tasks[i]
		}
	}
	return nil
}
func (s *Store) Task(id string) (Task, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := clone(s.state)
	t := find(&st, id)
	if t == nil {
		return Task{}, false
	}
	return *t, true
}

// Tick persists each state transition before publishing it to readers. The same
// mutex serializes cancellation, approval and runner steps, so cancelled work
// cannot publish a later result.
func (s *Store) Tick() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.poisoned {
		return errors.New("store unavailable")
	}
	if s.state.Admission != "open" {
		return nil
	}
	next := clone(s.state)
	changed := false
	for i := range next.Tasks {
		t := &next.Tasks[i]
		switch {
		case t.Status == "queued":
			t.Status = "running"
			if t.Progress < 15 {
				t.Progress = 15
			}
			s.event(t, "running", "Inspecting the bundled example files.")
			changed = true
		case t.Status == "running" && t.Progress < 65:
			t.Progress = 65
			s.event(t, "progress", "File inventory complete. Composing the example report.")
			changed = true
		case t.Status == "running":
			report := fixtureReport()
			t.Progress = 90
			t.Status = "waiting_approval"
			t.Approval = &Approval{ID: newID("approval_"), ExpiresAt: s.now().Add(5 * time.Minute), SHA256: digest(report), Action: "save_fixture_report", Target: "Local task journal", Preview: report}
			s.event(t, "approval_requested", "Review the exact report before making it downloadable.")
			changed = true
		}
	}
	if !changed {
		return nil
	}
	if err := s.persist(next); err != nil {
		s.storageFailed = true
		return err
	}
	s.storageFailed = false
	s.state = next
	return nil
}
func (s *Store) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Transient storage failures remain visible to API readers; retrying
			// never advances unpersisted work. Ambiguous publication stays poisoned.
			_ = s.Tick()
		}
	}
}

func errResponse(status int, code, message string) (int, any) {
	return status, errorBody{Error: apiError{Code: code, Message: message}}
}

func (s *Store) mutate(key, fingerprint string, operation func(*snapshot) (int, any)) (int, []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	encodeErr := func(status int, code, message string) (int, []byte) {
		_, v := errResponse(status, code, message)
		b, _ := json.Marshal(v)
		return status, b
	}
	if s.closed || s.poisoned {
		return encodeErr(503, "store_unavailable", "Storage is unavailable. Restart after resolving the storage error.")
	}
	if cached, ok := s.state.Keys[key]; ok {
		if cached.Fingerprint != fingerprint {
			return encodeErr(409, "idempotency_conflict", "This operation key was already used for a different request.")
		}
		return cached.Status, append([]byte(nil), cached.Body...)
	}
	if len(s.state.Keys) >= 10000 {
		return encodeErr(503, "storage_limit", "This development journal has reached its operation limit.")
	}
	next := clone(s.state)
	status, value := operation(&next)
	body, _ := json.Marshal(value)
	next.Keys[key] = storedResponse{Fingerprint: fingerprint, Status: status, Body: body}
	if err := s.persist(next); err != nil {
		s.storageFailed = true
		return encodeErr(503, "storage_unavailable", "The change could not be saved. No operation was acknowledged; retry with the same key.")
	}
	s.storageFailed = false
	s.state = next
	return status, body
}

func (s *Store) create(st *snapshot, req CreateTask) (int, any) {
	if st.Admission != "open" {
		return errResponse(409, "admission_stopped", "Enable new tasks before creating a draft.")
	}
	if len(st.Tasks) >= 1000 {
		return errResponse(503, "storage_limit", "This development journal has reached its task limit.")
	}
	now := s.now()
	t := Task{ID: newID("task_"), Goal: req.Goal, Recipe: req.Recipe, Status: "draft", CreatedAt: now, UpdatedAt: now, Plan: fixedPlan(), Events: []Event{}}
	s.event(&t, "created", "Review the fixed example plan before starting.")
	st.Tasks = append(st.Tasks, t)
	return 201, t
}
func terminal(status string) bool {
	return status == "succeeded" || status == "cancelled" || status == "failed"
}
func (s *Store) action(st *snapshot, id string, req TaskAction) (int, any) {
	t := find(st, id)
	if t == nil {
		return errResponse(404, "not_found", "Task not found.")
	}
	if t.Revision != req.ExpectedRevision {
		return errResponse(409, "revision_conflict", "The task changed. Refresh it before trying again.")
	}
	bad := func() (int, any) {
		return errResponse(409, "invalid_transition", "That action is unavailable in the current task state.")
	}
	switch req.Action {
	case "start":
		if t.Status != "draft" || st.Admission != "open" {
			return bad()
		}
		t.Status = "queued"
		s.event(t, "queued", "Queued for the local fixture runner.")
	case "pause":
		if t.Status != "queued" && t.Status != "running" {
			return bad()
		}
		t.Status = "paused"
		s.event(t, "paused", "Paused. Resume explicitly when ready.")
	case "resume":
		if t.Status != "paused" || st.Admission != "open" {
			return bad()
		}
		t.Status = "queued"
		s.event(t, "resumed", "Queued to continue the example analysis.")
	case "cancel":
		if terminal(t.Status) {
			return bad()
		}
		t.Status = "cancelled"
		t.Approval = nil
		s.event(t, "cancelled", "Cancelled. No downloadable result was created.")
	case "approve", "deny":
		if t.Status != "waiting_approval" || t.Approval == nil {
			return bad()
		}
		if req.ApprovalID != t.Approval.ID {
			return errResponse(409, "approval_conflict", "The approval changed. Review the current request.")
		}
		if req.Action == "approve" {
			if !s.now().Before(t.Approval.ExpiresAt) {
				return errResponse(409, "approval_expired", "This approval expired. Request a fresh review.")
			}
			if digest(t.Approval.Preview) != t.Approval.SHA256 {
				return errResponse(409, "approval_conflict", "Report digest mismatch.")
			}
			t.Artifact = &Artifact{Filename: "example-repository-report.md", MediaType: "text/markdown", Content: t.Approval.Preview, SHA256: t.Approval.SHA256}
			t.Status = "succeeded"
			t.Progress = 100
			s.event(t, "approved", "Report approved. Download is ready.")
		} else {
			t.Status = "cancelled"
			s.event(t, "denied", "Report approval denied. No downloadable result was created.")
		}
		t.Approval = nil
	case "refresh_approval":
		if t.Status != "waiting_approval" || t.Approval == nil {
			return bad()
		}
		t.Approval.ID = newID("approval_")
		t.Approval.ExpiresAt = s.now().Add(5 * time.Minute)
		s.event(t, "approval_refreshed", "Fresh approval requested for the same report.")
	default:
		return errResponse(400, "invalid_action", "Unknown task action.")
	}
	return 200, *t
}
func (s *Store) control(st *snapshot, req ControlAction) (int, any) {
	if req.Action == "enable_new_tasks" {
		st.Admission = "open"
	} else {
		st.Admission = "stopped"
		for i := range st.Tasks {
			t := &st.Tasks[i]
			if !terminal(t.Status) {
				t.Status = "cancelled"
				t.Approval = nil
				s.event(t, "stopped", "Cancelled by Stop all. New tasks are disabled.")
			}
		}
	}
	return 200, workspace(*st)
}

// Ready reports storage health without exposing local paths or filesystem errors.
func (s *Store) Ready() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.closed && !s.poisoned && !s.storageFailed
}
