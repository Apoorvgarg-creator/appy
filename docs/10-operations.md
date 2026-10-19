# Deployment and operations plan

This runbook describes the proposed production system. A loopback-only [local fixture application](14-local-foundation.md) can now be built and run. Production installers, authenticated remote access, background device services and relay configuration remain unimplemented. The first host is the owner's Mac mini; see the [Mac-first track](15-mac-first.md).

## Reference installation

| Role | Initial placement | Operational requirement |
| --- | --- | --- |
| Controller | Trusted phone, tablet or laptop | Passkey, device lock, current browser and private-network client |
| Hub and authority | Mac mini at home | Wired network, protected keys, separate principals, database and encrypted backups |
| Execution | Validated disposable guest on Mac mini; separately consented native helper | Restricted network and mounts; no guest host-administration access; native session gates |
| Inference | Permitted local Mac service | Private authenticated gateway, measured capacity and pinned artifacts |
| Coordination/relay | Reachable owner-operated endpoint when needed | HTTPS, access control, quotas, monitored availability |

Container Compose can package hub services later, but desktop helpers belong to native user sessions. VM creation is an installation/administration operation; agents do not receive a host Docker socket or arbitrary hypervisor control.

A full self-hosted path must document all external dependencies: DNS, certificate issuance, relay map, update distribution, model download registries, optional push providers and connected applications. Offline local operation can continue within approved scope when the worker and authority can still communicate. Remote access and Internet-dependent tasks cannot survive loss of their required network paths.

Headscale configurations may use external DERP servers unless the relay map is deliberately changed. Self-hosting the coordinator alone does not mean every network component is self-hosted. [Headscale DERP configuration](https://headscale.net/stable/ref/derp/).

## Installation sequence to implement

1. Check host versions, virtualization support, network topology, disk capacity and required OS features.
2. Verify signed installer provenance and create separate service identities and protected state directories.
3. Initialize owner authentication locally; save recovery material offline. Establish HTTPS trust without bypassing browser warnings.
4. Enroll workers using locally verified fingerprints and expiring authenticated pairing.
5. Set the worker's local policy ceiling through the administrative path; start with observation only.
6. Configure explicit overlay ACLs and test that public interfaces expose no worker, inference or database services.
7. Create the managed VM from a pinned image, then choose and verify model/runtime artifacts.
8. Configure secret storage and startup unlock behavior; run fixture tasks before attaching any real account.
9. Verify stop, revocation, restart, backup restore and controller recovery before enabling scheduled work.

For unattended secrets, baseline manual unlock after reboot is acceptable and must be visible as “needs owner.” A TPM- or platform-keystore-backed alternative needs a documented physical-access threat model and a tested recovery path. Never hide a vault master password in an environment file to achieve automatic startup.

## Before travelling

- Run a complete task from cellular data with home Wi-Fi disabled on the controller.
- Confirm the hub stays awake and that workers report distinct network, desktop, permission and vault states.
- Test power-loss recovery, restart and the exact workloads intended for the trip.
- Use a UPS where justified; measure whether the router and hub recover independently.
- Keep recovery material and a second trusted authenticator available through a separate safe path.
- Confirm spare disk space, update health and current backup; set task budgets and expiry.
- Check which actions require local attendance: OS permissions, encrypted preboot unlock, certain logins and unsupported desktop states.

Wake-on-LAN and power management are optional device-specific features to test, not availability guarantees. Do not disable FileVault, BitLocker, Secure Boot or screen locking to conceal a platform limitation. A local virtual workspace can remain useful while a personal desktop is unavailable.

## Daily health and diagnostics

Show hub/worker heartbeat age, lease-renewal failures, queue depth, blocked tasks, disk/VRAM pressure, model errors, key/certificate expiry, backup status and updater state. Default telemetry stays local and avoids prompts, secrets and screen content. A user-controlled diagnostic export must preview and redact its contents.

When a run stalls, inspect its state and last verified action first. Distinguish unavailable model, locked desktop, denied scope, expired credential and lost connection. Never suggest broadening permissions as the default repair.

## Failure and incident runbooks

| Event | Immediate response | Recovery condition |
| --- | --- | --- |
| Lost phone/controller | Revoke controller sessions using recovery or another trusted device | New authenticated controller; old sessions rejected |
| Suspected worker compromise | Isolate worker; revoke device and grants; stop affected tasks; rotate exposed provider credentials | Rebuild and reenroll with new keys; review external effects |
| Suspected hub/issuer compromise | Stop/isolate workers via trusted local paths; revoke issuer trust; preserve bounded forensic evidence | Fresh trusted installation and locally approved issuer keys |
| Internet/relay outage | Show unreachable; leases expire if authority cannot reach worker | Fresh session/lease and reconciled task state |
| Power loss | Restore protected services; keep desktops/vaults blocked when required | Valid policy, fresh session and reconciled operation journal |
| External action outcome unknown | Suspend retry and query destination with an idempotency/reference key | Confirmed result or explicit owner decision |
| Credential leak | Revoke/rotate at provider, end relevant sessions, invalidate local references | Test replacement credentials and examine authorized outputs |
| Malicious update | Reject untrusted artifact; isolate if executed; rotate affected identities | Known-good verified recovery respecting anti-rollback policy |

Preserve incident evidence with access control and a clear retention limit; do not dump personal screens and vault contents into an issue tracker. Before public beta, maintainers must establish a private vulnerability-reporting channel, triage ownership and a patch disclosure process. No reporting address is invented in this package.

## Retention and backup defaults

Proposed defaults: structured audit metadata for 30 days; no persistent screen video; temporary observations held only as required for the active step; explicitly selected artifacts for 30 days unless pinned by the owner. Keep content, metadata and vault retention separately configurable. Provider logs and remote copies follow their own rules.

Encrypt backups and keep at least one separate copy. Store recovery keys separately. Record artifact hashes and test restoration into an isolated environment monthly. Backups can contain older secrets and deleted content: document a bounded backup expiry instead of promising instant universal deletion.

Restores must not revive revoked identities, grants or consumed operations. Preserve a protected revocation/epoch checkpoint outside ordinary rollbackable state, or require reenrollment and reconciliation after restoring old state. Missing audit or operation history is a reason to pause consequential work.

## Updates and support envelope

Drain or pause tasks before updating brokers, native helpers or policy schemas. Keep keys and state migrations separate from replaceable binaries. Verify artifact identity/digest and update metadata before installation, stage the update on a fixture worker, then roll out within the published support matrix. A security floor may intentionally forbid an otherwise convenient downgrade.

Publish exact supported OS builds, desktop backends, browsers, network-client versions and model/runtime combinations with each release. The product can only claim support for states tested in that matrix.
