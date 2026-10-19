# Platforms, operating systems, and execution boundaries

This is a proposed device-support plan; the current [local foundation](14-local-foundation.md) executes bundled fixtures only. The confirmed first host is a Mac mini, with iPhone/iPad controllers and a MacBook later. M0 evaluates a consented read-only Mac adapter, local inference and an isolated Linux guest on that hardware. Native writes remain gated by authorization and session tests. See the [Mac-first track](15-mac-first.md); Linux-host and Windows support remain later options.

## Proposed support matrix

“Ready” requires a usable session, permissions, capacity, and a valid execution lease. Network connectivity alone is insufficient.

| Platform | Intended role | Proposed support boundary |
| --- | --- | --- |
| Mac mini | First hub, inference candidate and read-only native adapter | Chip/RAM/OS pending; dedicated session; capture consent; native writes gated |
| Linux VM on Mac mini | Candidate isolated browser, file, and CLI workspace | Apple Virtualization; host-compatible guest architecture; restricted mounts/network |
| Linux GPU host | Optional later private inference and VM host | No purchase required; no model access to host desktop, broker socket, or credentials |
| Linux physical desktop | Later supervised adapter | Explicitly tested compositor/portal versions; no universal Wayland claim |
| MacBook / other Macs | Later additional worker or inference host | Dedicated logged-in account; explicit capture/accessibility permissions |
| Windows laptop/desktop | Subsequent supervised adapter | User-session helper; protected elevation and lock boundaries |
| iPhone/iPad | Controller, approvals, takeover viewer | No promised arbitrary unattended cross-app automation |
| Android | Controller; optional later lab target | Separate consented ADB experiment on dedicated devices |

## Linux: kernel controls and graphical sessions

Do not develop a custom kernel or make the planner root. On a Linux host, KVM/QEMU is the reference VM option. The Mac mini instead evaluates Apple Virtualization as detailed in the Mac-first track. Separate guest execution from host inference. A virtual display supplies a desktop without a physical monitor; it does not itself create a security boundary. Do not mount the host home directory, Docker socket, credential store, or session bus into the guest.

Use cgroup v2 for CPU, memory, process, and I/O budgets. Combine namespaces, syscall filtering, and supported access controls for host services; resource limits do not authorize filesystem access. Seccomp reduces syscall exposure but is not a complete sandbox. Landlock capabilities vary by kernel/ABI, so startup must detect required protections and reject unsupported isolation modes. [cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html), [seccomp](https://docs.kernel.org/userspace-api/seccomp_filter.html), [Landlock](https://docs.kernel.org/userspace-api/landlock.html).

For physical Wayland desktops, XDG ScreenCast provides PipeWire streams; RemoteDesktop provides permission-mediated input and recommends EIS/libei. Persistent sessions use rotating, single-use restore tokens. Restoration can fail after permission withdrawal or display changes; request consent again instead of weakening protection. Portal implementation and compositor support must be tested together. [ScreenCast](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html), [RemoteDesktop](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.RemoteDesktop.html).

Prefer portal input over `/dev/uinput`, whose virtual devices deliver events broadly through the input subsystem. If a dedicated appliance requires uinput, only a narrow broker may access it. Keep desktop capture/input in the correct user session; configure systemd hardening separately for network, inference, and graphical components. [Kernel uinput interface](https://docs.kernel.org/input/uinput.html), [systemd execution controls](https://github.com/systemd/systemd/blob/main/man/systemd.exec.xml).

## macOS: consent and session lifecycle

Evaluate ScreenCaptureKit for observation and AX accessibility for semantic targets. Check permissions through supported APIs and show actionable missing-permission states. A permission prompt is not a permission grant. Launch agents execute for logged-in users; a background daemon must not be assumed to possess an interactive desktop. [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit), [AX trust check](https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions?preferredLanguage=occ), [Launch agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html).

Use a signed per-user helper with narrow IPC. Validate capture and AX separately after installation, upgrade, and revocation. Pause on lock, logout, sleep, or account switching. Headless display behavior and FileVault reboot recovery require physical-hardware experiments; neither automatic unlock nor disabling FileVault is part of this design.

## Windows: integrity levels and interactive sessions

Evaluate Windows.Graphics.Capture, UI Automation, and bounded input injection. UIA exposes semantic controls; some applications require vision/input fallback. `SendInput` is subject to UIPI and can inject only into equal-or-lower integrity targets. [Windows capture](https://learn.microsoft.com/en-us/windows/uwp/audio-video-camera/screen-capture), [UIA fundamentals](https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiautocore-overview), [SendInput](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-sendinput).

Windows services cannot directly interact with users. Use an authenticated, session-bound helper rather than placing desktop automation in Session 0. Lock screens, UAC, and elevated applications become blocked states or human handoffs. Do not disable UAC or request broad UIAccess as a convenience. Test console/RDP transitions and ensure another user's session cannot receive an action. [Microsoft service guidance](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services).

## Mobile: controller first

iOS/iPadOS apps are sandboxed and access other resources through Apple-provided services. FaceTime's attended remote control does not establish a general third-party input API. No verified public API supports the arbitrary unattended input required by this product. [Apple runtime security](https://support.apple.com/en-au/guide/security/sec15bfe098e/web), [FaceTime control](https://support.apple.com/en-sg/guide/iphone/iph5d70f34a3/27/ios/27).

At research time, Apple's iOS ScreenCaptureKit sample requires iOS 27+ and is marked preliminary/beta. Treat it as a conditional future capture experiment, recheck shipping availability, and make no release dependency on it. Capture does not imply input control. [Apple sample](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios).

Android MediaProjection requires consent per session; Android 15 QPR1+ stops projection on lock. Google Play prohibits Accessibility API automation that autonomously initiates, plans, and executes actions, with a limited disability-assistance exception. Therefore, a general autonomous Accessibility worker is not the proposed Play app. [Projection lifecycle](https://developer.android.com/media/grow/media-projection), [Play Accessibility policy](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en-en).

A later dedicated-phone experiment can evaluate paired ADB/scrcpy, preferably over USB to an enrolled home worker. Debugging authorization is powerful: exclude public ADB access and support host-key revocation. Sideloading does not remove operating-system restrictions. [ADB](https://developer.android.com/tools/adb), [scrcpy](https://github.com/Genymobile/scrcpy).

## Capture, context, and action contract

Prefer typed APIs, then browser/native semantics, then pixels. Linux AT-SPI and Windows UIA provide semantic information only where applications expose it; missing nodes require explicit fallback. [AT-SPI](https://gnome.pages.gitlab.gnome.org/at-spi2-core/libatspi/index.html), [UIA](https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiautocore-overview).

Each observation binds device, workspace, session epoch, timestamp, frame sequence, application/window identity, display scale/rotation, semantic nodes, image digest, and privacy status. Reacquire the target before input and verify a postcondition afterward. Reject stale coordinates, moved targets, unexpected focus, and unknown display transforms.

One fenced input lease controls each desktop. Human takeover pauses the agent and requires explicit hand-back with fresh context. Secret entry suspends observation as defined in the security design; neither OCR redaction nor accessibility labels form a complete confidentiality boundary.

## Feasibility spikes and future test infrastructure

| Spike | Evidence required before support |
| --- | --- |
| Linux VM | Isolation escape-negative tests; fresh-image recovery; 100 session cycles |
| GNOME/KDE | Consent revocation, token rotation, lock, monitor removal, mixed scaling |
| macOS | Signed update, permission loss, sleep/logout, headless operation, encrypted reboot |
| Windows | UIPI rejection, UAC interruption, RDP transition, cross-session IPC denial |
| Mobile controller | Real-device passkeys, approval clarity, reconnect, touch takeover |
| Android lab | Pair/revoke, reboot, capture stop, OEM-specific input behavior |

Future CI needs disposable Linux VMs plus physical Mac, Windows, iPhone/iPad, and Android hosts. Unit mocks cannot establish OS permission or hardware behavior. Publish tested OS builds and adapter revisions, run interruption scenarios on every supported release, and withdraw capabilities when permission checks fail. Always-on soak testing must include power/network loss and task recovery; sleeping or preboot-locked workers remain visibly unavailable.
