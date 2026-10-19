# Research findings and architecture decisions

Research checked on **14 October 2026** against primary project documentation, operating-system documentation and specifications. API availability, distribution rules and licenses must be checked again at the exact revisions selected for implementation. Recommendations and performance targets in this package are engineering proposals, not measured product capabilities.

## Findings that change the plan

1. Persistent agents are a useful interaction pattern, but hosted products are not the only implementations. OpenClaw already includes local/paired computer control. Evaluate integration before building another full runtime. [OpenClaw computer use](https://docs.openclaw.ai/nodes/computer-use).
2. The desktop session is an important boundary. A background daemon's availability does not imply it can capture or control a logged-in user's desktop. [Apple launchd](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html), [Windows interactive services](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services).
3. Stock mobile operating systems and distribution rules prevent a credible universal-control promise. Start mobile as a controller. [Apple runtime security](https://support.apple.com/en-au/guide/security/sec15bfe098e/web), [Google Play Accessibility policy](https://support.google.com/googleplay/android-developer/answer/10964491).
4. Open-weight inference does not itself make tool use safe. The model/runtime must not own credentials, policy keys or an unrestricted shell on the host. [OWASP prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
5. A private network and encrypted transport do not replace device authorization or trustworthy controller code. [WebRTC security architecture](https://www.rfc-editor.org/rfc/rfc8827).
6. A shared logged-in browser can carry more authority than a secret's plaintext. Constrain the account and operations, not only where a password is displayed. This is a design inference from the credential and desktop trust boundaries, not a claim that masking is useless.

## Reuse candidates

| Candidate | Verified role and license indication | Proposed decision |
| --- | --- | --- |
| [OpenClaw](https://github.com/openclaw/openclaw) | Personal agent runtime; MIT | M0 integration candidate. Require all effects to pass through Appy's broker; no independent bypassing tool path |
| [Cua](https://github.com/trycua/cua/blob/main/LICENSING.md) | Driver/SDK/Lume generally MIT; Spaces and Driver Bench contain FSL-1.1-MIT components | Evaluate specific MIT packages. Do not assume all desktop/fleet/streaming components are open source |
| [MeshCentral](https://github.com/Ylianst/MeshCentral) | Remote management with desktop, terminal and files; Apache-2.0 | Compare for human takeover and enrollment; inspect its privilege model |
| [RustDesk](https://github.com/rustdesk/rustdesk) | Self-hostable remote desktop; AGPL-3.0 | Optional separately evaluated integration; review distribution obligations before adopting |
| [Headscale](https://github.com/juanfont/headscale) | Self-hosted coordination for a personal/small-organization network; BSD-3-Clause | Initial private-network candidate; test pinned client compatibility and relay configuration |
| [NetBird](https://github.com/netbirdio/netbird) | WireGuard networking; BSD-3-Clause with AGPLv3 management/signal/relay components | Alternative if onboarding/ACL experience wins; review selected components |
| [Sunshine](https://github.com/LizardByte/Sunshine) / [Moonlight Qt](https://github.com/moonlight-stream/moonlight-qt) | Low-latency host/client streaming; GPL-3.0 | Benchmark takeover latency; not an agent authorization system |
| [llama.cpp](https://github.com/ggml-org/llama.cpp), [MLX LM](https://github.com/ml-explore/mlx-lm), [vLLM](https://github.com/vllm-project/vllm) | Local inference runtimes with different hardware/model support | Portable baseline plus optional optimized providers; pin complete runtime/model combination |
| [OpenBao](https://openbao.org/docs/concepts/lease/) | Self-hosted secret infrastructure with dynamic leases | Optional backend after a simple local broker; avoid a mandatory server for every personal install |

The table is a technical screening, not a legal compatibility determination. Inspect package-specific licenses, transitive dependencies and exact model artifacts before redistribution. Process separation alone does not settle license obligations. Never equate source-available FSL components with an OSI open-source license.

## Proposed decisions and reversal conditions

| Decision | Reason | Revisit when |
| --- | --- | --- |
| D01: Isolated Linux guest for effectful tools | Separate workspace on the available Mac mini; host virtualization must be validated | Guest support/capacity fails or another design demonstrates the required boundaries |
| D02: One owner | Keeps identity, vault and inference isolation tractable | Single-owner release gates pass and a separate multi-user threat model exists |
| D03: Overlay-required controller | Reduces exposed service surface and custom relay work | User research proves VPN setup prevents adoption; browser-only transport is audited |
| D04: Local-only inference default | Keeps authorized context on selected owner devices | Owner explicitly chooses a hosted provider with destination-specific consent |
| D05: API/semantics before pixels | More precise targets, authorization and outcome checks | Application provides no adequate semantic interface |
| D06: Broker outside the model | Prompt instructions cannot reliably enforce authority | This is a security invariant, not a model-quality tradeoff |
| D07: Web controller trusted in v1 | Faster usable product, explicit trust boundary | Signed native approval companion is funded and reviewed |
| D08: Build one transport integration | Avoid multiple security/admin stacks | Measured platform limitations justify another supported path |
| D09: No unrestricted plugins in beta | Plugin code and tool descriptions expand authority | Sandboxed plugin capabilities, update trust and adversarial tests are ready |

## Evidence map

Technical source links are placed beside their claims throughout the package:

- [Platform feasibility](03-platforms.md): XDG portals, PipeWire access, input, Linux controls, macOS permissions, Windows integrity/session limits, Android/iOS constraints.
- [Architecture](02-architecture.md): Headscale, WebRTC, model/runtime candidates and inference hardening.
- [Security](04-security.md): authorization, untrusted observations, TLS scope, sandbox boundaries, logging, Sigstore and TUF.
- [Credentials](05-credentials.md): OAuth Security BCP, short-lived delegation, static/dynamic secret distinction.
- [Testing](08-testing.md): OSWorld and adversarial permission testing.

Primary documentation establishes available mechanisms, not that our integration works. Each integration needs an executable spike and a recorded support matrix.

## Unresolved before real-device implementation

- Mac mini chip/RAM/macOS, uplink, CGNAT and power-loss behavior. Device ownership is confirmed: Mac mini, MacBook, iPhone and iPad; no Linux GPU box.
- Which three workflows deliver enough value to justify setup; which require native desktop access.
- Whether OpenClaw/Cua integration can enforce a single non-bypassable action boundary without a large fork.
- Model choice and latency on actual hardware; required vision support and acceptable failure/approval rate.
- Secret-store unlock and recovery tradeoffs for the Mac mini hub.
- Project name, license, maintainer availability, security review budget and public vulnerability-reporting destination.

These become M0 tasks rather than hidden assumptions in implementation.
