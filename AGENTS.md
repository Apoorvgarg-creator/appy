# Repository Guidelines

## Project Structure and Module Organization

Appy currently contains a researched product plan and an interactive wireframe; device agents and backend services are not implemented. Start with `README.md`. Numbered files in `docs/` cover product, architecture, platforms, security, credentials, user experience, milestones, testing, research, operations, and artifact validation. `docs/wireframes/index.html` is a standalone HTML/CSS/JavaScript prototype with fictional data. Keep raw research in the ignored `.firecrawl/` directory.

## Development and Review Commands

Run `python3 -m http.server 8080 --bind 127.0.0.1 --directory docs/wireframes` from the repository root, then open `http://127.0.0.1:8080` to preview the wireframe. Opening the HTML file directly also works. No dependency installation, application build, production deployment, or backend test command exists yet. Commands and tooling proposed in the plans are future implementation work.

## Coding Style and Naming Conventions

Use descriptive Markdown headings, relative links, and concise explanations. Preserve the numbered `docs/NN-topic.md` naming pattern. Distinguish verified platform facts, proposed architecture, acceptance targets, and measured results. Cite primary sources beside technical claims and record research dates. Use two-space indentation for new HTML, CSS, and JavaScript; prefer semantic controls, explicit labels, and escaped user text. No formatter or linter is configured yet.

## Testing Guidelines

Check document links, code fences, and consistency across architecture, security, and roadmap changes. For wireframe changes, exercise navigation, task preview, approval/denial, takeover, pairing, and stop/reconnect behavior at desktop and mobile widths. Record actual checks and limitations in `docs/11-validation.md`. Production test frameworks and release gates are specified in `docs/08-testing.md`; they are not implemented tests.

## Commit and Pull Request Guidelines

No Git history exists in this workspace, so no historical convention can be inferred. Use concise imperative subjects, optionally with `docs:` or `ui:` prefixes. Pull requests should explain the change, link the relevant milestone or issue, record validation, and include screenshots for visual changes. Flag changed security assumptions explicitly. Never commit credentials, real personal screenshots, research-session tokens, or claims of completed security certification.
