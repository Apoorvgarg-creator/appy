# Local foundation implementation

Implemented **14 October 2026** as a small development slice supporting M0. This is the first executable application behind the approved interface. It does not complete M0's hardware/model evaluation or M1's trusted enrollment and remote observation gates.

The [mobile controller extension](16-mobile-controller.md) adds an optional, separate paired-browser gateway. Port 8787 remains the trusted local interface described below.

## What runs

The React controller talks to a Go service on `127.0.0.1:8787`. Start with an empty workspace, label a task, review its fixed scope, and run the bundled Example Notes repository analysis. The runner inventories embedded files and produces a deterministic Markdown report. It never treats the label as code, a path, a URL, or a tool instruction.

Task state, events, idempotency records, and report previews are persisted locally. Approval makes the exact preview a downloadable result; it does **not** authorize its first persistence. The plan explicitly includes preview/history storage. Pause, resume, cancel, deny, expiry, refreshed review and Stop all are implemented. Re-enabling admission never revives cancelled tasks.

## Code and contract ownership

| Path | Responsibility |
| --- | --- |
| `web/src/` | React interface, native dialogs, polling and explicit retry handling |
| `web/public/fonts/` | Local Inter fonts and their license |
| `cmd/appy/` | Loopback service and runner lifecycle |
| `Start Appy.command`, `scripts/start.mjs` | Mac entry point, startup checks, browser opening and child-process cleanup |
| `internal/hub/` | HTTP boundary, durable state machine, fixture runner and tests |
| `internal/mobile/` | Optional paired-browser sessions, private gateway and security tests |
| `internal/hub/fixture/` | Embedded, synthetic inputs; never user-selected files |
| `contracts/openapi.json` | Authoritative HTTP payloads and lifecycle semantics |
| `web/src/generated/api.ts` | Derived types; regenerate with `npm run generate` |
| `cmd/contractcheck/`, `scripts/` | Real-handler schema checks and development tooling |

Change the contract before consumer/provider changes. `npm run check:contract` rejects stale generated types. The local schema checker supports only the contract's used subset and rejects unsupported assertions; it is not a general OpenAPI implementation. Actual handler responses are validated through creation, progress, approval, download and rejected requests.

## Run and contribute

Use macOS or Linux with Go 1.25+, Node 22.18+, and npm. The process lock currently uses Unix APIs; Windows service support is not implemented.

```sh
npm ci --ignore-scripts
make build
npm start
```

On macOS, subsequent launches can use the root `Start Appy.command` file from Finder. Both entry points locate assets and data relative to the repository, wait for this child server's listening message and successful page/API responses, then open `http://127.0.0.1:8787`. Keep the launching terminal open; Control-C stops its child server. Missing builds and startup errors are printed there. A browser-opening error leaves the server available at the printed URL. The service announces its address only after acquiring the listener; bind failures leave stored task state untouched.

This address is local to the computer running Appy; iPhone/iPad access requires the separate [private HTTPS setup](16-mobile-controller.md). `make build` creates `web/dist/` and `bin/appy`; `make run` rebuilds and launches; `make check` runs contract/type/vet checks; `make test` runs Go race tests plus contract, retry, session and launcher tests. Go code uses `gofmt`. Frontend files use two-space indentation and strict TypeScript. The repository retains the original `AGENTS.md` unchanged.

For live frontend editing, start `go run ./cmd/appy`, then `npm run dev` in another terminal. Use `127.0.0.1`, not an alternate hostname. Vite's development proxy accepts the expected local Origin; the built application uses one origin directly.

## Storage and recovery decision

This slice deliberately uses a bounded JSON snapshot rather than the proposed production PostgreSQL/outbox system. It keeps the local workflow runnable without infrastructure while exercising the state machine. This is **not** a production database or tamper-evident audit log.

The service acquires an exclusive process lock, requires a private data directory, writes a mode-0600 temporary snapshot, syncs it, atomically renames it, and syncs the directory. Mutations and runner ticks share a mutex. Failed persistence does not acknowledge a change or advance memory. Uncertain publication blocks further writes until restart. Corrupt, incomplete or unsupported snapshots fail startup instead of silently resetting data.

On restart, queued/running tasks become paused; pending approvals expire. Explicit resume or fresh review is required. Limits are 1,000 tasks, 10,000 idempotency records and 64 MiB per snapshot. Reaching a limit returns an error. There is no pruning or migration command yet. Local data is plaintext, protected by filesystem permissions, and excluded from version control. Use synthetic task labels and stop the service before copying its data directory.

## Implemented request boundaries

The CLI refuses nonloopback addresses. HTTP checks Host, Origin and Fetch Metadata; mutations require JSON, a bounded body and an idempotency key. Unknown, duplicate, missing, null and incorrectly typed fields are rejected. Task actions require the current revision; approvals also require the current ID and an unexpired exact-content digest. Static serving is confined to the built asset directory, with no directory listing or data-file serving. CSP, frame restrictions and no-store responses are set.

These protections support a **trusted local development service without user authentication** on port 8787. They do not establish an owner identity, protect against another process running as the same user, or justify exposing that listener through a tunnel. The optional mobile gateway has its own pairing/session boundary on port 8788. No passkeys, persistent device-key enrollment, broker/authority separation, secrets, remote device control, arbitrary execution or model routing exist yet.

The server durably deduplicates exact requests. The browser keeps uncertain-operation keys for explicit retry in memory; reloading loses pending client keys. Inspect saved tasks after a reload before submitting a new task. Revision checks still prevent duplicate task transitions. No request is automatically retried into a new effect.

## Verification and remaining work

The core has twelve Go test groups, including restart persistence, expiry, idempotency, invalid transitions, corrupt snapshots, failed writes, request guards, asset confinement and 20 cancel/completion races. The mobile extension adds fourteen security groups; both run with the race detector. Node checks cover actual local/mobile Go handler responses through approval, artifact download and revocation, schema boundaries, client/session races, configuration and startup. Launcher checks use injected process and HTTP dependencies. Strict TypeScript, `go vet`, generated-type freshness and the production frontend build are required checks.

The environment denies local TCP binds. Actual `npm start` confirms that this failure now remains visible and exits nonzero, without printing a ready message. A successful browser-opening launch still needs verification on the user's Mac. API integration uses actual Go handlers through `httptest.NewRecorder`, without a listening socket. Render-only React pages use those real response samples for desktop/phone inspection; their controls are inert. They do not prove live browser interaction, download handling, keyboard focus or mobile Safari behavior. The integrated Browser plugin also failed initialization; ECC Chrome DevTools supplies the static visual inspection.

Static evidence: [desktop Home](evidence/foundation/home-desktop.png), [phone Home](evidence/foundation/home-mobile.png), [desktop result](evidence/foundation/result-desktop.png), [phone result](evidence/foundation/result-mobile.png). The [evidence record](evidence/foundation/review.json) keeps the live-interaction gate open. ECC's evidence checker returns exit 1 for the missing live accessibility/content-state observations; the application build and automated checks pass independently.

Pending: live browser journeys on the Mac mini/iPhone/iPad, hardware inventory, adapter/model evaluation, production identity, independent protocol review and real-device tests. No production security or usability certification is claimed. Dependency installation used pinned public packages available in the local cache with lifecycle scripts disabled; no online vulnerability audit was available.

Technical references: [React client application setup](https://react.dev/learn/build-a-react-app-from-scratch), [Vite build tooling](https://vite.dev/guide/), and [Go HTTP APIs](https://pkg.go.dev/net/http). The implementation details and limits above describe this repository, not guarantees supplied by those projects.
