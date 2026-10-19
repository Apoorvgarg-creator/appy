package mobile

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"appy/internal/hub"
)

const testLocal = "127.0.0.1:8787"
const testOrigin = "https://mac-mini.tail123.ts.net"

func newTestGateway(t *testing.T, downstream http.Handler) *Gateway {
	t.Helper()
	if downstream == nil {
		downstream = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	}
	g, err := New(downstream, testLocal, testOrigin)
	if err != nil {
		t.Fatal(err)
	}
	g.now = func() time.Time { return time.Date(2026, 10, 14, 10, 0, 0, 0, time.UTC) }
	return g
}

func request(g *Gateway, local bool, method, route, body string, cookie *http.Cookie, mutate func(*http.Request)) *httptest.ResponseRecorder {
	origin := testOrigin
	handler := g.RemoteHandler()
	if local {
		origin = "http://" + testLocal
		handler = g.LocalHandler()
	}
	r := httptest.NewRequest(method, origin+route, strings.NewReader(body))
	if method == http.MethodPost {
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
	}
	if cookie != nil {
		r.AddCookie(cookie)
	}
	if mutate != nil {
		mutate(r)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func decode[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var value T
	if err := json.Unmarshal(w.Body.Bytes(), &value); err != nil {
		t.Fatalf("decode status %d: %v: %s", w.Code, err, w.Body.String())
	}
	return value
}

func requireStatus(t *testing.T, w *httptest.ResponseRecorder, expected int) {
	t.Helper()
	if w.Code != expected {
		t.Fatalf("status %d, want %d: %s", w.Code, expected, w.Body.String())
	}
}

func invite(t *testing.T, g *Gateway) PairingInvite {
	t.Helper()
	w := request(g, true, "POST", "/api/v1/access/invite", "{}", nil, nil)
	requireStatus(t, w, 200)
	access := decode[MobileAccess](t, w)
	if access.Invite == nil || !codePattern.MatchString(access.Invite.Code) {
		t.Fatal("missing eight-digit invitation")
	}
	return *access.Invite
}

func pair(t *testing.T, g *Gateway, code string) (*http.Cookie, ControllerSession) {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"code": code, "name": "My iPhone"})
	w := request(g, false, "POST", "/api/v1/session", string(body), nil, nil)
	requireStatus(t, w, 200)
	cookies := w.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one session cookie, got %d", len(cookies))
	}
	return cookies[0], decode[ControllerSession](t, w)
}

func TestOriginAndLocalAddressValidation(t *testing.T) {
	for _, value := range []string{"", testOrigin, "https://m.a.ts.net", "https://my-mac.tail-abc.ts.net"} {
		if err := ValidateOrigin(value); err != nil {
			t.Errorf("valid origin %q: %v", value, err)
		}
	}
	for _, value := range []string{"http://mac.tail.ts.net", "https://mac.tail.ts.net/", "https://mac.tail.ts.net:443", "https://mac.tail.ts.net?", "https://mac.tail.ts.net#x", "https://user@mac.tail.ts.net", "https://*.tail.ts.net", "https://Mac.tail.ts.net", "https://mac.tail.ts.net.", "https://tail.ts.net", "https://x.mac.tail.ts.net", "https://-mac.tail.ts.net", "https://mac-.tail.ts.net", "https://mac.tail.ts.net.evil.test", "https://" + strings.Repeat("a", 64) + ".tail.ts.net"} {
		if err := ValidateOrigin(value); err == nil {
			t.Errorf("accepted invalid origin %q", value)
		}
	}
	for _, addr := range []string{"0.0.0.0:8787", "localhost:8787", "127.0.0.1:08787", "[::1]:8787"} {
		if _, err := New(http.NotFoundHandler(), addr, testOrigin); err == nil {
			t.Errorf("accepted unsafe local address %q", addr)
		}
	}
	if _, err := New(nil, testLocal, testOrigin); err == nil {
		t.Fatal("accepted nil downstream")
	}
}

func TestLocalSessionAndDisabledGateway(t *testing.T) {
	g, err := New(http.NotFoundHandler(), testLocal, "")
	if err != nil {
		t.Fatal(err)
	}
	w := request(g, true, "GET", "/api/v1/session", "", nil, nil)
	requireStatus(t, w, 200)
	session := decode[ControllerSession](t, w)
	if !session.Authenticated || session.Mode != "local" || session.Name != nil || session.ExpiresAt != nil {
		t.Fatalf("unexpected local session: %+v", session)
	}
	w = request(g, true, "GET", "/api/v1/access", "", nil, nil)
	access := decode[MobileAccess](t, w)
	if access.Enabled || access.Origin != nil || access.Invite != nil || access.Sessions == nil {
		t.Fatalf("unexpected disabled access: %+v", access)
	}
	requireStatus(t, request(g, true, "POST", "/api/v1/access/invite", "{}", nil, nil), 409)
	requireStatus(t, request(g, false, "GET", "/", "", nil, nil), 404)
	requireStatus(t, request(g, true, "POST", "/api/v1/session", `{}`, nil, nil), 404)
}

func TestPairingCookieAndSecretBoundaries(t *testing.T) {
	g := newTestGateway(t, nil)
	invitation := invite(t, g)
	if !invitation.ExpiresAt.Equal(g.now().Add(inviteLifetime)) {
		t.Fatal("invitation expiry differs from five minutes")
	}
	cookie, session := pair(t, g, invitation.Code)
	if cookie.Name != cookieName || !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || cookie.Path != "/" || cookie.Domain != "" || cookie.MaxAge != 8*60*60 {
		t.Fatalf("unsafe session cookie attributes: %+v", cookie)
	}
	if !session.Authenticated || session.Mode != "remote" || session.Name == nil || *session.Name != "My iPhone" || session.ExpiresAt == nil || !session.ExpiresAt.Equal(g.now().Add(sessionLifetime)) || !cookie.Expires.Equal(*session.ExpiresAt) {
		t.Fatalf("incorrect session: %+v", session)
	}
	if _, ok := g.sessions[sha256.Sum256([]byte(cookie.Value))]; !ok {
		t.Fatal("session token is not indexed by its digest")
	}
	w := request(g, true, "GET", "/api/v1/access", "", nil, nil)
	access := decode[MobileAccess](t, w)
	if !access.Enabled || access.Origin == nil || *access.Origin != testOrigin || access.Invite != nil || len(access.Sessions) != 1 || strings.Contains(w.Body.String(), cookie.Value) {
		t.Fatal("access view must expose session metadata only and consume invitation")
	}
	w = request(g, false, "GET", "/api/v1/session", "", cookie, nil)
	requireStatus(t, w, 200)
	if !decode[ControllerSession](t, w).Authenticated || strings.Contains(w.Body.String(), cookie.Value) {
		t.Fatal("session view leaks token or loses authentication")
	}
	for key, value := range map[string]string{"Cache-Control": "no-store", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Cross-Origin-Resource-Policy": "same-origin"} {
		if w.Header().Get(key) != value {
			t.Errorf("%s missing", key)
		}
	}
	if !strings.Contains(w.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'") {
		t.Fatal("CSP missing")
	}
}

func TestInvitationConsumptionRotationAndConcurrentReplay(t *testing.T) {
	g := newTestGateway(t, nil)
	old := invite(t, g)
	fresh := invite(t, g)
	if g.invite == nil || g.invite.Code != fresh.Code || old.Code == fresh.Code {
		t.Fatal("rotation did not replace the invitation")
	}
	requireStatus(t, request(g, false, "POST", "/api/v1/session", fmt.Sprintf(`{"code":%q,"name":"iPad"}`, old.Code), nil, nil), 401)
	var succeeded atomic.Int32
	var wg sync.WaitGroup
	for range 24 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := request(g, false, "POST", "/api/v1/session", fmt.Sprintf(`{"code":%q,"name":"iPad"}`, fresh.Code), nil, nil)
			if w.Code == 200 {
				succeeded.Add(1)
			} else if w.Code != 401 {
				t.Errorf("unexpected concurrent status: %d", w.Code)
			}
		}()
	}
	wg.Wait()
	if succeeded.Load() != 1 || len(g.sessions) != 1 || g.invite != nil {
		t.Fatal("an invitation admitted more than one browser")
	}
	requireStatus(t, request(g, false, "POST", "/api/v1/session", fmt.Sprintf(`{"code":%q,"name":"iPad"}`, fresh.Code), nil, nil), 401)
}

func TestWrongGuessBudgetIncludesMalformedCodesAndConcurrentAttempts(t *testing.T) {
	for _, wrong := range []string{"abcdefgh", "123", "123456789", "wrong-valid-digits"} {
		t.Run(wrong, func(t *testing.T) {
			g := newTestGateway(t, nil)
			invitation := invite(t, g)
			code := wrong
			if wrong == "wrong-valid-digits" {
				code = "00000000"
				if code == invitation.Code {
					code = "00000001"
				}
			}
			for attempt := 1; attempt <= 5; attempt++ {
				requireStatus(t, request(g, false, "POST", "/api/v1/session", fmt.Sprintf(`{"code":%q,"name":"iPad"}`, code), nil, nil), 401)
				if attempt < 5 && g.invite == nil {
					t.Fatal("invitation invalidated before fifth attempt")
				}
			}
			if g.invite != nil {
				t.Fatal("fifth failure did not invalidate invitation")
			}
			requireStatus(t, request(g, false, "POST", "/api/v1/session", fmt.Sprintf(`{"code":%q,"name":"iPad"}`, invitation.Code), nil, nil), 401)
			pair(t, g, invite(t, g).Code)
		})
	}
	g := newTestGateway(t, nil)
	invitation := invite(t, g)
	var wg sync.WaitGroup
	for range 30 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			requireStatus(t, request(g, false, "POST", "/api/v1/session", `{"code":"invalid","name":"iPhone"}`, nil, nil), 401)
		}()
	}
	wg.Wait()
	if g.invite != nil || g.wrongGuesses != 5 {
		t.Fatal("concurrent attempts escaped the global invitation budget")
	}
	requireStatus(t, request(g, false, "POST", "/api/v1/session", fmt.Sprintf(`{"code":%q,"name":"iPad"}`, invitation.Code), nil, nil), 401)
}

func TestExpiryAtBoundaryAndRestartForgetCredentials(t *testing.T) {
	g := newTestGateway(t, nil)
	invitation := invite(t, g)
	g.now = func() time.Time { return invitation.ExpiresAt }
	requireStatus(t, request(g, false, "POST", "/api/v1/session", fmt.Sprintf(`{"code":%q,"name":"iPad"}`, invitation.Code), nil, nil), 401)
	cookie, session := pair(t, g, invite(t, g).Code)
	g.now = func() time.Time { return *session.ExpiresAt }
	requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", cookie, nil), 401)
	w := request(g, false, "GET", "/api/v1/session", "", cookie, nil)
	if decode[ControllerSession](t, w).Authenticated || len(g.sessions) != 0 {
		t.Fatal("expired session survives at expiry boundary")
	}
	g = newTestGateway(t, nil)
	cookie, _ = pair(t, g, invite(t, g).Code)
	restarted := newTestGateway(t, nil)
	requireStatus(t, request(restarted, false, "GET", "/api/v1/workspace", "", cookie, nil), 401)
}

func TestRevocationLogoutAndStopAdmission(t *testing.T) {
	g := newTestGateway(t, nil)
	first, _ := pair(t, g, invite(t, g).Code)
	second, _ := pair(t, g, invite(t, g).Code)
	firstID := g.sessions[sha256.Sum256([]byte(first.Value))].ID
	w := request(g, true, "POST", "/api/v1/access/revoke", fmt.Sprintf(`{"session_id":%q}`, firstID), nil, nil)
	requireStatus(t, w, 200)
	if len(decode[MobileAccess](t, w).Sessions) != 1 {
		t.Fatal("revocation did not remove one session")
	}
	requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", first, nil), 401)
	requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", second, nil), 204)
	w = request(g, false, "POST", "/api/v1/session/logout", "{}", second, nil)
	requireStatus(t, w, 200)
	clearCookie := w.Result().Cookies()[0]
	if clearCookie.MaxAge != -1 || !clearCookie.Secure || !clearCookie.HttpOnly || clearCookie.SameSite != http.SameSiteStrictMode || clearCookie.Path != "/" || clearCookie.Domain != "" {
		t.Fatal("logout did not expire matching protected cookie")
	}
	requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", second, nil), 401)
	third, _ := pair(t, g, invite(t, g).Code)
	invite(t, g)
	w = request(g, true, "POST", "/api/v1/access/stop", "{}", nil, nil)
	requireStatus(t, w, 200)
	access := decode[MobileAccess](t, w)
	if len(access.Sessions) != 0 || access.Invite != nil || !access.Enabled {
		t.Fatal("stop must revoke all credentials while retaining gateway configuration")
	}
	requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", third, nil), 401)
}

func TestSessionCapacityPrunesExpiredBrowsers(t *testing.T) {
	g := newTestGateway(t, nil)
	var last ControllerSession
	for range maxSessions {
		_, last = pair(t, g, invite(t, g).Code)
	}
	requireStatus(t, request(g, true, "POST", "/api/v1/access/invite", "{}", nil, nil), 409)
	if len(g.sessions) != maxSessions {
		t.Fatal("unexpected session capacity")
	}
	g.now = func() time.Time { return *last.ExpiresAt }
	pair(t, g, invite(t, g).Code)
	if len(g.sessions) != 1 {
		t.Fatal("expired sessions did not release capacity")
	}
}

func TestStrictJSONAndPairingNames(t *testing.T) {
	for _, body := range []string{"", "[]", "null", `{}`, `{"code":null,"name":"iPhone"}`, `{"code":"12345678","name":null}`, `{"Code":"12345678","name":"iPhone"}`, `{"code":"12345678","code":"12345678","name":"iPhone"}`, `{"code":"12345678","name":"iPhone","extra":true}`, `{"code":12345678,"name":"iPhone"}`, `{"code":"12345678","name":5}`, `{"code":"12345678","name":"iPhone"}{}`, `{"code":"12345678","name":""}`, `{"code":"12345678","name":" iPhone"}`, `{"code":"12345678","name":"iPhone\n"}`, fmt.Sprintf(`{"code":"12345678","name":%q}`, strings.Repeat("a", 41)), "{\"code\":\"12345678\",\"name\":\"\xff\"}"} {
		t.Run(body, func(t *testing.T) {
			g := newTestGateway(t, nil)
			invite(t, g)
			requireStatus(t, request(g, false, "POST", "/api/v1/session", body, nil, nil), 400)
			if len(g.sessions) != 0 {
				t.Fatal("invalid JSON created a session")
			}
		})
	}
	g := newTestGateway(t, nil)
	requireStatus(t, request(g, false, "POST", "/api/v1/session", strings.Repeat(" ", 2049), nil, nil), 413)
	for _, contentType := range []string{"", "text/plain", "application/json; charset=latin1", "application/json; x=y"} {
		requireStatus(t, request(g, false, "POST", "/api/v1/session", "{}", nil, func(r *http.Request) { r.Header.Set("Content-Type", contentType) }), 415)
	}
	requireStatus(t, request(g, false, "POST", "/api/v1/session", "{}", nil, func(r *http.Request) { r.Header.Add("Content-Type", "application/json") }), 415)
	for _, route := range []string{"/api/v1/access/invite", "/api/v1/access/stop"} {
		requireStatus(t, request(g, true, "POST", route, `{"unexpected":true}`, nil, nil), 400)
	}
	requireStatus(t, request(g, true, "POST", "/api/v1/access/revoke", `{"session_id":"../x"}`, nil, nil), 400)
	requireStatus(t, request(g, false, "POST", "/api/v1/session/logout", `{"unexpected":true}`, nil, nil), 400)
}

func TestBoundaryRejectsHostOriginMetadataAndPathBypasses(t *testing.T) {
	cases := []struct {
		name   string
		method string
		path   string
		mutate func(*http.Request)
		status int
	}{
		{"host", "GET", "/api/v1/session", func(r *http.Request) { r.Host = "evil.example" }, 403},
		{"host port", "GET", "/api/v1/session", func(r *http.Request) { r.Host += ":443" }, 403},
		{"missing origin", "POST", "/api/v1/session", func(r *http.Request) { r.Header.Del("Origin") }, 403},
		{"wrong origin", "GET", "/api/v1/session", func(r *http.Request) { r.Header.Set("Origin", "https://evil.example") }, 403},
		{"duplicate origin", "POST", "/api/v1/session", func(r *http.Request) { r.Header.Add("Origin", testOrigin) }, 403},
		{"combined origins", "POST", "/api/v1/session", func(r *http.Request) { r.Header.Set("Origin", testOrigin+", "+testOrigin) }, 403},
		{"null origin", "POST", "/api/v1/session", func(r *http.Request) { r.Header.Set("Origin", "null") }, 403},
		{"same site", "GET", "/api/v1/session", func(r *http.Request) { r.Header.Set("Sec-Fetch-Site", "same-site") }, 403},
		{"cross site", "GET", "/api/v1/session", func(r *http.Request) { r.Header.Set("Sec-Fetch-Site", "cross-site") }, 403},
		{"duplicate fetch site", "GET", "/api/v1/session", func(r *http.Request) {
			r.Header.Add("Sec-Fetch-Site", "same-origin")
			r.Header.Add("Sec-Fetch-Site", "same-origin")
		}, 403},
		{"query", "GET", "/api/v1/session?x=y", nil, 400},
		{"empty query", "GET", "/api/v1/session?", nil, 400},
		{"encoded route", "GET", "/api/v1/%73ession", nil, 400},
		{"encoded slash", "GET", "/api%2fv1/session", nil, 400},
		{"encoded traversal", "GET", "/assets/%2e%2e/api/v1/access", nil, 400},
		{"dot traversal", "GET", "/assets/../api/v1/access", nil, 400},
		{"double slash", "GET", "//api/v1/access", nil, 400},
		{"backslash", "GET", "/api/v1/%5csession", nil, 400},
		{"method", "DELETE", "/api/v1/session", nil, 405},
		{"funnel", "GET", "/api/v1/session", func(r *http.Request) { r.Header.Set("Tailscale-Funnel-Request", "?1") }, 403},
		{"empty funnel", "GET", "/api/v1/session", func(r *http.Request) { r.Header["tailscale-funnel-request"] = []string{""} }, 403},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			g := newTestGateway(t, http.HandlerFunc(func(http.ResponseWriter, *http.Request) { t.Error("rejected request reached downstream") }))
			requireStatus(t, request(g, false, tc.method, tc.path, "{}", nil, tc.mutate), tc.status)
		})
	}
	g := newTestGateway(t, nil)
	for _, route := range []string{"/api/v1/access/invite", "/api/v1/access/stop", "/api/v1/access/revoke"} {
		requireStatus(t, request(g, true, "POST", route, "{}", nil, func(r *http.Request) { r.Header.Del("Origin") }), 403)
		requireStatus(t, request(g, true, "POST", route, "{}", nil, func(r *http.Request) { r.Header.Add("Origin", "http://"+testLocal) }), 403)
	}
	requireStatus(t, request(g, true, "GET", "/api/v1/access", "", nil, func(r *http.Request) { r.Host = "evil.example" }), 403)
}

func TestRemoteAllowlistProtectsAllTaskDataAndLocalAdministration(t *testing.T) {
	g := newTestGateway(t, nil)
	for _, route := range []string{"/api/v1/workspace", "/api/v1/tasks/task_1", "/api/v1/tasks/task_1/artifact"} {
		requireStatus(t, request(g, false, "GET", route, "", nil, nil), 401)
	}
	for _, route := range []string{"/api/v1/tasks", "/api/v1/tasks/task_1/actions", "/api/v1/control"} {
		requireStatus(t, request(g, false, "POST", route, "{}", nil, nil), 401)
	}
	cookie, _ := pair(t, g, invite(t, g).Code)
	for _, route := range []string{"/api/v1/access", "/api/v1/access/invite", "/api/v1/access/revoke", "/api/v1/access/stop", "/api/v1/future-admin", "/api/v1/tasks/task_1/secret", "/api/v1/tasks/task_1/artifact/extra", "/private.json"} {
		for _, method := range []string{"GET", "POST", "HEAD"} {
			for _, token := range []*http.Cookie{nil, cookie} {
				requireStatus(t, request(g, false, method, route, "{}", token, nil), 404)
			}
		}
	}
	for _, route := range []string{"/", "/index.html", "/assets/main.js", "/assets/main.css", "/fonts/Inter-Regular.woff2", "/favicon.ico"} {
		requireStatus(t, request(g, false, "GET", route, "", nil, nil), 204)
		requireStatus(t, request(g, false, "HEAD", route, "", nil, nil), 204)
	}
}

func TestCookieAmbiguityAndIdentityHeaderSpoofing(t *testing.T) {
	g := newTestGateway(t, nil)
	cookie, _ := pair(t, g, invite(t, g).Code)
	for _, value := range []string{"not-a-token", strings.Repeat("a", 43), cookie.Value + "=", ""} {
		requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", &http.Cookie{Name: cookieName, Value: value}, nil), 401)
	}
	requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", cookie, func(r *http.Request) { r.AddCookie(cookie) }), 401)
	w := request(g, false, "GET", "/api/v1/session", "", cookie, func(r *http.Request) { r.AddCookie(cookie) })
	if decode[ControllerSession](t, w).Authenticated {
		t.Fatal("ambiguous cookie authenticated")
	}
	requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", nil, func(r *http.Request) {
		r.Header.Set("Tailscale-User-Login", "owner@example.com")
		r.Header.Set("X-Forwarded-For", "127.0.0.1")
		r.Header.Set("X-Forwarded-Host", testLocal)
		r.Header.Set("Forwarded", "for=127.0.0.1;host="+testLocal)
	}), 401)
}

func TestAuthenticatedDelegationRewritesOnlyAfterBoundary(t *testing.T) {
	var seen atomic.Int32
	g := newTestGateway(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen.Add(1)
		if r.Host != testLocal || r.Header.Get("Origin") != "http://"+testLocal || r.Header.Get("Idempotency-Key") != "mobile-key-123" {
			t.Error("downstream host/origin/idempotency mismatch")
		}
		for _, name := range []string{"Cookie", "Forwarded", "X-Forwarded-Host", "Tailscale-User-Login"} {
			if r.Header.Get(name) != "" {
				t.Errorf("untrusted %s forwarded", name)
			}
		}
		w.WriteHeader(201)
	}))
	cookie, _ := pair(t, g, invite(t, g).Code)
	w := request(g, false, "POST", "/api/v1/tasks", `{"goal":"Report","recipe":"repository_summary"}`, cookie, func(r *http.Request) {
		r.Header.Set("Idempotency-Key", "mobile-key-123")
		r.Header.Set("Forwarded", "for=127.0.0.1")
		r.Header.Set("X-Forwarded-Host", testLocal)
		r.Header.Set("Tailscale-User-Login", "owner@example.com")
	})
	requireStatus(t, w, 201)
	if seen.Load() != 1 {
		t.Fatal("authenticated request not delegated exactly once")
	}
}

func TestRealHubIntegrationRequiresPairingForWorkspaceAndArtifact(t *testing.T) {
	store, err := hub.OpenStore(filepath.Join(t.TempDir(), "data"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	handler, err := hub.NewHandler(store, testLocal, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	g := newTestGateway(t, handler)
	cookie, _ := pair(t, g, invite(t, g).Code)
	requireStatus(t, request(g, false, "GET", "/api/v1/workspace", "", cookie, nil), 200)
	w := request(g, false, "POST", "/api/v1/tasks", `{"goal":"Phone request","recipe":"repository_summary"}`, cookie, func(r *http.Request) { r.Header.Set("Idempotency-Key", "phone-create-123") })
	requireStatus(t, w, 201)
	task := decode[hub.Task](t, w)
	if task.Goal != "Phone request" {
		t.Fatal("task did not reach actual hub")
	}
	requireStatus(t, request(g, false, "GET", "/api/v1/tasks/"+task.ID, "", cookie, nil), 200)
	requireStatus(t, request(g, false, "GET", "/api/v1/tasks/"+task.ID+"/artifact", "", nil, nil), 401)
	requireStatus(t, request(g, false, "GET", "/api/v1/tasks/"+task.ID+"/artifact", "", cookie, nil), 409)
	requireStatus(t, request(g, false, "GET", "/api/v1/access", "", cookie, nil), 404)
}
