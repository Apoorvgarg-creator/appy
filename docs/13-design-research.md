# Design research: a quieter dark workspace

Researched **14 October 2026** using ECC's research method and Firecrawl web search. The user's feedback sets the direction: a dark theme, consistent corners and substantially less visible information. These sources inform the design; they do not establish that the revision is easier to use.

## Research to design decisions

| Primary source | What it supports | Appy decision inferred from it |
| --- | --- | --- |
| [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Show frequent, essential options first. Secondary controls need clear labels and an obvious route. Excessive disclosure levels also add friction. | Home starts with the goal and current work. Device specifications, model configuration and history move to their existing dedicated views. Keep task creation to plan and review. |
| [NN/g: Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/) | Unnecessary information competes with relevant information. Minimalism still requires everything needed to complete the task. Decorative content should justify its presence. | Remove repeated reassurance, promotional copy and decorative task illustrations. Keep status, next action and task name. Do not reduce density by shrinking text. |
| [Carbon: Color](https://www.carbondesignsystem.com/building-blocks/foundations/color) | Neutral values organize content into zones; accents are used sparingly. Dark-theme layers become lighter as they move above the background. | Use a dark neutral canvas and lighter content surfaces. Composer and dialogs share the surface token; a dimmed backdrop separates dialogs. Give the primary action one accent; reserve amber and red for decisions and stopping. |
| [Material 2: Dark theme](https://m2.material.io/design/color/dark-theme.html) | Dark-gray surfaces, limited color accents and lighter elevated surfaces form a coherent dark interface. Contrast must work at each elevation. | Check text, focus and form boundaries against every surface used. Do not invert the old palette or replace contrast with faint gray text. This is established Material 2 guidance, not a claim about current Material 3 requirements. |
| [Carbon: Themes](https://www.carbondesignsystem.com/building-blocks/foundations/themes) | Role-based tokens apply values consistently across components; changing a shared token updates the system. | Define shared surface, text, border, focus and radius tokens. Use one radius for rectangular controls, panels and dialogs; reserve circles for actual circular elements. The radius choice is ours, not a research finding. |
| [Inter: Official typeface documentation](https://rsms.me/inter/) | Inter is designed for uses including detailed interfaces. Its text designs emphasize lowercase legibility; the family is open source under SIL OFL 1.1. | Bundle Regular, Medium and SemiBold locally. Use a consistent interface face without a runtime font-service request; retain the license with the assets. |
| [Carbon: Typography type sets](https://www.carbondesignsystem.com/building-blocks/foundations/typography/type-sets) | Product typography uses defined roles and scales; Carbon's productive base is 14px, while expressive typography uses 16px. | Replace tiny labels with a deliberate Appy scale: 15px body, 14px primary buttons, 13px metadata and 28/32px page headings. These exact sizes are our choice, not a Carbon requirement or an accessibility guarantee. |

## Four concrete reductions to Home

1. **Remove the right-hand rail.** The full device list, local-model explanation and sample-download promotion each compete with the task composer. Devices and Connections already provide destinations for those details; open Devices when inventory or readiness is needed.
2. **Replace illustrated task cards with compact rows.** Show title, state, device and one next action. Put progress history, screenshots, scope and outputs inside the selected task. The intended benefit is easier scanning without introducing more counters.
3. **Move examples behind one “Try an example” control.** Keep the goal field and Plan action dominant. Reveal suggestions on demand; do not add three permanent prompt buttons, route explanations and model badges around the same field.
4. **Remove repeated introductory copy.** Replace eyebrow, marketing headline, section slogan and reassurance footer with one short workspace heading and useful instruction. Identify pending decisions in their task rows and review destination instead of adding a duplicate callout.

These reductions are reflected in the v0.3 `home()` source. They are design decisions, not measured usability outcomes. The initial hierarchy is **goal → recent work**, with pending reviews identified in place.

## What stays visible when it matters

Before execution, keep the selected worker, permission scope and expected result explicit. Before approval, show the exact destination, content, consequence and expiry together. Keep Stop all available and distinguish offline devices from acknowledged stops. Progressive disclosure moves information to the relevant moment; it must not conceal authority or recovery actions. This is an Appy-specific application of the [NN/g guidance on preserving necessary information](https://www.nngroup.com/articles/aesthetic-minimalist-design/).

## Verification boundary

Confidence is **high** that the cited pages support the principles described, and **unvalidated** for Appy's resulting usability. Dark mode follows the user's preference; it is not presented as inherently more usable. Check the new dark colors, focus states, consistent radii, text enlargement and phone layout independently of the earlier light-theme review. Test whether a first-time user can start a task, review a decision and find its result without explanation. Actual checks and environment limitations belong in [validation](11-validation.md).

Method: four targeted web searches plus a direct retrieval of Inter's official page supplied seven primary sources. Raw results remain in ignored `.firecrawl/ux-*` files. No participants, timed task study or competitor benchmark was conducted. Implementation browser checks are recorded separately in [validation](11-validation.md).
