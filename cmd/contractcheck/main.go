// Command contractcheck exercises the real handler without binding a socket.
// It emits response samples for validation against contracts/openapi.json.
package main

import (
	"appy/internal/hub"
	"appy/internal/mobile"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
)

type sample struct {
	Method string          `json:"method"`
	Path   string          `json:"path"`
	Status int             `json:"status"`
	Body   json.RawMessage `json:"body"`
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	remote := flag.Bool("mobile", false, "exercise pairing and the remote controller boundary")
	flag.Parse()
	dir, err := os.MkdirTemp("", "appy-contract-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	store, err := hub.OpenStore(filepath.Join(dir, "data"))
	if err != nil {
		return err
	}
	defer store.Close()
	web := filepath.Join(dir, "web")
	if err := os.Mkdir(web, 0700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(web, "index.html"), []byte("<!doctype html><title>contract fixture</title>"), 0600); err != nil {
		return err
	}
	handler, err := hub.NewHandler(store, "127.0.0.1:8787", web)
	if err != nil {
		return err
	}
	gateway, err := mobile.New(handler, "127.0.0.1:8787", "https://mac.example.ts.net")
	if err != nil {
		return err
	}
	handler = gateway.LocalHandler()
	origin := "http://127.0.0.1:8787"
	var cookie *http.Cookie
	samples := []sample{}
	sequence := 0
	request := func(method, path string, body any, want int) (map[string]any, error) {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		req := httptest.NewRequest(method, origin+path, bytes.NewReader(data))
		req.Header.Set("Origin", origin)
		if cookie != nil {
			req.AddCookie(cookie)
		}
		if method == http.MethodPost {
			sequence++
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Idempotency-Key", fmt.Sprintf("contract-%08d", sequence))
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		for _, received := range recorder.Result().Cookies() {
			if received.Name == "__Host-appy_session" {
				cookie = received
			}
		}
		if recorder.Code != want {
			return nil, fmt.Errorf("%s %s: expected %d, got %d: %s", method, path, want, recorder.Code, recorder.Body.String())
		}
		var decoded map[string]any
		if err := json.Unmarshal(recorder.Body.Bytes(), &decoded); err != nil {
			return nil, err
		}
		samples = append(samples, sample{method, path, recorder.Code, append(json.RawMessage(nil), recorder.Body.Bytes()...)})
		return decoded, nil
	}
	if *remote {
		if _, err := request("GET", "/api/v1/session", nil, 200); err != nil {
			return err
		}
		access, err := request("POST", "/api/v1/access/invite", map[string]any{}, 200)
		if err != nil {
			return err
		}
		invite := access["invite"].(map[string]any)
		handler = gateway.RemoteHandler()
		origin = "https://mac.example.ts.net"
		if _, err := request("GET", "/api/v1/session", nil, 200); err != nil {
			return err
		}
		if _, err := request("GET", "/api/v1/workspace", nil, 401); err != nil {
			return err
		}
		if _, err := request("POST", "/api/v1/session", map[string]any{"code": invite["code"], "name": "Fixture iPad"}, 200); err != nil {
			return err
		}
		if cookie == nil || !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || cookie.Path != "/" || cookie.Domain != "" {
			return fmt.Errorf("pairing cookie boundaries are missing")
		}
	}
	if _, err := request("GET", "/api/v1/workspace", nil, 200); err != nil {
		return err
	}
	if _, err := request("POST", "/api/v1/tasks", map[string]any{"goal": "outside scope", "recipe": "shell"}, 400); err != nil {
		return err
	}
	task, err := request("POST", "/api/v1/tasks", map[string]any{"goal": "Analyze the example repository", "recipe": "repository_summary"}, 201)
	if err != nil {
		return err
	}
	id, ok := task["id"].(string)
	if !ok {
		return fmt.Errorf("missing task ID")
	}
	path := "/api/v1/tasks/" + id
	task, err = request("POST", path+"/actions", map[string]any{"action": "start", "expected_revision": task["revision"]}, 200)
	if err != nil {
		return err
	}
	for i := 0; i < 20; i++ {
		if err := store.Tick(); err != nil {
			return err
		}
		task, err = request("GET", path, nil, 200)
		if err != nil {
			return err
		}
		if task["status"] == "waiting_approval" {
			break
		}
	}
	approval, ok := task["approval"].(map[string]any)
	if !ok {
		return fmt.Errorf("runner did not request approval")
	}
	task, err = request("POST", path+"/actions", map[string]any{"action": "approve", "expected_revision": task["revision"], "approval_id": approval["id"]}, 200)
	if err != nil {
		return err
	}
	if task["status"] != "succeeded" {
		return fmt.Errorf("approved task did not succeed")
	}
	req := httptest.NewRequest("GET", origin+path+"/artifact", nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	artifact, ok := task["artifact"].(map[string]any)
	if !ok || recorder.Code != 200 || recorder.Body.String() != artifact["content"] {
		return fmt.Errorf("artifact bytes differ from approved result")
	}
	if _, err := request("GET", "/api/v1/workspace", nil, 200); err != nil {
		return err
	}
	if _, err := request("POST", "/api/v1/control", map[string]any{"action": "stop_all"}, 200); err != nil {
		return err
	}
	if _, err := request("POST", "/api/v1/tasks", map[string]any{"goal": "Admission is stopped", "recipe": "repository_summary"}, 409); err != nil {
		return err
	}
	if _, err := request("POST", "/api/v1/control", map[string]any{"action": "enable_new_tasks"}, 200); err != nil {
		return err
	}
	if *remote {
		if _, err := request("GET", "/api/v1/access", nil, 404); err != nil {
			return err
		}
		handler = gateway.LocalHandler()
		origin = "http://127.0.0.1:8787"
		access, err := request("GET", "/api/v1/access", nil, 200)
		if err != nil {
			return err
		}
		sessions := access["sessions"].([]any)
		if len(sessions) != 1 {
			return fmt.Errorf("expected one paired browser")
		}
		if _, err := request("POST", "/api/v1/access/revoke", map[string]any{"session_id": sessions[0].(map[string]any)["id"]}, 200); err != nil {
			return err
		}
		handler = gateway.RemoteHandler()
		origin = "https://mac.example.ts.net"
		if _, err := request("GET", "/api/v1/workspace", nil, 401); err != nil {
			return err
		}
		if _, err := request("GET", path+"/artifact", nil, 401); err != nil {
			return err
		}
		if _, err := request("GET", "/api/v1/session", nil, 200); err != nil {
			return err
		}
		if _, err := request("POST", "/api/v1/session/logout", map[string]any{}, 200); err != nil {
			return err
		}
	}
	return json.NewEncoder(os.Stdout).Encode(samples)
}
