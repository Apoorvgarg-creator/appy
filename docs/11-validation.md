# Planning package validation

**Current executable application:** see [local foundation validation](14-local-foundation.md#verification-and-remaining-work) for Go, React, persistence and contract tests. Those checks are separate from the v0.3 design-reference review below. Live HTTP browser integration of the new application remains unverified because this environment denies TCP binds; static renders are not a substitute.

Validation date: **14 October 2026**. This record covers the **v0.3 dark interface**, documentation and simulated behavior. It does not establish that device control, a credential broker, networking services or production security boundaries have been implemented.

## Rendered browser checks

The required integrated Browser plugin failed to initialize because its environment lacked `sandboxPolicy` metadata. A local Chrome DevTools fallback subsequently worked through ECC. The earlier inability to render is historical; the observations below come from the running local prototype.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Desktop and phone Home | Rendered at `1440×1000` and `390×844`. Composer and recent work share a left edge at x=352 on desktop and x=20 on phone. Inter weights 400, 500 and 600 loaded. | [Desktop](wireframes/evidence/home-desktop.png), [phone](wireframes/evidence/home-mobile.png) |
| Phone approval | The 354px-wide dialog has no horizontal overflow. Header and action footer remain within the viewport; the footer ends at y=811. | [Approval](wireframes/evidence/approval-mobile.png) |
| Invalid route and recovery | Choosing Atlas with desktop tools opens the advanced fields, focuses Tools, sets `aria-invalid`, links the error with `aria-describedby` and displays it beside the field. Changing to Scoped files permits review and Start task. Review resets dialog scroll to zero and focuses its heading. | [Route error](wireframes/evidence/error-mobile.png) |
| Task and result hierarchy | Heading, result panel and disclosures share x=352. The indexing task initially shows an output preview; Demo controls → Simulate next step reaches Result with Download and heading focus. | [Task](wireframes/evidence/task-desktop.png), [result](wireframes/evidence/result-desktop.png) |
| Partial device readiness | Devices distinguishes ready Atlas, locked Moss, offline Field and controller Canvas. | [Devices](wireframes/evidence/devices-desktop.png) |
| Empty states | Completed shows an empty result with View all tasks. An unmatched search offers a shorter-query hint. | [Empty search](wireframes/evidence/empty-desktop.png) |
| Long phone content | A long goal wraps within the 312px heading area without horizontal overflow; the review body starts at scroll zero and the action footer remains inside the viewport. | [Long goal](wireframes/evidence/long-goal-mobile.png) |

Native keyboard checks observed Command+K focusing search, Tab reaching a search result, and Escape closing approval and returning focus to the exact Review trigger. The inspected browser session had no console errors or warnings. These are targeted checks of the prototype, not a complete keyboard audit, usability study or WCAG conformance assessment.

The [review evidence](wireframes/review-evidence.json) records viewport and content-state observations. ECC's `check-evidence.js` returned exit 0: the evidence record is complete and its local artifacts exist. That checker validates record completeness; rendered observations above support the visual review. The remaining checks below are still outstanding.

## Source and simulation checks

- `node --check docs/wireframes/app.js` passed.
- A locally cached PostCSS parser accepted `styles.css`: 398 rules, four media queries and 1,226 declarations.
- Local Markdown links, fenced blocks, final newlines and trailing whitespace were checked across 16 Markdown documents.
- ECC product-lens, click-path-audit and frontend-a11y informed the [experience review](12-ux-review.md). It records state ownership, critical click paths and selected source-color contrast calculations.
- All **16 scenario groups** passed in the temporary Node VM harness. The saved [interaction checks](wireframes/interaction-checks.json) contain the current `app.js` SHA-256 fingerprint, test names and method limitations.

The simulation checks cover route rejection; persisted and escaped goals; edited plans and invalid fields; locked desktop versus file access; approval expiry, refresh, denial and one-use consumption; offline queue and explicit resume; takeover exclusion and handback; global and individual cancellation; three pairing OS choices with no implicit grant; result ordering; disclosure and focus persistence; search; toast visibility; synthetic downloads and generated Blob contents.

The harness uses a minimal mock document and exposes private functions only in an in-memory source copy. Its 16 generated fragments and state assertions are separate from the rendered browser evidence. It cannot establish native event ordering, browser downloads, assistive-technology behavior or production authorization. It is a temporary review tool, not a production test suite.

## Remaining checks and repeat procedure

Screen-reader announcements, 200% zoom, reduced-motion emulation, real-phone touch behavior and broad browser compatibility have not been validated. Reduced-motion support was inspected in CSS only. Pairing, takeover, cancellation and approval-expiry behavior have simulation coverage; complete browser journeys for those cases remain follow-up work. No participant study or timed task benchmark was conducted.

From the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs/wireframes
```

Open `http://127.0.0.1:8080`. Opening `docs/wireframes/index.html` directly also works when its local CSS, JavaScript and font files remain alongside it.

1. Review Home at both target sizes. Enter a goal, navigate away and return. Expand Try an example; use search and open Activity through Connect on the phone.
2. Plan a task, adjust its device and folder, inspect the access summary and start. Expand Demo controls to simulate progress, then collect the result. Reject an incompatible headless-desktop route and recover through Scoped file tools.
3. Review the release draft. Under Request details, simulate an expired request and request a fresh review. Deny once; refresh the page and approve once. Inspect the retained local draft and activity record.
4. Queue work on Field. Reconnect and confirm it remains paused until explicit resume. Unlock Moss; take over a desktop task, return control and confirm that resuming is still explicit.
5. Add Pine, compare its simulated identity and confirm that enrollment grants no access. Plan its first task and review the OS-appropriate path.
6. Stop all with Field offline. Inspect pending acknowledgement, reconnect and confirm old work stays stopped. Reset demo from Activity & safety.
7. Repeat important paths with the keyboard, a screen reader, enlarged text and reduced motion. Check dialog focus, validation announcements, long text and download behavior.

Use fictional data. State remains in memory and resets on refresh. These actions do not connect to real devices or change external accounts. Replace unverified evidence only after performing the corresponding checks.

## Earlier planning-package review

Before the first version, `AGENTS.md` did not exist. It was created exclusively, contains 315 words and was not modified during the redesign. The original inline wireframe had separate syntax and mock-document checks; those results are not used as evidence for the replacement interface.

The planning review checked linked primary sources and reconciled controller–worker network paths, optional Mac/Windows expansion, 30-second admission leases versus 35-second watchdog termination, suspend-aware timing, high-entropy enrollment, private human login and native desktop account authority.

## Production assurance still required

Operating-system integrations, model benchmarks, private networking, cryptographic protocols, secret-isolation tests, penetration tests, signed updates, field pilots and recovery drills remain future work. Release gates are in [testing and release assurance](08-testing.md); implementation tasks are in the [roadmap](07-roadmap.md). Neither rendered checks nor simulation tests establish real-device security or absence of leaks.
