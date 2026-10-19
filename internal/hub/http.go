package hub

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

var idPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,80}$`)
var keyPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{8,80}$`)

func ValidateAddress(addr string) error {
	host, port, err := net.SplitHostPort(addr)
	if err != nil || host != "127.0.0.1" {
		return errors.New("address must be explicit IPv4 loopback: 127.0.0.1:<port>")
	}
	n, err := strconv.Atoi(port)
	if err != nil || n < 1 || n > 65535 || strconv.Itoa(n) != port {
		return errors.New("port must be an integer from 1 to 65535")
	}
	return nil
}

type handler struct {
	store *Store
	host  string
	root  string
}

func NewHandler(store *Store, host, webDir string) (http.Handler, error) {
	if err := ValidateAddress(host); err != nil {
		return nil, err
	}
	root, err := filepath.Abs(webDir)
	if err != nil {
		return nil, err
	}
	// All assets are checked again at request time. A missing build is a useful
	// JSON 404 while API development/tests can proceed without a frontend build.
	return &handler{store: store, host: host, root: root}, nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	body, _ := json.Marshal(value)
	writeBytes(w, status, body)
}
func writeBytes(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}
func reject(w http.ResponseWriter, status int, code, message string) {
	_, value := errResponse(status, code, message)
	writeJSON(w, status, value)
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
	w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
	if r.Host != h.host {
		reject(w, 403, "invalid_host", "Use the configured 127.0.0.1 address.")
		return
	}
	if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+h.host {
		reject(w, 403, "invalid_origin", "Cross-origin requests are not allowed.")
		return
	}
	if site := r.Header.Get("Sec-Fetch-Site"); site != "" && site != "same-origin" && site != "none" {
		reject(w, 403, "cross_site_request", "Cross-site requests are not allowed.")
		return
	}
	if r.URL.RawQuery != "" || strings.Contains(r.URL.Path, "\\") || strings.Contains(r.URL.Path, "\x00") || path.Clean(r.URL.Path) != r.URL.Path || strings.Contains(r.URL.RawPath, "%") {
		reject(w, 400, "invalid_path", "Use an exact application route without query parameters.")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodPost {
		reject(w, 405, "method_not_allowed", "Method not allowed.")
		return
	}
	p := r.URL.Path
	if r.Method == http.MethodGet && strings.HasPrefix(p, "/api/") && !h.store.Ready() {
		reject(w, 503, "store_unavailable", "Storage is unavailable. Resolve the storage error and retry or restart.")
		return
	}
	if r.Method == http.MethodGet && p == "/api/v1/workspace" {
		writeJSON(w, 200, h.store.Workspace())
		return
	}
	if strings.HasPrefix(p, "/api/v1/tasks/") {
		parts := strings.Split(strings.TrimPrefix(p, "/api/v1/tasks/"), "/")
		if !idPattern.MatchString(parts[0]) {
			reject(w, 404, "not_found", "Route not found.")
			return
		}
		if r.Method == http.MethodGet && (len(parts) == 1 || len(parts) == 2 && parts[1] == "artifact") {
			t, ok := h.store.Task(parts[0])
			if !ok {
				reject(w, 404, "not_found", "Task not found.")
				return
			}
			if len(parts) == 1 {
				writeJSON(w, 200, t)
				return
			}
			if t.Status != "succeeded" || t.Artifact == nil {
				reject(w, 409, "artifact_unavailable", "Approve the report before downloading it.")
				return
			}
			w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
			w.Header().Set("Content-Disposition", `attachment; filename="example-repository-report.md"`)
			_, _ = io.WriteString(w, t.Artifact.Content)
			return
		}
		if r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "actions" {
			h.post(w, r, parts[0])
			return
		}
	}
	if r.Method == http.MethodPost && (p == "/api/v1/tasks" || p == "/api/v1/control") {
		h.post(w, r, "")
		return
	}
	if strings.HasPrefix(p, "/api/") || r.Method == http.MethodPost {
		reject(w, 404, "not_found", "Route not found.")
		return
	}
	h.static(w, r)
}

// strictObject rejects duplicate keys, null fields, case aliases, unknown fields,
// trailing values and invalid UTF-8; Go's default JSON decoder is more permissive.
func strictObject(body []byte, allowed, required []string, into any) error {
	if !utf8.Valid(body) {
		return errors.New("invalid UTF-8")
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	token, err := dec.Token()
	if err != nil || token != json.Delim('{') {
		return errors.New("expected a JSON object")
	}
	seen := map[string]bool{}
	allowedSet := map[string]bool{}
	for _, key := range allowed {
		allowedSet[key] = true
	}
	for dec.More() {
		token, err = dec.Token()
		if err != nil {
			return err
		}
		key, ok := token.(string)
		if !ok || !allowedSet[key] || seen[key] {
			return errors.New("unknown or duplicate field")
		}
		seen[key] = true
		var value json.RawMessage
		if err = dec.Decode(&value); err != nil {
			return err
		}
		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return errors.New("null fields are not accepted")
		}
	}
	if _, err = dec.Token(); err != nil {
		return err
	}
	if err = dec.Decode(new(any)); err != io.EOF {
		return errors.New("trailing JSON data")
	}
	for _, key := range required {
		if !seen[key] {
			return errors.New("missing required field")
		}
	}
	return json.Unmarshal(body, into)
}

func (h *handler) post(w http.ResponseWriter, r *http.Request, id string) {
	if len(r.Header.Values("Idempotency-Key")) != 1 || !keyPattern.MatchString(r.Header.Get("Idempotency-Key")) {
		reject(w, 400, "invalid_idempotency_key", "Use a unique Idempotency-Key of 8 to 80 letters, numbers, underscores or hyphens.")
		return
	}
	media, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" || len(params) > 1 || len(params) == 1 && !strings.EqualFold(params["charset"], "utf-8") {
		reject(w, 415, "unsupported_media_type", "Send application/json with UTF-8 encoding.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		var large *http.MaxBytesError
		if errors.As(err, &large) {
			reject(w, 413, "body_too_large", "Request body exceeds 16 KiB.")
		} else {
			reject(w, 400, "invalid_body", "Unable to read request body.")
		}
		return
	}
	var operation func(*snapshot) (int, any)
	switch {
	case id != "":
		var req TaskAction
		err = strictObject(body, []string{"action", "expected_revision", "approval_id"}, []string{"action", "expected_revision"}, &req)
		var fields map[string]json.RawMessage
		_ = json.Unmarshal(body, &fields)
		_, hasApprovalID := fields["approval_id"]
		if err == nil && (req.ExpectedRevision < 1 || hasApprovalID && !idPattern.MatchString(req.ApprovalID)) {
			err = errors.New("invalid action fields")
		}
		valid := map[string]bool{"start": true, "pause": true, "resume": true, "cancel": true, "approve": true, "deny": true, "refresh_approval": true}
		if !valid[req.Action] {
			err = errors.New("invalid action")
		}
		if (req.Action == "approve" || req.Action == "deny") && req.ApprovalID == "" {
			err = errors.New("approval_id required")
		}
		operation = func(st *snapshot) (int, any) { return h.store.action(st, id, req) }
	case r.URL.Path == "/api/v1/tasks":
		var req CreateTask
		err = strictObject(body, []string{"goal", "recipe"}, []string{"goal", "recipe"}, &req)
		if strings.TrimSpace(req.Goal) == "" || utf8.RuneCountInString(req.Goal) > 300 || req.Recipe != "repository_summary" {
			err = errors.New("invalid task fields")
		}
		operation = func(st *snapshot) (int, any) { return h.store.create(st, req) }
	default:
		var req ControlAction
		err = strictObject(body, []string{"action"}, []string{"action"}, &req)
		if req.Action != "stop_all" && req.Action != "enable_new_tasks" {
			err = errors.New("invalid control")
		}
		operation = func(st *snapshot) (int, any) { return h.store.control(st, req) }
	}
	if err != nil {
		reject(w, 400, "invalid_request", "The JSON object must contain only the required, correctly typed fields for this operation.")
		return
	}
	fingerprint := digest(r.Method + "\n" + r.URL.Path + "\n" + string(body))
	status, result := h.store.mutate(r.Header.Get("Idempotency-Key"), fingerprint, operation)
	writeBytes(w, status, result)
}

func (h *handler) static(w http.ResponseWriter, r *http.Request) {
	rel := strings.TrimPrefix(r.URL.Path, "/")
	if rel == "" {
		rel = "index.html"
	}
	allowed := map[string]bool{".js": true, ".css": true, ".woff2": true, ".png": true, ".svg": true, ".ico": true}
	if rel != "index.html" && !allowed[filepath.Ext(rel)] {
		reject(w, 404, "not_found", "File not found.")
		return
	}
	// No symlink in the configured root or asset components may escape the build.
	current := h.root
	for _, component := range strings.Split(rel, "/") {
		if strings.HasPrefix(component, ".") {
			reject(w, 404, "not_found", "File not found.")
			return
		}
	}
	// macOS /tmp is a system symlink; resolve the configured root once, then
	// require its contents to be symlink-free. A configured root is trusted CLI input.
	resolved, err := filepath.EvalSymlinks(h.root)
	if err != nil {
		reject(w, 404, "build_not_found", "Frontend build not found. Build web/dist first.")
		return
	}
	current = resolved
	for _, component := range strings.Split(rel, "/") {
		current = filepath.Join(current, component)
		info, err := os.Lstat(current)
		if err != nil || info.Mode()&os.ModeSymlink != 0 {
			reject(w, 404, "not_found", "File not found.")
			return
		}
	}
	root, err := os.OpenRoot(resolved)
	if err != nil {
		reject(w, 404, "not_found", "File not found.")
		return
	}
	defer root.Close()
	// Root.Open also confines resolution if an asset is swapped after Lstat.
	f, err := root.Open(rel)
	if err != nil {
		reject(w, 404, "not_found", "File not found.")
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		reject(w, 404, "not_found", "File not found.")
		return
	}
	if info.Size() > 16<<20 {
		reject(w, 404, "not_found", "File not found.")
		return
	}
	http.ServeContent(w, r, rel, info.ModTime(), f)
}
