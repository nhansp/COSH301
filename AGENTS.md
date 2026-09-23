## Commit style

Short, precise. If there's nothing big to explain, can even omit commit message, and just leave the title.

Title remains <= 80 chars, and Description stays 1-2 sentences, unless the change is too big to explain
shortly.

Goes like:

```patch
[subsystem]: [Title]

[Description...]

Co-authored-by: ...
Signed-off-by: ...
```

, which also means always use `--signoff`.

## Coding style

Maintainable code. Comments are recommended IF it helps clarifying intentions, NOT if the code is already
self-explainable.

## Integration with LLM chats

Do not share users' chat contexts into the code. All comments, code, and commit messages must only relate
to the codebase only.

