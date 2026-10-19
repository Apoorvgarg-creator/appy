# Appy

A proposed open-source control center for agents running on machines you own. Start a task from your phone, run local models on your Mac mini, use a permitted desktop when necessary, and return to evidence of what happened.

**Status: runnable fixture controller with optional private mobile pairing.** The React controller and Go service persist tasks, execute a bundled fixture analysis, and produce reviewed downloads. An opt-in gateway adds expiring browser sessions for iPhone/iPad access through Tailscale Serve. Physical-device HTTPS validation, real device agents, model integration, and production identity remain pending. Appy is a working name; a project license has not been adopted.

## Run the local foundation

Requires macOS or Linux, Go 1.25 or newer, Node 22.18 or newer, and npm. The first real-device target is the **Mac mini**, with **iPhone/iPad controllers** and a **MacBook** added later. See the [Mac-first track](docs/15-mac-first.md).

**On the Mac with this repository, double-click [Start Appy.command](Start%20Appy.command).** It opens Terminal, starts the existing build, waits for the page and API to respond, then opens your browser. Keep that Terminal window open while using Appy; press Control-C there to stop it. Startup errors stay visible in Terminal.

For a fresh checkout, build once from the repository directory:

```sh
npm ci --ignore-scripts
make build
npm start
```

Subsequent launches need only the Mac launcher or `npm start`. After source changes, `make run` rebuilds and launches. If the browser does not open automatically, use the address printed after startup: `http://127.0.0.1:8787`.

Label a sample analysis, review its plan, start it, approve its exact report, and download the result. Tasks and review previews persist in `.data/appy/`; interrupted runs require explicit resume after restart. This build reads only embedded sample files and uses a fixed recipe. It does not interpret your task label as instructions or access your files.

This address works **on the Mac running Appy**. The local controller trusts processes on that Mac and must remain private. Phone access uses the separate, authenticated gateway described below; never proxy port `8787` to a network.

```sh
make check   # Contract generation, TypeScript, Go vet
make test    # Go race tests, API contract checks, client retry tests
make build   # web/dist/ and bin/appy
```

For frontend development, run `go run ./cmd/appy` and `npm run dev` in separate terminals. Vite listens at `http://127.0.0.1:5173` and proxies API requests to the local Go service. Read the [implementation guide](docs/14-local-foundation.md) for boundaries, API ownership, storage, and validation.

## Connect your iPhone or iPad

This first connection runs the **sample task workflow** from Safari. It does not control other phone apps or the Mac's screen. Pairing is implemented and tested in-process; live Safari and cellular acceptance remain to be checked on your devices.

1. Install and connect [Tailscale](https://tailscale.com/download) on your Mac and iPhone/iPad using your private network. Keep access restricted to your own devices.
2. In a Mac terminal, run `tailscale serve --https=443 http://127.0.0.1:8788`. Follow its HTTPS setup instructions and keep this terminal open. Copy the private `https://…ts.net` address it prints. If another service already uses HTTPS port 443, preserve its configuration and resolve that conflict first. [Serve instructions](https://tailscale.com/docs/reference/tailscale-cli/serve).
3. In a second terminal, from this repository, save **your actual address without a trailing slash**, then rebuild and start Appy:

   ```sh
   npm run mobile -- https://mac-mini.your-tailnet.ts.net
   make run
   ```

4. On the Mac, open **Runner → Connect a phone → Create pairing code**. On the iPhone/iPad, open the private address in Safari, enter that code, and name the browser. Generate a new code for each browser.

Codes last five minutes and allow at most five incorrect guesses. Browser access lasts eight hours and ends on logout, Mac-side disconnection, or Appy restart. Keep the Mac awake and both terminal processes running during the first test. Closing Safari does not cancel tasks already accepted by the Mac.

The saved address also works with `Start Appy.command` on later launches; Tailscale Serve must still be running. To disable the gateway for the next launch, run `npm run mobile -- off` and restart Appy. Full setup, recovery, privacy notes, and device checks: [Mobile controller guide](docs/16-mobile-controller.md).

## Start here

1. Read the [product plan](docs/01-product.md) for the first release and its boundaries.
2. Open the [interactive wireframe](docs/wireframes/index.html) in a browser. Describe a goal, review a suggested plan, and follow the simulated task to its result. It uses fictional data and makes no device connections.
3. Review the [architecture](docs/02-architecture.md), [platform feasibility](docs/03-platforms.md), and [security design](docs/04-security.md).
4. Use the [roadmap and backlog](docs/07-roadmap.md) to start implementation and the [test and release plan](docs/08-testing.md) to judge readiness.

For a local preview, run this from the repository root and open `http://127.0.0.1:8080`:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs/wireframes
```

This command serves only the original design reference. It also opens directly from disk; keep `index.html`, `styles.css`, `app.js`, and the bundled `fonts/` directory together. Its simulated fleet is separate from the runnable application above.

## Planning documents

| Document | Decisions it supports |
| --- | --- |
| [Product](docs/01-product.md) | Audience, workflows, scope, success criteria |
| [Architecture](docs/02-architecture.md) | Services, trust boundaries, protocols, task lifecycle, model routing |
| [Platforms](docs/03-platforms.md) | Linux, macOS, Windows, Android, iPadOS, screen context and permissions |
| [Security](docs/04-security.md) | Threat model, authorization, isolation, revocation, updates |
| [Credentials](docs/05-credentials.md) | Passwords, OAuth, secrets, human takeover, delegated access |
| [User experience](docs/06-experience.md) | Screens, onboarding, interaction states, wireframe walkthrough |
| [Roadmap](docs/07-roadmap.md) | Milestones, dependencies, owners, concrete TODOs |
| [Testing](docs/08-testing.md) | Security invariants, adversarial suites, quality and release gates |
| [Research and decisions](docs/09-research.md) | Sources, existing projects, reuse, unresolved decisions |
| [Operations](docs/10-operations.md) | Deployment, travel readiness, recovery, incidents, retention |
| [Artifact validation](docs/11-validation.md) | Checks actually performed on this planning package |
| [Design research](docs/13-design-research.md) | Primary UX, dark-theme and typography sources mapped to interface changes |
| [ECC experience review](docs/12-ux-review.md) | User journeys, interaction audit, accessibility findings and remaining review work |
| [Local foundation](docs/14-local-foundation.md) | Implemented API, controller, durability, commands, tests, and limits |
| [Mac-first track](docs/15-mac-first.md) | Mac mini hub/worker, iPhone/iPad controllers, hardware gates and next steps |
| [Mobile controller](docs/16-mobile-controller.md) | Private HTTPS setup, browser pairing, revocation, and physical-device acceptance |

## Recommended starting point

Build for one owner using the hardware available: a Mac mini hub and worker, iPhone/iPad controllers, and later a MacBook worker. Confirm the Mac mini chip, memory and OS before selecting its local model or VM. The original Linux VM design remains an isolation reference; it does not require owning a Linux GPU box. Native macOS screen control needs its own permission and session tests. iPads and iPhones begin as controllers.

Always-on means durable, bounded work that survives closing the controller. It does not mean bypassing locks, sleep, consent, or operating-system security. Security assurance will come from documented assumptions, enforced boundaries, tests, independent review, and patching—not a promise of perfect security.
