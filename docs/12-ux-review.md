# User experience review

Reviewed **14 October 2026**. The current interface is **v0.3: a dark workspace with less initial information**. This review applies ECC product-lens to task journeys, click-path-audit to shared state and complete action sequences, and frontend-a11y to semantics, focus, errors and contrast. [Design research](13-design-research.md) explains the source-supported decisions.

## Current experience

| Area | Change | Source evidence |
| --- | --- | --- |
| Home | One column: goal, optional examples and recent work. Removed inventory rail, promotional sample, decorative task cards and repeated slogans. | `home()` and `taskRow()` in [app.js](wireframes/app.js) |
| Task detail | Readiness and output first; relevant actions stay visible. Access, activity and demo controls are disclosed on demand. | `taskDetail()` |
| Review | Complete destination, content, consequence and expiry remain visible before authorization. Removed explanatory side panel. | `review()` and `openApproval()` |
| Visual consistency | Charcoal surfaces, restrained accent, one 8px rectangular radius and locally bundled Inter. Larger text replaces tiny labels. | [styles.css](wireframes/styles.css) and [font provenance](wireframes/fonts/README.md) |
| Phone navigation | Bottom navigation plus header access to activity and Stop all. | [index.html](wireframes/index.html) |

The earlier light-themed v0.2 review is historical. It caught invisible toast feedback, lost focus after rerender, search navigation losing focus to its old trigger, hidden-field validation failures and misleading newly paired device readiness. Those corrections were retained. Its palette measurements and failed rendering attempts are not the current validation result.

## State and action audit

The stores are the in-memory `state` object and the `tasks` and `devices` arrays. Same-view `render()` preserves disclosures using stable keys before restoring focus. Navigation deliberately resets them. This fixes the v0.3 issue where a simulated step collapsed Demo controls and hid its replacement focus target.

| Action | State change and reset contract |
| --- | --- |
| Plan → review → edit | Save goal, worker, tools, folder and duration in `draft`; editing retains those values. Changing worker selects its OS-specific default path, shown in the next review. |
| Start | Revalidate route and global stop, create the task, then clear the draft and Home goal. Offline → queued; locked desktop → blocked; manual desktop → paused. |
| Approve / deny | Consume the pending request once. Approval completes the simulated write; denial retains the local draft. Expired approval has no effect until a fresh review. |
| Pause / resume / step | Resume checks readiness and manual ownership. Progress is admitted only for running work while global stop is off. |
| Unlock / takeover | Unlock changes blocked work to paused. Takeover pauses desktop tasks; ending manual control does not resume them. |
| Stop / reconnect | Reachable work becomes stopped; unreachable work becomes cancelling. Reconnect acknowledges cancellation or leaves queued work paused. Global stop also clears manual control and cancels pending approval. |
| Pair / revoke / reset | Pairing adds identity without blanket access. The first reviewed task grants scope. Read-grant revocation is separate from a one-use write decision. Reset discards the demo session. |

Critical review sequences are: **goal → edited plan → reviewed scope → run → result**; **expire → refresh → approve once**; **deny → retained download**; **unlock → resume → takeover → handback → explicit resume**; **queue → stop → reconnect → stopped**; and **pair → no grants → first reviewed task**. Changing page must preserve an unfinished Home goal; cancelling a dialog must not execute its proposed action.

## Accessibility and selected color checks

The implementation uses native buttons, labelled fields, native dialogs and disclosures, a skip link and live status messages. Navigation focuses the new heading. Dialog closure restores focus, while search-result navigation suppresses restoration to the old search trigger. Custom plan validation expands the affected disclosure, marks the field invalid, links the error and focuses it. Reduced-motion CSS is included.

The following are **opaque source-color calculations**, not a complete accessibility audit:

| Pair | Contrast |
| --- | --- |
| Primary text `#f1f2f4` / canvas `#101114` | 16.85:1 |
| Secondary text `#a2a5af` / surface `#17191e` | 7.15:1 |
| Secondary text `#a2a5af` / raised surface `#202329` | 6.40:1 |
| Button text `#171b2d` / accent `#a7b4ff` | 8.62:1 |
| Focus `#a7b4ff` / raised surface `#202329` | 7.96:1 |
| Amber / green / red status pairs | 8.16:1 / 7.71:1 / 7.32:1 |
| Form boundary `#626775` / surrounding surface `#17191e` | 3.11:1 |

These selected pairs clear the relevant normal-text or non-text thresholds. They do not establish contrast for every state, actual focus order, touch ergonomics or assistive-technology behavior.

## Evidence and remaining acceptance

Local Chrome rendering is now available; the earlier integrated-browser initialization failure no longer blocks all browser review. See [validation](11-validation.md) and [review evidence](wireframes/review-evidence.json) for the exact completed browser and simulation checks. This document does not substitute source inspection for browser evidence.

No participant study, measured time-to-value or competitor usability benchmark has been conducted. The next user study should ask people to start a task, explain an approval before accepting it, collect a result and recover offline work without coaching. Include phone, keyboard-only, screen-reader and text-enlargement sessions. The prototype remains fictional and provides no evidence of production authorization or security certification.
