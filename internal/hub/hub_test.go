package hub

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

const testHost = "127.0.0.1:8787"
const createBody = `{"goal":"Summarize the example","recipe":"repository_summary"}`

func testStore(t *testing.T) *Store {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "journal")
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}
func testHandler(t *testing.T, s *Store) http.Handler {
	t.Helper()
	h, err := NewHandler(s, testHost, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return h
}
func request(h http.Handler, method, path, body, key string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://"+testHost+path, strings.NewReader(body))
	if method == "POST" {
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Idempotency-Key", key)
		r.Header.Set("Origin", "http://"+testHost)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
func decodeTask(t *testing.T, w *httptest.ResponseRecorder, want int) Task {
	t.Helper()
	if w.Code != want {
		t.Fatalf("status %d, want %d: %s", w.Code, want, w.Body.String())
	}
	var task Task
	if err := json.Unmarshal(w.Body.Bytes(), &task); err != nil {
		t.Fatal(err)
	}
	return task
}
func act(t *testing.T, h http.Handler, task Task, action, key string) Task {
	t.Helper()
	body, _ := json.Marshal(TaskAction{Action: action, ExpectedRevision: task.Revision, ApprovalID: func() string {
		if task.Approval != nil {
			return task.Approval.ID
		}
		return ""
	}()})
	return decodeTask(t, request(h, "POST", "/api/v1/tasks/"+task.ID+"/actions", string(body), key), 200)
}
func awaiting(t *testing.T, s *Store, h http.Handler, key string) Task {
	t.Helper()
	task := decodeTask(t, request(h, "POST", "/api/v1/tasks", createBody, key+"_create"), 201)
	task = act(t, h, task, "start", key+"_start")
	for range 3 {
		if err := s.Tick(); err != nil {
			t.Fatal(err)
		}
	}
	task, _ = s.Task(task.ID)
	if task.Status != "waiting_approval" {
		t.Fatal(task.Status)
	}
	return task
}

func TestApprovalPublishesExactDurableArtifact(t *testing.T) {
	s := testStore(t)
	h := testHandler(t, s)
	task := awaiting(t, s, h, "artifact")
	if task.Artifact != nil {
		t.Fatal("artifact published before approval")
	}
	if w := request(h, "GET", "/api/v1/tasks/"+task.ID+"/artifact", "", ""); w.Code != 409 {
		t.Fatal(w.Code)
	}
	preview := task.Approval.Preview
	sha := task.Approval.SHA256
	task = act(t, h, task, "approve", "approve_artifact")
	if task.Status != "succeeded" || task.Artifact.Content != preview || task.Artifact.SHA256 != sha || digest(preview) != sha {
		t.Fatal("approval did not bind exact preview")
	}
	w := request(h, "GET", "/api/v1/tasks/"+task.ID+"/artifact", "", "")
	if w.Code != 200 || w.Body.String() != preview || !strings.Contains(w.Header().Get("Content-Disposition"), "attachment") {
		t.Fatal("download mismatch")
	}
	for range 3 {
		_ = s.Tick()
	}
	if got, _ := s.Task(task.ID); got.Revision != task.Revision {
		t.Fatal("runner modified terminal task")
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := OpenStore(s.dir)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	got, _ := reopened.Task(task.ID)
	if got.Artifact.Content != preview {
		t.Fatal("result lost after restart")
	}
}

func TestIdempotencyAndRevisionAcrossRestart(t *testing.T) {
	s := testStore(t)
	h := testHandler(t, s)
	first := request(h, "POST", "/api/v1/tasks", createBody, "create_operation")
	task := decodeTask(t, first, 201)
	if replay := request(h, "POST", "/api/v1/tasks", createBody, "create_operation"); replay.Code != 201 || !bytes.Equal(first.Body.Bytes(), replay.Body.Bytes()) {
		t.Fatal("not exact replay")
	}
	if conflict := request(h, "POST", "/api/v1/tasks", strings.Replace(createBody, "example", "fixture", 1), "create_operation"); conflict.Code != 409 {
		t.Fatal(conflict.Code)
	}
	started := act(t, h, task, "start", "start_operation")
	stale := fmt.Sprintf(`{"action":"cancel","expected_revision":%d}`, task.Revision)
	if got := request(h, "POST", "/api/v1/tasks/"+task.ID+"/actions", stale, "stale_operation"); got.Code != 409 {
		t.Fatal(got.Code)
	}
	if current, _ := s.Task(task.ID); current.Revision != started.Revision {
		t.Fatal("stale request changed task")
	}
	s.Close()
	reopened, err := OpenStore(s.dir)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	h = testHandler(t, reopened)
	if replay := request(h, "POST", "/api/v1/tasks", createBody, "create_operation"); !bytes.Equal(first.Body.Bytes(), replay.Body.Bytes()) {
		t.Fatal("restart lost exact replay")
	}
	if got, _ := reopened.Task(task.ID); got.Status != "paused" {
		t.Fatal("restart resumed task", got.Status)
	}
}

func TestRestartExpiresApprovalAndRequiresFreshReview(t *testing.T) {
	s := testStore(t)
	h := testHandler(t, s)
	original := awaiting(t, s, h, "restart")
	s.Close()
	reopened, err := OpenStore(s.dir)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	h = testHandler(t, reopened)
	task, _ := reopened.Task(original.ID)
	if task.Status != "waiting_approval" || !task.Approval.ExpiresAt.Before(time.Now()) {
		t.Fatal("restart did not expire approval")
	}
	body, _ := json.Marshal(TaskAction{Action: "approve", ExpectedRevision: task.Revision, ApprovalID: task.Approval.ID})
	if got := request(h, "POST", "/api/v1/tasks/"+task.ID+"/actions", string(body), "expired_approval"); got.Code != 409 || !strings.Contains(got.Body.String(), "approval_expired") {
		t.Fatal(got.Body.String())
	}
	task = act(t, h, task, "refresh_approval", "refresh_approval")
	if task.Approval.ID == original.Approval.ID || task.Approval.SHA256 != original.Approval.SHA256 || task.Approval.Preview != original.Approval.Preview {
		t.Fatal("refresh failed to replace identity or changed report")
	}
	body, _ = json.Marshal(TaskAction{Action: "approve", ExpectedRevision: task.Revision, ApprovalID: original.Approval.ID})
	if got := request(h, "POST", "/api/v1/tasks/"+task.ID+"/actions", string(body), "old_approval_id"); got.Code != 409 {
		t.Fatal(got.Code)
	}
	task = act(t, h, task, "approve", "new_approval_id")
	if task.Status != "succeeded" {
		t.Fatal(task.Status)
	}
}

func TestPauseResumeDenyAndGlobalStop(t *testing.T) {
	s := testStore(t)
	h := testHandler(t, s)
	task := decodeTask(t, request(h, "POST", "/api/v1/tasks", createBody, "pause_create"), 201)
	task = act(t, h, task, "start", "pause_start")
	_ = s.Tick()
	task, _ = s.Task(task.ID)
	task = act(t, h, task, "pause", "pause_pause")
	revision := task.Revision
	_ = s.Tick()
	task, _ = s.Task(task.ID)
	if task.Revision != revision {
		t.Fatal("paused task advanced")
	}
	task = act(t, h, task, "resume", "pause_resume")
	_ = s.Tick()
	_ = s.Tick()
	_ = s.Tick()
	task, _ = s.Task(task.ID)
	task = act(t, h, task, "deny", "pause_deny")
	if task.Artifact != nil || task.Status != "cancelled" {
		t.Fatal("denied report published")
	}
	draft := decodeTask(t, request(h, "POST", "/api/v1/tasks", createBody, "stop_create"), 201)
	if w := request(h, "POST", "/api/v1/control", `{"action":"stop_all"}`, "stop_global"); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	_ = s.Tick()
	got, _ := s.Task(draft.ID)
	if got.Status != "cancelled" {
		t.Fatal("stop did not cancel draft")
	}
	if w := request(h, "POST", "/api/v1/tasks", createBody, "stopped_create"); w.Code != 409 {
		t.Fatal("admission remained open")
	}
	if w := request(h, "POST", "/api/v1/control", `{"action":"enable_new_tasks"}`, "enable_global"); w.Code != 200 {
		t.Fatal(w.Code)
	}
	_ = s.Tick()
	got, _ = s.Task(draft.ID)
	if got.Status != "cancelled" {
		t.Fatal("enable revived cancelled task")
	}
}

func TestFailedPersistenceDoesNotAdvanceMemoryOrKeys(t *testing.T) {
	s := testStore(t)
	h := testHandler(t, s)
	actual := s.persist
	s.persist = func(snapshot) error { return errors.New("injected disk failure") }
	w := request(h, "POST", "/api/v1/tasks", createBody, "failed_creation")
	if w.Code != 503 || len(s.Workspace().Tasks) != 0 || len(s.state.Keys) != 0 {
		t.Fatal("failed persistence advanced state")
	}
	if get := request(h, "GET", "/api/v1/workspace", "", ""); get.Code != 503 {
		t.Fatal("storage failure hidden from readers")
	}
	s.persist = actual
	task := decodeTask(t, request(h, "POST", "/api/v1/tasks", createBody, "failed_creation"), 201)
	task = act(t, h, task, "start", "failed_start")
	revision := task.Revision
	s.persist = func(snapshot) error { return errors.New("injected tick failure") }
	if s.Tick() == nil {
		t.Fatal("expected tick failure")
	}
	task, _ = s.Task(task.ID)
	if task.Status != "queued" || task.Revision != revision {
		t.Fatal("failed tick advanced task")
	}
	s.persist = actual
	if err := s.Tick(); err != nil || !s.Ready() {
		t.Fatal("retry did not recover", err)
	}
}

func TestCancellationRaceCannotPublishResult(t *testing.T) {
	s := testStore(t)
	h := testHandler(t, s)
	for i := range 20 {
		key := fmt.Sprintf("race_%02d", i)
		task := decodeTask(t, request(h, "POST", "/api/v1/tasks", createBody, key+"_create"), 201)
		task = act(t, h, task, "start", key+"_start")
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			for range 4 {
				_ = s.Tick()
			}
		}()
		go func() {
			defer wg.Done()
			for attempt := range 8 {
				current, _ := s.Task(task.ID)
				body, _ := json.Marshal(TaskAction{Action: "cancel", ExpectedRevision: current.Revision})
				w := request(h, "POST", "/api/v1/tasks/"+task.ID+"/actions", string(body), fmt.Sprintf("%s_cancel_%d", key, attempt))
				if w.Code == 200 {
					return
				}
				if w.Code != 409 {
					t.Errorf("cancel: %d", w.Code)
					return
				}
			}
			t.Error("cancellation retry exhausted")
		}()
		wg.Wait()
		_ = s.Tick()
		current, _ := s.Task(task.ID)
		if current.Status != "cancelled" || current.Artifact != nil {
			t.Fatal("cancelled task published result", current.Status)
		}
	}
}

func TestStrictInputAndRequestGuards(t *testing.T) {
	s := testStore(t)
	h := testHandler(t, s)
	for i, body := range []string{`null`, `[]`, `{}`, `{"goal":null,"recipe":"repository_summary"}`, `{"Goal":"a","recipe":"repository_summary"}`, `{"goal":"a","goal":"b","recipe":"repository_summary"}`, `{"goal":"a","recipe":"repository_summary","command":"whoami"}`, createBody + ` {}`, `{"goal":"a","recipe":"shell"}`, `{"goal":"  ","recipe":"repository_summary"}`, `{"goal":"` + strings.Repeat("a", 301) + `","recipe":"repository_summary"}`, string([]byte{'{', '"', 'g', 'o', 'a', 'l', '"', ':', '"', 0xff, '"', '}'})} {
		w := request(h, "POST", "/api/v1/tasks", body, fmt.Sprintf("strict_body_%d", i))
		if w.Code != 400 {
			t.Errorf("body %d: status %d", i, w.Code)
		}
	}
	tests := []struct {
		name, header, value string
		want                int
	}{{"foreign host", "Host", "evil.example", 403}, {"foreign origin", "Origin", "https://evil.example", 403}, {"null origin", "Origin", "null", 403}, {"cross site", "Sec-Fetch-Site", "cross-site", 403}, {"plain body", "Content-Type", "text/plain", 415}, {"invalid key", "Idempotency-Key", "bad", 400}}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "http://"+testHost+"/api/v1/tasks", strings.NewReader(createBody))
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Idempotency-Key", "guard_request")
			if test.header == "Host" {
				r.Host = test.value
			} else {
				r.Header.Set(test.header, test.value)
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != test.want {
				t.Fatal(w.Code, w.Body.String())
			}
			if w.Header().Get("Content-Security-Policy") == "" || w.Header().Get("Access-Control-Allow-Origin") != "" {
				t.Fatal("missing defense headers or CORS allowed")
			}
		})
	}
	if w := request(h, "POST", "/api/v1/tasks", strings.Repeat(" ", 16385), "oversized_body"); w.Code != 413 {
		t.Fatal(w.Code)
	}
	if len(s.Workspace().Tasks) != 0 {
		t.Fatal("invalid input created work")
	}
}

func TestStaticServingConfinesAssetsAndRejectsTraversal(t *testing.T) {
	s := testStore(t)
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<p>Appy</p>"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "state.json"), []byte("private"), 0600); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "secret.js")
	_ = os.WriteFile(outside, []byte("private"), 0600)
	_ = os.Symlink(outside, filepath.Join(dir, "escape.js"))
	h, err := NewHandler(s, testHost, dir)
	if err != nil {
		t.Fatal(err)
	}
	if w := request(h, "GET", "/", "", ""); w.Code != 200 || w.Body.String() != "<p>Appy</p>" {
		t.Fatal(w.Code, w.Body.String())
	}
	for _, path := range []string{"/state.json", "/AGENTS.md", "/../index.html", "/%2e%2e/secret.js", "/escape.js", "/.hidden.js", "/index.html?secret=yes"} {
		w := request(h, "GET", path, "", "")
		if w.Code != 400 && w.Code != 404 {
			t.Errorf("%s: %d", path, w.Code)
		}
		if strings.Contains(w.Body.String(), "private") {
			t.Error("leaked secret")
		}
	}
}

func TestStoreLockPermissionsAndCorruption(t *testing.T) {
	s := testStore(t)
	if duplicate, err := OpenStore(s.dir); err == nil {
		duplicate.Close()
		t.Fatal("second process lock succeeded")
	}
	for _, name := range []string{"state.json", "process.lock"} {
		info, err := os.Stat(filepath.Join(s.dir, name))
		if err != nil || info.Mode().Perm() != 0600 {
			t.Fatal("unsafe file permissions", name, err)
		}
	}
	s.Close()
	if err := os.WriteFile(filepath.Join(s.dir, "state.json"), []byte(`{"version":900}`), 0600); err != nil {
		t.Fatal(err)
	}
	if reopened, err := OpenStore(s.dir); err == nil {
		reopened.Close()
		t.Fatal("corrupt snapshot accepted")
	}
	dir := filepath.Join(t.TempDir(), "public")
	_ = os.Mkdir(dir, 0755)
	if opened, err := OpenStore(dir); err == nil {
		opened.Close()
		t.Fatal("broad data permissions accepted")
	}
}

func TestOnlyExplicitLoopbackAddressAccepted(t *testing.T) {
	for _, addr := range []string{"0.0.0.0:8787", "localhost:8787", "[::1]:8787", "127.0.0.2:8787", "127.0.0.1:0", "127.0.0.1:08787", "127.0.0.1:65536"} {
		if ValidateAddress(addr) == nil {
			t.Error("unsafe address accepted", addr)
		}
	}
	if err := ValidateAddress(testHost); err != nil {
		t.Fatal(err)
	}
}

func TestIncompleteSnapshotNeverBecomesAnEmptyWorkspace(t *testing.T) {
	for _, body := range []string{`{}`, `null`, `{"admission":"open","tasks":[],"keys":{}}`, `{"version":1,"tasks":[],"keys":{}}`, `{"version":1,"admission":"open","keys":{}}`, `{"version":1,"admission":"open","tasks":[]}`} {
		t.Run(body, func(t *testing.T) {
			dir := filepath.Join(t.TempDir(), "journal")
			if err := os.Mkdir(dir, 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, "state.json"), []byte(body), 0600); err != nil {
				t.Fatal(err)
			}
			if s, err := OpenStore(dir); err == nil {
				s.Close()
				t.Fatal("incomplete snapshot silently accepted")
			}
		})
	}
}

func TestEmptyOptionalApprovalIDIsRejected(t *testing.T) {
	s := testStore(t)
	h := testHandler(t, s)
	task := decodeTask(t, request(h, "POST", "/api/v1/tasks", createBody, "empty_id_create"), 201)
	w := request(h, "POST", "/api/v1/tasks/"+task.ID+"/actions", `{"action":"start","expected_revision":1,"approval_id":""}`, "empty_id_start")
	if w.Code != 400 {
		t.Fatal(w.Code, w.Body.String())
	}
}
