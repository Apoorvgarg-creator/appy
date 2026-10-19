# User experience and visual direction

The **v0.3 concept** centers on two activities: give Appy a task and return to its result. Home contains a goal composer, optional examples and recent task rows. Device inventory, model configuration and detailed records have their own destinations.

Open the [interactive concept](wireframes/index.html). HTML, CSS, JavaScript and bundled font files load locally without a build or external service. Accounts, devices, outputs and execution are fictional. This interface does not implement production authorization.

## Dark visual system

| Role | Value | Application |
| --- | --- | --- |
| Canvas | `#101114` | Main workspace |
| Surface / raised surface | `#17191e` / `#202329` | Composer, panels and controls |
| Primary / secondary text | `#f1f2f4` / `#a2a5af` | Task content / supporting information |
| Accent | `#a7b4ff` | Primary actions and keyboard focus |
| Attention | `#e6bd7d` on `#30291f` | Review and readiness states |
| Success | `#98ccb0` on `#1d3027` | Completed work |
| Stop or error | `#f0a2ab` on `#362329` | Destructive actions and errors |
| Rectangular radius | `8px` | Controls, panels, fields and dialogs |

Use locally bundled Inter Regular, Medium and SemiBold, with system fallbacks. Body text is 15px, primary buttons 14px and metadata 13px; page headings are 28px, with the desktop Home heading at 32px. Form fields use 15px on desktop and 16px on phones. Most content uses regular or medium weight. Do not create density by shrinking instructions. See the [font provenance and license](wireframes/fonts/README.md).

Keep color purposeful, controls consistently shaped and primary touch targets at least 44px. Status text accompanies color. Focus remains visible on dark surfaces; reduced-motion preferences disable unnecessary transitions. The rationale is documented in [design research](13-design-research.md).

## Information architecture

| Destination | Initial content | Next action |
| --- | --- | --- |
| Home | Goal composer, collapsed examples, three recent task rows with pending reviews first | Plan a task or open existing work |
| Tasks | Compact rows and status filters | Inspect a task |
| Needs you | Pending change and local draft | Review the exact action |
| Devices | Connection and capability information | Inspect readiness or add a worker |
| Connections | Account grants and local model route | Inspect or revoke access |
| Activity & controls | Decisions and stop acknowledgement | Inspect the record |

Home has no right-hand inventory, promotional sample panel, illustrated task cards or duplicate approval callout. A pending review appears in its task row and the review destination. Search supports Command/Ctrl+K. Stop all remains in the header. Phones use five bottom-navigation destinations plus an activity control in the header.

## Task journey

1. **Describe the result.** Enter a goal, or expand “Try an example.” Routing initially suggests Atlas; advanced choices follow the goal.
2. **Review the plan.** Read the proposed steps. Expand “Adjust device & access” to change worker, tools, folder or duration.
3. **Review authority.** The second stage explicitly shows execution and inference routes, scope, limits and account access. Desktop mode displays its broader dedicated-account authority. Start, queue or create a waiting task only after this review.
4. **Follow the task.** The detail opens with readiness and output. Pause, resume, review or stop controls remain close to the result. Task access, activity and simulation controls use labelled disclosures.
5. **Collect the output.** Completed work presents a local synthetic download. Release notes can also be downloaded while the external action is awaiting review or has been denied.

A headless worker cannot be chosen for native desktop input. The iPad is a controller, not an execution worker. Offline work queues; locked desktops wait for local unlock. Neither reconnect nor unlock automatically resumes work. Inference does not silently switch to a cloud model.

## Approval and credential use

The exact-action dialog keeps account, destination, complete content, consequence and expiry visible together. The example creates one private GitHub release draft; read-only repository access does not authorize this write. Approval is consumed once. An expired request requires renewed review, and denial retains the local notes.

Passwords do not belong in task prompts. Connections display references and permitted uses. Normal takeover pauses agent input; it is not a private login session. Production private login requires a separate human-only channel that excludes agent observation, recording, DOM extraction, clipboard and inference. Where that separation cannot be enforced, require local login. See [credential design](05-credentials.md).

## Enrollment and recovery

Adding a device has three stages: choose its OS, compare the simulated code and fingerprint, then plan its first task. Enrollment alone grants no file, desktop or account access. Production owner identity, recovery setup, signed installers, authenticated pairing, OS consent and readiness checks remain future work.

Manual takeover pauses desktop input before handoff; returning control leaves work paused. A real workspace must show frame age, capture status and session owner. The current screen previews are illustrations.

Global stop disables new work and reports reachable acknowledgement versus offline uncertainty. Reconnect resolves pending cancellation without resuming the task. The proposed lease stops new input/actions after 30 seconds from renewal; the managed-process watchdog target is 35 seconds. Neither mechanism undoes committed external effects.

## Acceptance

Review task creation, decisions, enrollment, takeover and cancellation at desktop and phone widths. Include keyboard operation, closed-disclosure validation errors, focus restoration, 200% zoom, long text, screen-reader announcements and reduced motion. Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/).

The [ECC review](12-ux-review.md) records source findings and selected color calculations. The [validation record](11-validation.md) is the authority for completed browser checks and remaining gaps. Browser tests do not establish production security or observed usability with real users.
