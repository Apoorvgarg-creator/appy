# Product plan

Appy lets an individual operate a small fleet of personally owned computers through one interface, using local model weights and inspectable automation. The first useful outcome is simple: leave the laptop at home, give a task from a trusted phone, and receive a verifiable result from a home worker.

The full capabilities below are proposed. The [local foundation](14-local-foundation.md) implements a fixed-fixture task/review/download workflow; the broader fleet wireframe remains a simulation. The first real deployment targets the owner's Mac mini, iPhone, iPad and MacBook, without requiring a Linux GPU box.

## The product opportunity

Dots and Grok Bot demonstrate persistent agents with cloud computers. Their documented workflows establish the usefulness of ongoing work and human review; Appy's proposed focus is owner-operated hardware, explicit device permissions, and interchangeable local inference. [Dots overview](https://openai.com/index/introducing-dots/), [Grok Bot overview](https://x.ai/news/introducing-grok-bot).

Open source already exists here. OpenClaw supports personal agents and paired computer-use nodes; Cua includes desktop drivers and evaluation infrastructure. We should first test whether Appy is best delivered as a policy-and-device layer around existing runtimes. “Open source” alone is insufficient differentiation. [OpenClaw](https://github.com/openclaw/openclaw), [computer-use nodes](https://docs.openclaw.ai/nodes/computer-use), [Cua](https://github.com/trycua/cua).

Our hypothesis: a clear fleet interface, reliable recovery, local inference, and understandable delegation boundaries make these components usable by AI builders who do not want to administer several independent agent systems.

## Users and concrete workflows

| User need | Example | Successful outcome |
| --- | --- | --- |
| Develop while travelling | From an iPad, ask a Linux workspace to reproduce a bug and prepare a patch | Tests, diff, artifact, and explicit approval before publishing |
| Use home compute | Queue a permitted inference or media-processing job on the Mac mini | Resource-bounded job, progress, output manifest, no laptop dependency |
| Operate desktop software | Ask a Mac worker to export a document in a dedicated account | Verified output; pause if login or an OS permission is needed |
| Maintain recurring work | Every morning summarize changes in an approved folder | Durable schedule, provenance, bounded access, no silent scope expansion |
| Take over a blocked task | View the worker from a phone and finish a login | Agent paused, observation suspended during secrets, explicit hand-back |

Interview 8–12 target users before committing to breadth. Validate whether their top tasks require desktop input at all; APIs and headless tools are usually easier to test and constrain.

## First release

- One owner and one trust domain; up to five enrolled workers as an initial test envelope.
- Self-hosted Mac mini hub with a durable task queue; additional host platforms follow their own validation.
- A disposable Linux guest for browser, file, and command workflows where the Mac supports the required isolation; separate host inference chosen after hardware measurements.
- A consented read-only Mac helper first; supervised native writes follow permission, authorization and interruption tests.
- Responsive web controller reachable through a private overlay network, with passkey authentication.
- Local model selection, bounded task budgets, schedules, approval inbox, task evidence, manual takeover, and Stop all.
- Explicit API credentials through a broker; human login for unsupported websites.
- One task controls a given desktop session at a time. Multiple isolated workspaces may run concurrently within capacity.

The alpha starts with observation and fixture accounts. Autonomous external writes enter only after authorization, replay protection, and negative tests pass.

## Later releases

Expanded Mac support and Windows native adapters; signed companion applications for stronger approval integrity; narrow multi-person sharing; optional Android lab integration; hosted coordination as an optional deployment. The protocol and essential self-hosted features remain available without a vendor account.

General iOS/iPadOS control, arbitrary root commands, autonomous account recovery, financial transfers, and unrestricted plugin marketplaces are outside the first release. Unsupported workflows return an explicit reason and a human handoff.

## Meaning of control

Offer three visible modes:

1. **Observe:** permitted resources can be read; no intentional mutation. Reading an authenticated website can itself produce server-side effects, so “observe” is not an absolute no-side-effects claim.
2. **Workspace:** act inside an isolated environment with explicit apps, mounts, destinations, and budgets. This is the default automation mode.
3. **Host session:** supervised access to a dedicated desktop account. Existing applications and logins enlarge the attack surface; UI labels and approval rules cannot fully contain arbitrary desktop input.

An agent may prepare a plan autonomously. A grant determines what it can execute. A schedule cannot grant itself new access, and learned preferences cannot become permissions.

## Success criteria

Proposed beta targets, measured on published reference hardware and a fixed workflow corpus:

- At least 90% completion of 20 representative workflows over five runs each, with no unauthorized external effects. Report interventions and partial successes separately.
- First enrolled supported Mac worker within 15 minutes for at least 8 of 10 observed testers, excluding model downloads; validate other host platforms separately.
- 72-hour unattended soak and a seven-day pilot without lost accepted tasks or duplicated committed external actions.
- Acknowledged stop on reachable reference workers within two seconds at p95; disconnected workers admit no new broker actions after lease expiry, with in-flight managed processes subject to the separate watchdog bound.
- Every effect has an attributable authorization record; every blocked task explains what would unblock it.

These are acceptance targets, not measured results. Model benchmark scores do not establish credential security or reliable completion of personal workflows.

## Open-source stewardship

Recommend Apache-2.0 for new core code and a documented contribution process; select the actual license before accepting outside contributions. Evaluate dependency and model terms at pinned revisions. Do not describe source-available components as open source. Publish the protocol, policy schemas, test fixtures, security advisories, release provenance, and export format. Offer optional paid hosting or support without restricting local execution or security fixes.
