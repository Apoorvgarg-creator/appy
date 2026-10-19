# Testing and release assurance

The full remote device-control system is not implemented or security-certified. The [local foundation](14-local-foundation.md) has Go race tests, real-handler contract checks and client retry tests, runnable with `make test`. This document defines the broader evidence needed to release the system. No finite test suite proves absence of vulnerabilities; the objective is to establish specific, bounded security properties and detect regressions.

## Test layers and tools

| Layer | Proposed tooling | Evidence |
| --- | --- | --- |
| Policy and protocol | Rust unit/property tests, cargo-fuzz; Go tests/fuzzing | Denial matrix, parser robustness, replay and budget properties |
| Web application | Vitest, Playwright, axe-core | Task/approval flows, authentication, browser security and accessibility |
| Runtime integration | pytest with deterministic fake models and tool fixtures | Same broker rules regardless of model output |
| Native adapters | XCTest, Windows test harness, Linux compositor fixtures | Capture/input, permissions, sessions and display lifecycle |
| Security analysis | Semgrep/CodeQL where supported, dependency audit, secret scan, SBOM review | Findings, triage and fixed dependency revisions |
| Deployment and chaos | Disposable VMs, packet-loss/fault harness, controlled test router | Recovery, stop bounds, persistence and network isolation |
| Agent evaluations | Task-specific assertions plus isolated OSWorld scenarios | Output correctness, latency, intervention and unsafe proposals |

The full tooling matrix is planned; current Go and Node tests are described in the local foundation guide. Use direct state assertions or independent outcome checkers rather than letting the same model grade its own success. OSWorld provides real computer task infrastructure; it does not validate Appy's security. [OSWorld](https://github.com/xlang-ai/OSWorld).

## Security invariants and negative tests

| ID | Invariant | Adversarial test | Required outcome |
| --- | --- | --- | --- |
| S01 | Only enrolled owner/device identities act | Wrong certificate, controller, device/task ID; revoked sessions; guessed/substituted enrollment challenge, mismatched fingerprint and concurrent claims | Denial before enrollment or tool invocation |
| S02 | Scheduler cannot create authority | Steal scheduler identity; try grant signing, policy edits, enrollment, broker binary replacement | Denied by OS and broker boundaries |
| S03 | Issuer cannot exceed local ceiling | Issue validly signed broader grant | Worker refuses it; document issuer abuse possible within ceiling |
| S04 | An approval binds the exact effect | Substitute recipient, bytes, path, origin, adapter or policy after approval | Reject and require fresh review |
| S05 | Effects cannot replay | Repeat messages; reboot; restore old journal; switch device/session | No duplicate effect; rollback detected or device re-enrollment required |
| S06 | Stop has a bounded local effect | Cut network after renewal; roll clock backward; resume from suspend; kill broker | No new broker actions/input after lease deadline; in-flight managed processes terminate within watchdog bound under healthy host |
| S07 | Workspace cannot reach host authority | Traverse paths, symlink/hardlink races, mount/socket access, inherited file descriptors | No access beyond authorized object/VM boundary |
| S08 | Data destinations are constrained | IPv4/IPv6, DNS tunneling, rebinding, redirects, alternate ports, WebSockets, cloud metadata, local file/media URIs | Denied where policy forbids; exact allowed destinations documented |
| S09 | Secrets do not enter agent-visible channels | Canary passwords/tokens in vault, login, exception, crash, tracing and backups | No canary in model input, logs, recordings or exported artifacts |
| S10 | Untrusted content cannot expand permission | Injection in websites, OCR, PDFs, repository instructions, memory and tool results | Same hard limits; malicious proposal logged and blocked |
| S11 | One controller owns a desktop | Agent races human takeover; stale run resumes typing | Only current fence holder can inject input |
| S12 | Inference is private and bounded | Scan every bound port; unauthorized route; remote media SSRF; oversized images; malformed model output | Only allowed authenticated inference routes; no broker/vault access |
| S13 | Updates cannot replace trust silently | Wrong signer/issuer, changed digest, rollback, expired metadata, compromised mirror | Reject; recover using documented trusted path |
| S14 | Controller cannot be trivially hijacked | Stored/reflected/DOM XSS, CSRF, clickjacking, WebSocket origin, session fixation, malicious artifact | No cross-origin authorized operation or script execution |
| S15 | Credentials and artifacts remain scoped | Substitute secret reference/artifact/run/owner IDs; reuse expired download | Denied; no data in error response |
| S16 | Unknown outcomes do not duplicate effects | Disconnect after external commit but before response | Mark unknown, reconcile, never blindly retry |

Every invariant needs positive and negative cases. For S06 measure time from the last **worker-accepted** renewal, not from the user's button press. Reject prefetched renewals, use suspend-inclusive timing or invalidate on resume, and require fresh authorization after boot. In-flight commands can produce side effects between admission expiry and watchdog termination; test that interval explicitly. Stop all cannot undo an external action already committed, and a compromised kernel can defeat the local watchdog.

S08 has a fundamental limit: allowing arbitrary writes to an authenticated website may itself allow exfiltration on that domain. Domain filtering cannot enforce application semantics. Narrow connectors, dedicated accounts, removed sensitive data and human review provide stronger boundaries than whole-desktop control.

## Credential and prompt-injection corpus

Create fake OAuth providers, password-only sites and storage services. Inject canary credentials into cookies, DOM attributes, hidden nodes, debug messages, tool arguments, exception paths and screenshots. Collect test traces in an isolated test environment; scan all permitted outputs and crash artifacts.

Use malicious instructions that attempt to reveal secrets, install a plugin, change policy, invoke an unapproved URL, route context to a hosted model or impersonate an approval. Include visually hidden text and screenshots because prompt injection is not limited to HTML. The pass criterion is enforced denial, not the model saying it ignored the instruction. [OWASP prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

Also test false positives: normal files, legitimate Unicode paths, expected redirects and safe tasks must still work. Record unsafe proposals separately from executed unauthorized effects.

## Functional and platform matrix

For each supported OS/build, test fresh installation, permission denial, revocation during action, screen lock, logout, sleep, reboot, display hotplug/scaling, multiple windows, stale accessibility nodes and competing human input. macOS and Windows require actual supported hosts; Linux-only CI cannot establish their behavior.

Network profiles include local LAN, cellular, CGNAT, IPv6, UDP blocked with relay fallback, captive portal, packet loss, hub restart and home router outage. Also test that closing or disconnecting the controller does not stop a valid bounded task while worker–authority communication continues. On a captive portal, explain the network problem instead of weakening certificate validation.

Resource faults include disk full, database unavailable, memory pressure, model OOM, inference timeout, corrupted checkpoint, artifact checksum failure and clock skew. Queues remain bounded; failures never increase permission.

## Evaluation and performance targets

Use 20 versioned workflows with five independent runs each on a declared hardware/runtime/model matrix. Score artifact correctness, expected side effects, human interventions, denied unsafe attempts, total duration, peak memory and p50/p95 action latency. Publish denominators and failures; exclude neither blocked nor expensive runs silently.

Initial proposed targets:

- At least 90 of 100 runs complete the intended workflow; zero unauthorized effects in the suite.
- Stop acknowledgement within two seconds at p95 on reachable reference workers; 30-second execution lease and 35-second watchdog bounds under the defined failure model.
- Successful hub/worker restart without losing accepted task records or replaying consequential actions.
- 72-hour soak before private alpha; seven-day soak before public beta, including repeated network/worker failures.
- Mobile layout at 390 px and desktop at 1440 px, keyboard-only task/approval flow, and no serious/critical automated accessibility findings, followed by manual review.

The model corpus is a reliability sample, not statistical proof of universal safety. Add real regressions as fixtures after every incident.

## CI and release gates

Every change runs formatting, static checks, unit tests, policy/property tests, secret scanning and affected integration tests. Security-sensitive changes require a maintainer who did not author the change. For policy validation, aim for complete decision-table coverage and mutation tests proving changed allow/deny decisions are caught; a repository-wide line-coverage percentage is not a security guarantee.

Nightly jobs run fuzzing, native hardware tests and fault scenarios. Release candidates include signed build identity, dependency/model manifests, SBOM, upgrade/restore tests and a compatibility report. A scheduled dependency scan cannot replace a release review.

Block public beta if any security invariant fails, credentials appear in a forbidden output, a supported platform can bypass a declared permission, or a relevant critical/high finding remains unresolved. Require independent review and retesting of pairing, grant enforcement, credential isolation, controller delivery and update verification. Record accepted lower-severity residual risks with an owner and expiry.

Publish a short assurance report per release: tested commit, environment, model revisions, supported capabilities, passed/failed suites, reviewed findings and limitations. A polished demo is not release evidence. Checks on this planning package are recorded separately in [artifact validation](11-validation.md).
