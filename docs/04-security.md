# Security design and threat model

**Status: unimplemented proposal.** These controls are requirements for Appy's first release, not guarantees about software that exists today. The target is bounded authority, observable execution, and testable isolation. No design can promise perfect security or zero leaks. See [architecture](02-architecture.md), [credential workflows](05-credentials.md), and [testing gates](08-testing.md).

## Scope, assets, and adversaries

V1 serves one owner across a small enrolled fleet. Agent execution defaults to a disposable Linux VM. Protect device identities, approval keys, account sessions, credentials, source files, screenshots, model context, task integrity, artifacts, availability, and the owner's home network.

| Adversary or failure | Security objective |
| --- | --- |
| Malicious website, document, screenshot, or model output | Cannot create authority or bypass tool policy |
| Compromised scheduler or runtime adapter | Cannot sign grants, change local ceilings, or access credentials |
| Network observer or malicious relay | Cannot impersonate enrolled application peers or read protected traffic |
| Stolen controller session | Limit access duration and scope; support revocation |
| Malicious plugin or workspace process | Contain filesystem, network, credential, and host access |
| Compromised release channel | Reject unauthorized artifacts and rollback attempts |
| Crash, reconnect, stale screen, or duplicate delivery | Avoid unintended actions and duplicate external effects |

An inference host that receives screenshots can read them. A compromised owner endpoint, worker host kernel, hypervisor, credential broker, or authorized external application can defeat relevant protections. Physical compromise and denial of service remain residual risks.

## Explicit trust boundaries

V1 trusts the delivered PWA code, its delivery domain, the grant authority, and the owner's browser. A compromised web server can falsify approval details or serve malicious JavaScript. Passkeys authenticate a user; they do not establish that the page displays an honest transaction. A signed native companion with an independent approval display is a later improvement.

The scheduler and grant authority require separate OS principals, keys, storage permissions, and IPC access. The worker broker pins an owner-enrolled authority key and enforces a separately installed maximum policy. Ordinary task APIs cannot change this ceiling. A compromised authority can still issue malicious grants **within** that ceiling; describe this limit openly.

The execution VM does not administer its host. The inference service receives permitted context, but no grant keys, vault tokens, or broker sockets. An arbitrary borrowed browser is not equivalent to a trusted controller.

## Enforceable invariants

1. Every effect requires an authenticated, typed request, a valid grant, and a fresh execution lease.
2. Models, retrieved content, schedules, and remembered preferences cannot authorize scope changes.
3. The broker checks device, session, task, operation, resources, destination, budgets, policy version, expiry, and revocation before dispatch.
4. Unknown verbs, unexpected fields, invalid signatures, broader delegation, and unsupported isolation fail closed.
5. Durable operation IDs prevent replay across reconnects and restarts; uncertain external outcomes require reconciliation.
6. A single fenced owner controls desktop input. Takeover suspends agent input before human input starts.
7. Secrets do not enter model prompts, ordinary tool results, or telemetry; credential access goes through a separate broker.

Treat prompt injection as an expected input condition. Detection and redaction help, but hard permissions belong at the tool boundary. [OWASP prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

## Enrollment, identity, and recovery

Initial installation requires local owner presence. Generate each worker key locally, store it using available OS protection, and display a device fingerprint. Use a cryptographically random enrollment challenge of at least 128 bits, bound to the owner and worker public key, expiring after five minutes. Short displayed codes are comparison aids, never sole bearer authorization. Approve from an already trusted owner session and compare the fingerprint through the local display. Allow at most five failed attempts per challenge, rate-limit enrollment globally, invalidate on completion, and prevent concurrent claims. These values are proposed protocol requirements.

Keep owner identity, controller sessions, scheduler credentials, worker certificates, and inference credentials distinct. Network addresses and device names are not identities. Use maintained TLS and signing libraries rather than a new cryptographic protocol.

Enrollment, authority-key replacement, recovery changes, and local policy expansion require a separate administrative ceremony. Provide offline recovery material and test replacement of a lost controller. Recovery must invalidate old credentials and sessions; it must not create an undocumented permanent bypass.

## Permission modes and approval integrity

| Mode | Allowed boundary | Required restraint |
| --- | --- | --- |
| Observe | Approved files, windows, and application observations | No intentional writes; authenticated reads may still have side effects |
| Workspace | Explicit operations within an isolated VM | Restricted mounts, accounts, destinations, budgets, and duration |
| Host session | Later supervised dedicated-account desktop access | Separate consent; existing logins make permissions much broader |

Externally consequential actions require an exact-action approval unless already covered by a narrow explicit grant. Show destination, affected object, concrete change, credential use, and scope. Bind approval to canonical arguments and target identity, not just a natural-language summary. Single-action approvals expire and cannot be reused. [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html).

Prevent time-of-check/time-of-use errors: reacquire UI targets and origins, reject changed arguments, and use handle-based file operations and atomic commits where possible. If the scene or destination changed, pause and reapprove. Arbitrary desktop input cannot reliably enforce a semantic rule such as “draft but never send” inside an authenticated application; use a constrained API adapter or human takeover.

## Leases, revocation, and stopping

Proposed requirements: execution leases last at most **30 seconds**, renew approximately every **10 seconds**, and never extend the owner grant. Renewals need a live authenticated challenge; they cannot be stockpiled. Bind leases to a boot/session epoch and suspend-inclusive elapsed time, or invalidate them on resume. Restarting requires a fresh lease.

At lease expiry, stop admitting new broker actions and input. A host-side watchdog terminates managed processes within **35 seconds after the last valid renewal** in the reference environment; already-running operations may still produce effects before termination. Recheck authorization before each step and at available commit points. Tests must cover network loss, clock rollback, broker failure, suspend/resume, reboot, and stale queued messages.

Show stop states honestly: requested, received, stopping, stopped, or unconfirmed. A remote request cannot immediately reach an offline worker. Stopping does not reverse an uploaded file or sent message. Externally launched jobs need their own cancellation adapter and acknowledgement; otherwise their status remains unknown. Never blindly retry a consequential action after an ambiguous response.

## Networking and encryption claims

Use a private WireGuard overlay with self-hosted Headscale and DERP fallback. Workers need no home router port forwarding; a reachable coordinator/relay may require an owner-operated VPS. Configure explicit peer/port ACLs, no default LAN subnet route, and independent application authentication. Headscale targets personal and small-organization networks. [Headscale](https://headscale.net/stable/).

| Layer | Protected path | Remaining trust |
| --- | --- | --- |
| HTTPS | Browser to TLS endpoint | Endpoint and delivered JavaScript |
| WireGuard | Enrolled network peers | Enrollment and application authorization |
| Application mTLS | Authenticated service peers | Each endpoint and its permissions |
| WebRTC | Authenticated media/data peers | Signaling identity and browser implementation |

DERP forwards WireGuard-encrypted packets but observes traffic metadata. Audit relay configuration and client-verification failure behavior; a self-hosted relay does not automatically remove all third-party infrastructure. [DERP configuration](https://headscale.net/stable/ref/derp/).

Do not claim end-to-end content secrecy from a gateway that terminates the content session. WebRTC signaling fingerprints need independent identity binding; encrypted transport alone does not prevent malicious signaling or client code. [WebRTC security architecture](https://www.rfc-editor.org/rfc/rfc8827.html).

## Workspace, egress, and inference isolation

Default to a KVM/QEMU Linux VM with a dedicated account, minimal workspace mounts, no owner home directory, and no host administration sockets. Enforce egress outside the guest. Allow destinations per adapter; check redirects, DNS changes, IPv6, loopback, link-local, and private ranges. A generic HTTP tunnel or unrestricted DNS can undermine a destination allowlist.

Containers, seccomp, cgroups, namespaces, and LSMs provide useful layers, but do not justify a blanket host-isolation claim. Linux explicitly distinguishes syscall filtering from a complete sandbox. [Linux seccomp documentation](https://www.kernel.org/doc/html/latest/userspace-api/seccomp_filter.html).

Separate private-data workflows from unrestricted browsing. Allowed destinations can still receive leaked data through legitimate APIs or authenticated UI actions. Full desktop/network access and strict non-exfiltration guarantees are incompatible.

Place inference behind an authenticated route-allowlisting gateway. Isolate internal ports, disable unnecessary plugins and dynamic loading, constrain media fetching, and pin model/runtime artifacts. GPU access and containers alone do not protect secrets. vLLM warns that its API-key option does not cover every sensitive endpoint. [vLLM security](https://docs.vllm.ai/en/latest/usage/security/).

## Privacy, audit, and updates

Proposed defaults: no persistent screen video, task-selected artifacts only, and 30-day structured audit retention. Record actor, operation, grant, policy, destination reference, decision, outcome, and stop acknowledgements. Exclude tokens, cookies, clipboard contents, raw prompts, and unrestricted arguments. Document backup retention and deletion separately. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

Encrypt stored artifacts, authenticate downloads, and use short-lived access grants. Redact before sending observations to inference; uncertain masking should pause capture. Hash-chained logs need independently retained checkpoints to detect rewriting and cannot prove a compromised host reported truthfully.

Verify signed release artifacts against expected identity, issuer, and digest; publish provenance and dependency inventories. Use a maintained TUF-compatible updater with expiration, version checks, and key rotation. Test malicious releases, rollback, freeze, and recovery. Signatures establish provenance, not absence of vulnerabilities. [Sigstore verification](https://docs.sigstore.dev/cosign/verifying/verify/), [TUF specification](https://theupdateframework.github.io/specification/latest/).

## Assurance and release gates

Before remote writes, require independent protocol review and negative tests for replay, scope escalation, approval substitution, path races, credential leakage, and stop expiry. Before beta, complete focused penetration testing, resolve release-blocking findings, exercise recovery, and publish residual risks. Record exact tested builds and environments. [Testing plan](08-testing.md) defines measurable gates; passing them is evidence within a stated scope, never proof of perfect security.
