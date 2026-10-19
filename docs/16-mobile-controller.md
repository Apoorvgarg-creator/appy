# iPhone and iPad controller

Implemented 14 October 2026 as an opt-in extension to the fixed-fixture workflow. It provides browser pairing, task creation, report review/download, and browser revocation. It is not a native mobile agent, real Mac control, passkey enrollment, or a completed M1 security milestone. Actual Safari/Tailscale and cellular tests remain pending.

## First connection

Use the [README setup steps](../README.md#connect-your-iphone-or-ipad). The Mac and phone must be connected to the same private Tailscale network, with access rules limited to the intended owner/devices. Check `tailscale serve status` before changing an existing configuration. The initial command runs Serve in the foreground:

```sh
tailscale serve --https=443 http://127.0.0.1:8788
```

Copy its HTTPS address without a trailing slash. In the repository's terminal:

```sh
npm run mobile -- https://mac-mini.your-tailnet.ts.net
make run
```

Replace that example address with the one Serve actually prints. `npm run mobile` only saves the hostname in ignored `.data/mobile-origin`; it does not install software, enroll devices, configure a VPN, or expose a port. `APPY_MOBILE_ORIGIN` can override the saved value; an explicitly empty value disables mobile access for that launch. The CLI also accepts `-mobile-origin` directly. Invalid origins fail before listening or opening the task store.

On the Mac, choose **Runner → Connect a phone**. Create one invitation, then enter its eight digits and a recognizable browser name in Safari on the phone. Repeat with a new invitation for the iPad. The private address contains no secret. Invitations and session tokens never belong in URLs, screenshots shared with others, or logs.

Serve terminates HTTPS and forwards to `127.0.0.1:8788`. Appy still binds only to loopback. Port `8787` is the trusted local administration interface and must never be a proxy target. Serve keeps the service inside the private network; do not configure Funnel. Appy rejects requests marked as Funnel traffic. Current Serve preserves the external Host header, which Appy checks exactly. Appy does not authenticate using forwarded identity headers. [Serve](https://tailscale.com/docs/features/tailscale-serve), [CLI](https://tailscale.com/docs/reference/tailscale-cli/serve), [proxy implementation](https://github.com/tailscale/tailscale/blob/main/ipn/ipnlocal/serve.go).

HTTPS certificate issuance publishes the machine hostname and tailnet domain in Certificate Transparency logs. Choose a non-sensitive machine name before enabling HTTPS. The certificate does not make the private service publicly reachable. [Tailscale HTTPS](https://tailscale.com/docs/how-to/set-up-https-certificates).

This first transport uses Tailscale's service; it is not a fully self-hosted networking deployment. A self-hosted overlay/certificate option remains a separate roadmap task. No router forwarding, self-signed certificate bypass, or system permission changes are part of this implementation.

## Access lifecycle

An invitation lasts five minutes, is single-use, and is replaced when the Mac generates another. Five incorrect guesses invalidate it across all requesters, rather than giving each IP a fresh budget. Creation, attempts, redemption, and expiry share a mutex. Pairing never automatically retries; an uncertain response triggers a session-status read first.

Each successful pairing receives a cryptographically random 32-byte bearer token in a `__Host-appy_session` cookie: Secure, HttpOnly, SameSite=Strict, Path=/, and no Domain. Only its SHA-256 hash is retained in memory. Sessions last eight hours, with at most eight active browser sessions. Restarting Appy clears all invitations and sessions. Device names are user-entered labels, not verified hardware identities.

Use **Disconnect** beside a browser, **Disconnect all** on the Mac, or **Disconnect this browser** on the phone. Revocation denies subsequent request admission; a request already admitted may finish, and tasks already accepted continue. Use **Stop all** to cancel task work. These are distinct actions.

Pairing administration exists only on the local listener. Remote requests require an exact configured Host; POST requests also require a single exact HTTPS Origin and JSON. Workspace, tasks, control actions, and artifact downloads require a live session. Unknown routes, encoded path alternatives, cross-site metadata, ambiguous cookies, and proxy identity claims do not bypass those checks. Static application assets and session status remain public within the private network.

The frontend clears pending operation keys and unmounts the workspace when it observes a 401 or a revoked/expired session. Logout closes the workspace while confirmation is pending. There is no service worker, private-data cache, browser-token storage, offline command queue, or automatic replay of pairing changes. Existing task mutations retain their durable idempotency behavior.

Local software running on the Mac remains trusted in this foundation. A compromised Mac or stolen session cookie is outside the protection provided by pairing alone. Independent review, passkeys, persistent device identity, recovery, transport verification, and production isolation remain open. [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Daily use and recovery

The saved hostname is reused by `npm start` and the Mac launcher. Keep Appy, Serve, and the Mac awake for initial testing. Neither this code nor an open Safari tab guarantees wake after sleep or recovery after encrypted reboot.

If Safari cannot connect, check Tailscale on both devices, the exact HTTPS hostname, the Mac's availability, and `tailscale serve status`. A 502 usually means the gateway is not running on port 8788. A Host rejection usually means the saved hostname differs from the visited address. If a code fails, check the current Mac invitation; replacement, expiry, or the attempt limit can invalidate it. A restart requires pairing again.

To disable mobile access, disconnect all browsers, run `npm run mobile -- off`, and restart Appy. Stop the foreground Serve process with Control-C. Do not use a global Serve reset if it would remove unrelated services. Appy remains available locally.

Begin with Safari. Home Screen behavior is a separate acceptance item: WebKit copies Safari cookies into a newly added web app on supported versions, after which storage is separate. A copied Appy session still refers to the same server-side session and revocation affects both copies. This is not independent device enrollment. [WebKit behavior](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/).

## Verification

Automated checks exercise real Go handlers without opening sockets: create an invitation, pair, create/start a fixture task, approve it, verify exact artifact bytes, revoke the browser, and deny its subsequent download. Contract checks validate serialized responses. Go race tests cover concurrent redemption, guess limits, expiry, rotation, session caps, restart, revocation, input parsing, and boundary bypass attempts. Client tests cover lost pairing responses, no automatic pairing retries, stale-session responses, and pending-key cleanup.

The execution environment denies TCP binds, so these are not live HTTPS, Safari, or cellular results. Complete the following on the physical devices before claiming mobile support is validated:

- [ ] Pair iPhone and iPad independently; confirm task/review/download through Safari.
- [ ] Switch iPhone from Wi-Fi to cellular; reload and confirm the saved task without duplicate actions.
- [ ] Disconnect a browser on the Mac; verify subsequent reads, writes, and downloads are denied.
- [ ] Close Safari during a running task; reopen and confirm the Mac continued it.
- [ ] Test code expiry, five wrong guesses, session expiry, logout, and restart.
- [ ] Test keyboard, rotation, text zoom, VoiceOver, safe areas, and iPad split view.
- [ ] Verify tailnet access rules, HTTPS certificate/hostname, and that port 8787 has no forwarding path.
- [ ] Record device models, OS/browser versions, transport version, outcomes, and failures.

Current checks pass: 26 Go race-test groups, 23 Node client/contract/configuration checks, generated types, TypeScript, `go vet`, and production build. Render-only Chrome inspection at 390×844 and 834×1194 found no horizontal overflow; pairing controls are 48px high and Inter loaded. These are inert views, not live device results: [phone pairing](evidence/mobile/pair-phone.png), [tablet pairing](evidence/mobile/pair-tablet.png), [Mac invitation content](evidence/mobile/invite-desktop.png), [evidence record](evidence/mobile/review.json).
