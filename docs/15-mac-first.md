# Mac-first implementation track

**Status: proposed next M0 work; researched 14 October 2026.** The confirmed fleet is a Mac mini, MacBook, iPhone, and iPad. There is no Linux GPU box. The Mac mini's chip, RAM, free storage, and macOS build remain unconfirmed; no model or hardware-specific adapter has been selected. This plan adds no installed services, permissions, model downloads, or remote access.

## Roles and hardware decision

Use the Mac mini as the home hub, durable task store, and candidate inference host. Keep the MacBook as a development/controller machine initially; enroll it as an optional worker after the mini's permission and interruption tests pass. iPhone and iPad provide the controller, approvals, results, and eventually an authenticated remote view.

Record the mini's processor family, memory, available disk space, OS build, display setup, Ethernet/Wi-Fi, FileVault status, sleep settings, and home uplink. Do not infer its specifications from the computer running this repository.

| Confirmed hardware | Inference experiment | Isolated workspace experiment |
| --- | --- | --- |
| Apple silicon | Compare pinned llama.cpp/Metal and MLX LM configurations | ARM64 Linux guest through Apple Virtualization |
| Intel | Begin with a compatible llama.cpp CPU build; measure usefulness before promising GPU acceleration | AMD64 Linux guest if framework and host validation succeed |
| Insufficient memory or unsupported OS | Continue deterministic fixtures; reduce model/context/concurrency or defer inference | Defer VM execution if a supported configuration cannot fit |

MLX's current macOS installation requires Apple silicon, native Python 3.10+, and macOS 14+. MLX LM provides text generation; screen understanding needs a separately verified vision model/runtime combination. llama.cpp documents x86 CPU optimizations and Apple-silicon Metal support. These are compatibility starting points, not performance results. [MLX installation](https://ml-explore.github.io/mlx/build/html/install.html), [MLX LM](https://github.com/ml-explore/mlx-lm), [llama.cpp](https://github.com/ggml-org/llama.cpp).

## Two execution boundaries

**Isolated tasks:** host a disposable Linux guest on the Mac mini for eventual file, browser, and command tools. Apple's Virtualization framework uses the host CPU architecture: ARM64 on Apple silicon, AMD64 on Intel. Check `VZVirtualMachine.isSupported`, configuration validation, framework availability, and the virtualization entitlement before enabling this capability. This replaces the Linux-host KVM assumption for this fleet. [Linux guest setup](https://developer.apple.com/documentation/virtualization/creating-and-running-a-linux-virtual-machine), [VM requirements](https://developer.apple.com/documentation/virtualization/vzvirtualmachine).

Begin with an offline guest, a copied fixture directory, bounded RAM/CPU, and a disposable disk. Add only reviewed, mediated networking later; NAT alone is not an egress policy. Exclude host home folders, Keychain, browser profiles, clipboard sharing, and host control sockets. Keep inference on the host behind a narrow authenticated gateway; do not assume guest access to host Metal acceleration. A guest desktop is a separate workspace, not the Mac's actual screen.

**Actual Mac screen:** develop a Swift per-user helper for a dedicated logged-in account. Start with consented observation of one synthetic test window using ScreenCaptureKit. Add narrowly filtered accessibility observations only when needed; defer input injection. Screen recording and accessibility trust are separate checks. A launch daemon cannot substitute for the interactive user's helper. [Apple capture sample](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos), [AX trust check](https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions), [User and system services](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/DesigningDaemons.html).

## Next implementation tickets and exit evidence

1. **MAC-01 · Inventory and decisions:** record the hardware facts above; select supported OS/toolchain versions and signable helper identity. Pin candidate runtime, model revision, tokenizer, quantization, and licenses. Keep hardware and model selection explicitly pending until measured.
2. **MAC-02 · Read-only adapter:** implement capability/permission status, explicit start/stop observation, a visible sharing indicator, and authenticated local IPC restricted to the intended client. Unknown verbs and all write/input commands must fail. Frames carry window/app identity, timestamp, sequence, geometry, and session epoch; unavailable content becomes an explicit blocked state.
3. **MAC-03 · Hardware evidence:** test grant/deny/revoke, closing the selected window, lock/unlock, logout, user switching, sleep/resume, helper crash/restart, monitor removal, and scaling. Verify no unrelated windows, audio, clipboard, or private canary text reaches observations/logs. Confirm revoked/stopped sessions emit no further accepted frames; reject stale frames after resume. Record OS/build, helper hash, measured stop latency, and failures. Use synthetic screens initially.
4. **MAC-04 · Inference and VM bakeoff:** compare two feasible configurations over the same 30 fixture attempts. Record correctness, unsafe proposals, latency, memory pressure, and failures. Keep one concurrent run initially, reserve memory for macOS and the hub, and block rather than silently use hosted inference. Prove guest restart/reset and denial of prohibited host resources before adding effectful tools.

Passing MAC-02/03 demonstrates a local observation adapter. M0 also requires its broader feasibility decisions; M1 still requires identity and transport; M2 authorization, isolation, and watchdog gates still precede real execution. See [roadmap](07-roadmap.md) and [security tests](08-testing.md).

## Phone access and availability

The [mobile controller slice](16-mobile-controller.md) now implements a separate opt-in gateway for fixture tasks: private HTTPS transport configuration, short-lived invitations, expiring browser sessions and revocation. It still needs physical Safari/cellular testing and does not implement persistent device identity, passkeys, native observations or the complete M1 gates.

Before exposing even observations beyond loopback, implement owner authentication, HTTPS, enrollment/key pinning, revocation, origin/CSRF checks, private-overlay ACLs, and denial tests. Validate iPhone cellular reconnect and iPad approval flows against the authenticated build. A VPN does not supply application authorization; do not publish the current unauthenticated development server.

iOS/iPadOS sandbox apps and constrain background execution to supported APIs. This track promises controllers, not unattended control of arbitrary phone apps. Hub work should survive the controller closing once its authorization remains valid. [Apple runtime security](https://support.apple.com/guide/security/security-of-runtime-process-sec15bfe098e/web).

Keep hub readiness, model readiness, and desktop readiness separate. Test sleep, power loss, network loss, and encrypted reboot on this mini; wake-for-network settings are not proof that Appy's overlay will wake it. Locking pauses native observation/input without assuming the hub stopped. [Apple wake behavior](https://support.apple.com/guide/mac-help/share-your-mac-resources-when-its-in-sleep-mh27905/mac).

Keep FileVault enabled. Apple documents SSH unlock after restart on Apple silicon with macOS 26+, Remote Login enabled, and networking available. That is a conditional recovery option requiring separate evaluation, not permission to enable SSH or an Appy capability. Until recovery is tested, report the worker unavailable and plan for owner assistance. [Apple FileVault guidance](https://support.apple.com/en-gb/guide/security/sec8447f5049/web).
