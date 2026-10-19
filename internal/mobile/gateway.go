// Package mobile places an ephemeral, paired-browser boundary in front of the
// local fixture controller. It does not trust proxy identity headers.
package mobile

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"path"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"appy/internal/hub"
)

const cookieName = "__Host-appy_session"
const sessionLifetime = 8 * time.Hour
const inviteLifetime = 5 * time.Minute
const maxSessions = 8

var originPattern = regexp.MustCompile(`^https://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.ts\.net$`)
var idPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,80}$`)
var codePattern = regexp.MustCompile(`^[0-9]{8}$`)

type ControllerSession struct {
	Mode          string     `json:"mode"`
	Authenticated bool       `json:"authenticated"`
	Name          *string    `json:"name"`
	ExpiresAt     *time.Time `json:"expires_at"`
}

type PairingInvite struct {
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expires_at"`
}

type PairedBrowser struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type MobileAccess struct {
	Enabled  bool            `json:"enabled"`
	Origin   *string         `json:"origin"`
	Invite   *PairingInvite  `json:"invite"`
	Sessions []PairedBrowser `json:"sessions"`
}

// Gateway sessions and invitations intentionally disappear on process restart.
// Revocation stops future request admission, not already-accepted task work.
type Gateway struct {
	local        http.Handler
	localHost    string
	publicOrigin string
	publicHost   string
	mu           sync.Mutex
	sessions     map[[32]byte]PairedBrowser
	invite       *PairingInvite
	wrongGuesses int
	now          func() time.Time
}

func New(localHandler http.Handler, localHost, publicOrigin string) (*Gateway, error) {
	if localHandler == nil {
		return nil, errors.New("local handler is required")
	}
	if err := hub.ValidateAddress(localHost); err != nil {
		return nil, err
	}
	if err := ValidateOrigin(publicOrigin); err != nil {
		return nil, err
	}
	return &Gateway{local: localHandler, localHost: localHost, publicOrigin: publicOrigin,
		publicHost: strings.TrimPrefix(publicOrigin, "https://"), sessions: make(map[[32]byte]PairedBrowser), now: time.Now}, nil
}

// ValidateOrigin accepts an empty origin to disable mobile access. All enabled
// origins identify exactly one canonical HTTPS Tailscale machine hostname.
func ValidateOrigin(origin string) error {
	if origin != "" && !originPattern.MatchString(origin) {
		return errors.New("mobile origin must be an exact HTTPS machine.tailnet.ts.net origin without a port, path or query")
	}
	return nil
}

func (g *Gateway) LocalHandler() http.Handler {
	return http.HandlerFunc(g.serveLocal)
}

func (g *Gateway) RemoteHandler() http.Handler {
	return http.HandlerFunc(g.serveRemote)
}

func secureHeaders(w http.ResponseWriter) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
	w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func reject(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}

func boundary(w http.ResponseWriter, r *http.Request, host, origin string) bool {
	secureHeaders(w)
	if r.Host != host {
		reject(w, 403, "invalid_host", "Use the configured controller address.")
		return false
	}
	origins := r.Header.Values("Origin")
	if len(origins) > 1 || len(origins) == 1 && origins[0] != origin || r.Method == http.MethodPost && len(origins) != 1 {
		reject(w, 403, "invalid_origin", "An exact same-origin request is required.")
		return false
	}
	sites := r.Header.Values("Sec-Fetch-Site")
	if len(sites) > 1 || len(sites) == 1 && sites[0] != "" && sites[0] != "same-origin" && sites[0] != "none" {
		reject(w, 403, "cross_site_request", "Cross-site requests are not allowed.")
		return false
	}
	if r.URL.RawQuery != "" || r.URL.ForceQuery || r.URL.Fragment != "" || r.URL.RawPath != "" || strings.Contains(r.URL.EscapedPath(), "%") || strings.ContainsAny(r.URL.Path, "\\\x00") || path.Clean(r.URL.Path) != r.URL.Path {
		reject(w, 400, "invalid_path", "Use an exact application route without query parameters.")
		return false
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodPost {
		reject(w, 405, "method_not_allowed", "Method not allowed.")
		return false
	}
	return true
}

func (g *Gateway) serveLocal(w http.ResponseWriter, r *http.Request) {
	// Wrap only gateway-owned routes; the original local handler retains its
	// established boundary for all fixture routes.
	if !strings.HasPrefix(r.URL.Path, "/api/v1/access") && !strings.HasPrefix(r.URL.Path, "/api/v1/session") {
		g.local.ServeHTTP(w, r)
		return
	}
	if !boundary(w, r, g.localHost, "http://"+g.localHost) {
		return
	}
	if r.Method == http.MethodGet && r.URL.Path == "/api/v1/session" {
		writeJSON(w, 200, ControllerSession{Mode: "local", Authenticated: true})
		return
	}
	if r.Method == http.MethodGet && r.URL.Path == "/api/v1/access" {
		g.mu.Lock()
		defer g.mu.Unlock()
		writeJSON(w, 200, g.accessLocked())
		return
	}
	if r.Method != http.MethodPost || (r.URL.Path != "/api/v1/access/invite" && r.URL.Path != "/api/v1/access/revoke" && r.URL.Path != "/api/v1/access/stop") {
		reject(w, 404, "not_found", "Route not found.")
		return
	}
	var req struct {
		SessionID string `json:"session_id"`
	}
	fields := []string{}
	if r.URL.Path == "/api/v1/access/revoke" {
		fields = []string{"session_id"}
	}
	if !readObject(w, r, fields, fields, &req) {
		return
	}
	if r.URL.Path == "/api/v1/access/revoke" && !idPattern.MatchString(req.SessionID) {
		reject(w, 400, "invalid_request", "A valid browser session ID is required.")
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	g.pruneLocked()
	if g.publicOrigin == "" {
		reject(w, 409, "mobile_disabled", "Configure the private mobile gateway on this Mac first.")
		return
	}
	switch r.URL.Path {
	case "/api/v1/access/invite":
		if len(g.sessions) >= maxSessions {
			reject(w, 409, "session_limit", "Remove a paired browser before creating another invitation.")
			return
		}
		var code string
		for {
			n, err := rand.Int(rand.Reader, big.NewInt(100000000))
			if err != nil {
				reject(w, 500, "random_unavailable", "Unable to create an invitation.")
				return
			}
			code = fmt.Sprintf("%08d", n.Int64())
			if g.invite == nil || code != g.invite.Code {
				break
			}
		}
		g.invite = &PairingInvite{Code: code, ExpiresAt: g.now().UTC().Add(inviteLifetime)}
		g.wrongGuesses = 0
	case "/api/v1/access/revoke":
		for hash, session := range g.sessions {
			if session.ID == req.SessionID {
				delete(g.sessions, hash)
			}
		}
	case "/api/v1/access/stop":
		clear(g.sessions)
		g.invite = nil
		g.wrongGuesses = 0
	}
	writeJSON(w, 200, g.accessLocked())
}

func (g *Gateway) serveRemote(w http.ResponseWriter, r *http.Request) {
	secureHeaders(w)
	if g.publicOrigin == "" {
		reject(w, 404, "not_found", "Route not found.")
		return
	}
	// Even an empty header means a Funnel transport was indicated. Neither
	// Funnel nor caller-supplied proxy identity is an authentication mechanism.
	for key := range r.Header {
		if strings.EqualFold(key, "Tailscale-Funnel-Request") {
			reject(w, 403, "public_transport_denied", "Public Funnel access is not supported.")
			return
		}
	}
	if !boundary(w, r, g.publicHost, g.publicOrigin) {
		return
	}
	p := r.URL.Path
	if r.Method == http.MethodGet && p == "/api/v1/session" {
		g.mu.Lock()
		session := g.sessionLocked(r)
		g.mu.Unlock()
		writeJSON(w, 200, sessionView(session))
		return
	}
	if r.Method == http.MethodPost && p == "/api/v1/session" {
		g.pair(w, r)
		return
	}
	if r.Method == http.MethodPost && p == "/api/v1/session/logout" {
		if !readObject(w, r, nil, nil, &struct{}{}) {
			return
		}
		g.mu.Lock()
		if hash, ok := cookieHash(r); ok {
			delete(g.sessions, hash)
		}
		g.mu.Unlock()
		http.SetCookie(w, &http.Cookie{Name: cookieName, Value: "", Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1, Expires: time.Unix(1, 0).UTC()})
		writeJSON(w, 200, sessionView(nil))
		return
	}
	if isStatic(r) {
		g.delegate(w, r)
		return
	}
	if !isProtected(r) {
		reject(w, 404, "not_found", "Route not found.")
		return
	}
	g.mu.Lock()
	authorized := g.sessionLocked(r) != nil
	g.mu.Unlock()
	if !authorized {
		reject(w, 401, "authentication_required", "Pair this browser from your Mac to continue.")
		return
	}
	g.delegate(w, r)
}

func (g *Gateway) delegate(w http.ResponseWriter, r *http.Request) {
	forward := r.Clone(r.Context())
	forward.Host = g.localHost
	forward.URL.Host = g.localHost
	forward.URL.Scheme = "http"
	if len(forward.Header.Values("Origin")) == 1 {
		forward.Header.Set("Origin", "http://"+g.localHost)
	}
	for key := range forward.Header {
		lower := strings.ToLower(key)
		if lower == "forwarded" || strings.HasPrefix(lower, "x-forwarded-") || strings.HasPrefix(lower, "tailscale-") || lower == "cookie" {
			forward.Header.Del(key)
		}
	}
	g.local.ServeHTTP(w, forward)
}

func isStatic(r *http.Request) bool {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return false
	}
	p := r.URL.Path
	if p == "/" || p == "/index.html" || p == "/favicon.ico" || p == "/favicon.svg" {
		return true
	}
	if strings.HasPrefix(p, "/fonts/") {
		return path.Ext(p) == ".woff2"
	}
	if !strings.HasPrefix(p, "/assets/") {
		return false
	}
	switch path.Ext(p) {
	case ".js", ".css", ".woff2", ".png", ".svg", ".ico":
		return true
	}
	return false
}

func isProtected(r *http.Request) bool {
	p := r.URL.Path
	if r.Method == http.MethodGet && p == "/api/v1/workspace" || r.Method == http.MethodPost && (p == "/api/v1/tasks" || p == "/api/v1/control") {
		return true
	}
	if !strings.HasPrefix(p, "/api/v1/tasks/") {
		return false
	}
	parts := strings.Split(strings.TrimPrefix(p, "/api/v1/tasks/"), "/")
	if !idPattern.MatchString(parts[0]) {
		return false
	}
	return r.Method == http.MethodGet && (len(parts) == 1 || len(parts) == 2 && parts[1] == "artifact") || r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "actions"
}

func (g *Gateway) pruneLocked() {
	now := g.now()
	for hash, session := range g.sessions {
		if !now.Before(session.ExpiresAt) {
			delete(g.sessions, hash)
		}
	}
	if g.invite != nil && !now.Before(g.invite.ExpiresAt) {
		g.invite = nil
		g.wrongGuesses = 0
	}
}

func (g *Gateway) accessLocked() MobileAccess {
	g.pruneLocked()
	access := MobileAccess{Enabled: g.publicOrigin != "", Sessions: make([]PairedBrowser, 0, len(g.sessions))}
	if access.Enabled {
		origin := g.publicOrigin
		access.Origin = &origin
	}
	if g.invite != nil {
		invite := *g.invite
		access.Invite = &invite
	}
	for _, session := range g.sessions {
		access.Sessions = append(access.Sessions, session)
	}
	sort.Slice(access.Sessions, func(i, j int) bool {
		if access.Sessions[i].CreatedAt.Equal(access.Sessions[j].CreatedAt) {
			return access.Sessions[i].ID < access.Sessions[j].ID
		}
		return access.Sessions[i].CreatedAt.Before(access.Sessions[j].CreatedAt)
	})
	return access
}

func cookieHash(r *http.Request) ([32]byte, bool) {
	cookies := r.CookiesNamed(cookieName)
	if len(cookies) != 1 {
		return [32]byte{}, false
	}
	value := cookies[0].Value
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil || len(decoded) != 32 || base64.RawURLEncoding.EncodeToString(decoded) != value {
		return [32]byte{}, false
	}
	return sha256.Sum256([]byte(value)), true
}

func (g *Gateway) sessionLocked(r *http.Request) *PairedBrowser {
	g.pruneLocked()
	hash, ok := cookieHash(r)
	if !ok {
		return nil
	}
	session, ok := g.sessions[hash]
	if !ok {
		return nil
	}
	return &session
}

func sessionView(session *PairedBrowser) ControllerSession {
	view := ControllerSession{Mode: "remote"}
	if session != nil {
		view.Authenticated = true
		view.Name = &session.Name
		view.ExpiresAt = &session.ExpiresAt
	}
	return view
}

func (g *Gateway) pair(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}
	if !readObject(w, r, []string{"code", "name"}, []string{"code", "name"}, &req) {
		return
	}
	if strings.TrimSpace(req.Name) != req.Name || utf8.RuneCountInString(req.Name) < 1 || utf8.RuneCountInString(req.Name) > 40 || strings.IndexFunc(req.Name, unicode.IsControl) >= 0 {
		reject(w, 400, "invalid_request", "Use the eight-digit invitation and a browser name of 1 to 40 characters.")
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.sessionLocked(r) != nil {
		reject(w, 409, "already_paired", "This browser is already paired.")
		return
	}
	if g.invite == nil {
		reject(w, 401, "invalid_invitation", "Invitation unavailable. Create a fresh code on your Mac.")
		return
	}
	if !codePattern.MatchString(req.Code) || subtle.ConstantTimeCompare([]byte(req.Code), []byte(g.invite.Code)) != 1 {
		g.wrongGuesses++
		if g.wrongGuesses >= 5 {
			g.invite = nil
		}
		reject(w, 401, "invalid_invitation", "Invitation unavailable. Check the code on your Mac.")
		return
	}
	if len(g.sessions) >= maxSessions {
		reject(w, 409, "session_limit", "Remove a paired browser on your Mac before pairing another.")
		return
	}
	var tokenBytes [32]byte
	var idBytes [16]byte
	if _, err := rand.Read(tokenBytes[:]); err != nil {
		reject(w, 500, "random_unavailable", "Unable to create a browser session.")
		return
	}
	if _, err := rand.Read(idBytes[:]); err != nil {
		reject(w, 500, "random_unavailable", "Unable to create a browser session.")
		return
	}
	token := base64.RawURLEncoding.EncodeToString(tokenBytes[:])
	now := g.now().UTC()
	session := PairedBrowser{ID: base64.RawURLEncoding.EncodeToString(idBytes[:]), Name: req.Name, CreatedAt: now, ExpiresAt: now.Add(sessionLifetime)}
	g.sessions[sha256.Sum256([]byte(token))] = session
	g.invite = nil
	g.wrongGuesses = 0
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: token, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: int(sessionLifetime.Seconds()), Expires: session.ExpiresAt})
	writeJSON(w, 200, sessionView(&session))
}
