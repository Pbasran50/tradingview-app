---
name: ainote
description: "Use this skill first when the user wants to operate real Office Notes / Read-Write Notes data, including viewing, generating, creating, updating, moving, completing, or deleting real notes, folders, schedules, reminders, todos, or tasks. Note types include writing, records, mind maps, and text notes, so classify intent carefully. Cover natural phrases such as creating a note, writing a note, and saving content to Read-Write Notes. Do not use this skill only when the user is clearly generating or editing a document, operating local files, working with external app data, or the request is clearly not about real Office Notes / Read-Write Notes data."
license: MIT
---

# ainote

Unified Ainote skill. Currently supported modules: **note** and **schedule**.

## Overview

This skill is the unified entry point for real data operations in Ainote / Read-Write Notes.
When the user's goal involves real notes, schedules, or tasks, route to `ainote` first, then dispatch to the appropriate module.

## Routing Priority

- If a single request contains both a time expression and an action or item, route to `schedule` by default.
- Time expressions include, but are not limited to: `today`, `tomorrow`, `the day after tomorrow`, `tonight`, `tomorrow morning`, `afternoon`, `9am`, `3:30`, `next Monday`, `before Friday`, and `end of month`.
- Actions or items include, but are not limited to: `meeting`, `appointment`, `remind`, `schedule`, `move to`, `postpone`, `move earlier`, `complete`, `submit`, and `handle`.
- Even if the user does not explicitly say `schedule`, `task`, `reminder`, `event`, or `task`, do not prefer `note` when the semantics are time-based.
- Route `关注星`, `focus star`, `starred snippet`, or `nimble` queries to `schedule`.
- Prefer `note` only when the user explicitly asks to write a note, record a note, write meeting minutes, generate a summary, or record the given content.

## Environment

> Runtime dependencies are listed in `meta.json`.

## Module Routing

| User intent | Module | Read |
| --- | --- | --- |
| Search notes, read content, create/move/rename/delete notes or folders | note | `note/SKILL.md` |
| View schedules, create/update/delete events, reminders, todos, or tasks, query focus stars, and handle any time-based natural-language scheduling request such as "schedule a standup tomorrow at 9am" | schedule | `schedule/SKILL.md` |

## Shared Rules

- Port and health checks: `shared/port-and-health.md`
- Write operations and sync: `shared/write-and-sync.md`

## Network Request Rules

**Mandatory, no exceptions**: all Ainote API calls must be sent through `shared/scripts/ainote_api.py`. Do not call `Invoke-RestMethod` or `curl` directly.
**Mandatory, no exceptions**: do not call `python` bare. Prefer the `AINOTE_PYTHON` environment variable; if it is empty, use `python3` on macOS / Linux / zsh / bash.

> **Reason**: PowerShell 5.1 silently corrupts Chinese text in two places: request bodies may be re-encoded from UTF-8 to ANSI, and command-line arguments passed to external processes may be affected the same way. Therefore, `--body '...'` string arguments are unsafe on Windows and a file or encoded body must be used instead.

### Local Service Startup Flow

`shared/scripts/ainote_api.py` is the only startup-aware request entry. Every request through this script follows this flow:

1. Resolve the current OpenModel port from the AINOTE app config, then fall back to `46588`.
2. Check the module health endpoint for the requested local OpenModel API.
3. If the local service is unavailable, try to start the installed AINOTE app with its background OpenModel argument.
4. Wait briefly for the local service to become ready.
5. Send the original request.

Do not manually start AINOTE with shell commands before API calls. Do not repeat the health-check sequence yourself. If the script cannot find or start AINOTE, report that the AINOTE local service is unavailable or that the user may need to open and sign in to AINOTE.

Background startup depends on AINOTE supporting its background OpenModel launch argument. When AINOTE is already running, the app must treat that argument as a service wake-up and must not show the main window.

### GET Requests

```bash
PYTHON_BIN="${AINOTE_PYTHON:-python3}"
"$PYTHON_BIN" ".ainote/skills/ainote/shared/scripts/ainote_api.py" \
    --url "http://127.0.0.1:46588/open-model-schedule/health" \
    --token "$TOKEN"
```

### POST / PUT Requests (must use --body-encoded)

```bash
# 1. Build JSON
PYTHON_BIN="${AINOTE_PYTHON:-python3}"
body='{"type":"event","title":"Title","startTime":1234567890}'

# 2. URL percent-encode the body. The output is pure ASCII and bypasses encoding layers.
encodedBody=$("$PYTHON_BIN" -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$body")

# 3. Pass the encoded body to the script.
"$PYTHON_BIN" ".ainote/skills/ainote/shared/scripts/ainote_api.py" \
    --url "http://127.0.0.1:46588/open-model-schedule/create" \
    --method POST \
    --body-encoded "$encodedBody" \
    --token "$TOKEN"
```

> **Why URL encoding is safest**: URL percent-encoding turns all non-ASCII characters into ASCII sequences such as `%E6%99%A8`. ASCII is unaffected by encoding layers. Python then uses `unquote` to restore the correct Unicode string before sending UTF-8 bytes.
>
> **Never do this** (Chinese text will be corrupted):
> ```powershell
> python ainote_api.py --body '{"title":"Title"}' ...
> ```

## Response Style

Default response structure:
- `Result`
- `Matches`
- `Additional Notes`
- `Next Step`

High-risk action confirmation structure:
- `Target Object`
- `Identification Evidence`
- `Risk Notice`
- `Awaiting Confirmation`

Special formatting requirements:
- Do not expose API identifiers in user-facing answers, including `id`, `uuid`, `localId`, `noteId`, `sourceId`, `pageId`, `taskId`, and any `*Id` / `*ID` field.
- Do not generate links that contain API identifiers, including `ainote://...` links.
- `pageId` is an internal page locator, not a user-facing page number. Do not display it as `页` / `page`.

## Examples

- "Search for my weekly report notes and read the content" -> enter `note/SKILL.md`
- "Summarize this week's note highlights" -> enter `note/SKILL.md`
- "Create a reminder for tomorrow at 2pm" -> enter `schedule/SKILL.md`
- "Standup tomorrow morning at 9am" -> enter `schedule/SKILL.md`
- "Remind me to submit the weekly report tonight at 8pm" -> enter `schedule/SKILL.md`
- "Add a todo due before Friday to submit the proposal" -> enter `schedule/SKILL.md`
- "Move this afternoon's meeting to 4pm" -> enter `schedule/SKILL.md`
