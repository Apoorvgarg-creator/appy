# Credential and account delegation workflows

**Status: unimplemented proposal.** Appy should let an owner authorize a task to use an account without giving credential plaintext to the model. This does not remove the sensitivity of the credential broker, target application, authenticated browser, or host memory. Apply the boundaries in [security design](04-security.md).

## Storage and ownership

Start with an OS-keystore-backed broker on the trusted worker side. Keep it outside the execution VM, under a separate OS principal. The scheduler sees an opaque credential reference and permitted operations, never a vault-read capability. Offer OpenBao later as an optional self-hosted backend; avoid requiring another server for a personal installation.

Separate grant-signing keys, device identity keys, provider credentials, and artifact-encryption keys. Restrict backup access, exclude secrets from crash dumps and routine diagnostics, and document which stores require manual unlocking after reboot. Do not trade unattended startup for silently embedding a master password in configuration.

The UI should show account, provider, permitted use, destination, expiry behavior, and last use. It should not display a password field inside the task composer.

## Preferred flow: a scoped service connector

1. **Connect:** the owner selects a provider in a trusted account-settings flow. Use authorization code with PKCE and exact redirect matching. Bind the callback to the initiating session.
2. **Store:** the broker stores refresh material and account identity, then returns an opaque reference such as `cred_demo_repository_read`.
3. **Delegate:** the owner chooses the task, worker, operations, resource boundary, and duration. A schedule cannot renew or broaden the owner grant itself.
4. **Validate:** the worker checks the grant and current execution lease. The credential broker independently checks reference, caller, destination, and requested operation.
5. **Execute:** a typed adapter obtains a scoped access token where supported and performs the approved request. Prefer broker-performed requests over exporting tokens into a general shell or environment variable.
6. **Return:** filter the response to the data the task needs. Record credential reference, operation, and result without token values.
7. **Finish:** close the lease, stop renewal, and revoke provider authorization when supported and requested.

Use minimal scopes, audience restrictions, refresh-token rotation, and sender-constrained tokens where available. Provider capabilities vary; surface broader-than-requested scope before connecting. An OIDC ID token is not a substitute for an API access token. [OAuth Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html).

## Destination binding and broker API

Give each adapter a fixed operation schema. Resolve an approved resource through the adapter, not a model-supplied arbitrary URL. Check scheme, host, port, account, resource, method, and meaningful request fields. Revalidate redirects and DNS results, and reject unapproved private-network destinations. Never forward an authorization header across an origin change.

The broker must not become an unrestricted authenticated proxy. A reference authorizing repository reads cannot authorize arbitrary requests to the same provider, a different account, or an upload endpoint. Scrub provider error bodies and headers before returning them to the model.

Proposed reference-only grant payload; the real authority would sign a canonical envelope containing it:

```json
{
  "grant_id": "grant_demo_01",
  "owner_id": "owner_demo",
  "device_id": "worker_linux_demo",
  "task_id": "task_review_demo",
  "credential_ref": "cred_demo_repository_read",
  "adapter": "repository_service",
  "operations": ["read_file"],
  "resource": "project_demo/repository_demo",
  "destination_origin": "https://api.example.com",
  "max_operations": 50,
  "valid_for_seconds": 900,
  "execution_lease_max_seconds": 30,
  "delegation": false
}
```

These identifiers are illustrative, not credentials. A real grant also needs issuance/expiry timestamps, policy version, session binding, and approval evidence. Its 15-minute owner window does not permit uninterrupted execution without renewed short leases.

## Password-only websites and human handoff

Use a dedicated low-privilege account in an isolated browser profile. For unsupported websites, prefer human login rather than adding generic password injection.

1. Pause the agent and fence its input ownership.
2. Suspend agent screenshots, accessibility/DOM observation, model calls, recording, and clipboard capture for the handoff session. A separate authenticated human-only live stream may continue; no frame fan-out to the agent, inference service, journal, or recorder is allowed.
3. Let the owner verify the real destination through that trusted takeover interface and complete login, MFA, or a passkey challenge. If the adapter cannot separate human viewing from agent observation, require physical/local login instead.
4. Resume only after explicit hand-back and a fresh post-login context check; discard stale observations.
5. Restrict the authenticated session to the approved task and terminate or expire it afterward where practical.

Disable arbitrary script evaluation, debugging ports, extensions, cookie export, and profile-file access for credential-bearing automation. If a supported future adapter fills a password, bind it to the expected origin and form and keep capture suspended.

Masking is not a complete defense: the website processes the secret, browser sessions hold account authority, and host compromise can expose memory. General GUI control can send messages or change settings without ever reading a password. Use a narrow connector or supervised takeover when that authority cannot be acceptably constrained.

## Expiration, revocation, and recovery

Distinguish three clocks: Appy's owner grant, its short execution lease, and the provider credential/session lifetime. Expiring one does not necessarily expire the others. Dynamic credentials can have enforceable leases; putting a static password in a vault does not give the target service a new expiry rule. [OpenBao lease model](https://openbao.org/docs/concepts/lease/), [KV storage](https://openbao.org/docs/secrets/kv/).

“Disconnect account” should stop affected tasks, revoke local references, request provider token/session revocation, clear relevant local caches, and report each result. Static passwords may need provider-side rotation. An unreachable provider leaves revocation pending; already completed actions remain completed.

For a lost controller, use offline recovery to revoke sessions and replace identity material. Suspected worker compromise requires removing the worker, rotating affected provider credentials, and rebuilding it before reenrollment. Restoring an encrypted backup must not reactivate revoked grants or consumed operations.

## Sharing and acceptance gates

V1 is single-owner. Multi-person delegation, two-person approvals, and shared vault administration are deferred until ownership, audit attribution, revocation, and recovery semantics are independently reviewed.

Release gates include destination substitution, redirect leakage, stale-grant replay, wrong-account access, vault-reference enumeration, malicious tool output, and canary-secret searches across prompts, logs, artifacts, recordings, and crash reports. Test static-password and provider-revocation failures explicitly. The [testing plan](08-testing.md) records these requirements; no credential-isolation claim is complete until the relevant paths pass.
