# Instructions for AI agents working in `docs/`

Read the repository root [`AGENTS.md`](../AGENTS.md) first. Its commit and coding rules apply here too.

## Sources of truth

- [`docs/design/README.md`](design/README.md) is the system design. Every document must agree with it.
- [`docs/TASKS.md`](TASKS.md) says which task owns which file.
- Requirement IDs (FR-01 … FR-23, NFR-01 … NFR-13, US-01 … US-07, W-01 … W-05) are fixed. Never renumber them or invent new ones.
- If the design looks wrong or incomplete, say so in the PR description. Do not silently change the design to fit a document.

## Scope

- Touch only the files of the task you are working on.
- Do not create new top-level files or folders.
- Diagrams are Mermaid blocks inside the task's `.md` file. Do not commit exported images, `.docx` or `.pdf`.
- Do not commit scratch scripts, tool output, dependency folders or secrets.

## Writing Vietnamese

Documents are written in Vietnamese.

- Write natively. Do not translate English sentence structure word for word.
- Keep sentences short and complete. No filler, no clipped fragments.
- One idea per line or bullet. Split dense table cells and long sentences.
- Keep code identifiers, table names, endpoints and flag names in English inside backticks.
- No chat residue: no greetings, no "Dưới đây là…", no closing remarks.

## Consistency checks before finishing

- Every entity in a class or sequence diagram matches a table in the ERD or a class in `backend/internal/`.
- Every FR or NFR you mention exists in the design's flag table or the SA document.
- Every DFD data store maps to a real table.
