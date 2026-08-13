---
name: note
description: "Use this module when the user needs to operate real notes or folders in Ainote / Read-Write Notes, including searching, reading content, creating, moving, renaming, deleting, collecting note material by time range, or asking about note/open-model-note APIs."
---

# ainote note

## Overview

This module handles real note and folder operations in Ainote / Read-Write Notes.
It only handles reading, searching, creating, moving, renaming, deleting, and reading note content.

## Before You Start

- Read `references/open-model-note-api.md` first.
- Follow `../shared/port-and-health.md`.
- Follow `../shared/write-and-sync.md`.
- **Mandatory**: all API calls must go through `../shared/scripts/ainote_api.py`. See "Network Request Rules" in the root `SKILL.md`.

## Core Flow

1. Query before performing any write operation.
2. Choose the read API by scenario; do not always use `search`.
3. Perform writes only after grounding the operation in real results.
4. Confirm the target before deleting anything.
5. After a successful write, decide whether to call `/open-model/sync` according to the shared rules.

## API Scope

- `/open-model-note/health`
- `/open-model-note/list`
- `/open-model-note/search`
- `/open-model-note/file/content`
- `/open-model-note/file/create`
- `/open-model-note/folder/create`
- `/open-model-note/file/delete`
- `/open-model-note/folder/delete`
- `/open-model-note/file/rename`
- `/open-model-note/folder/rename`
- `/open-model-note/file/move`
- `/open-model-note/folder/move`

## Working Rules

- For time-range reading or summarization requests, prefer `fileList`; do not start with `search`.
- These requests include, but are not limited to: notes from this week, today's notes, recent notes, daily report material, weekly report material, and summarizing this week's note highlights.
- `search` is suitable only for finding notes or folders by name. It is not suitable for finding material by time range.
- `list` is suitable when the directory or parent folder id is known. It should not replace time-range filtering.
- Narrow the candidate set before reading note content.
- Before deleting a file or folder, confirm the `id`, name, and type.
- When creating a file, keep only the minimum inputs: `parentId`, `name`, and `markdown`.
- File creation must use a POST JSON request. The body must be a JSON object. Do not use URL query strings, form bodies, or bare strings such as `parentId=root`.
- The `markdown` field for file creation must be real Markdown: use `#` for headings, `-` or `1.` for lists, and `**text**` for bold. Do not send HTML tags such as `<h1>`, `<ul>`, `<li>`, or `<b>`.
- If the source material already contains HTML tags, convert it to Markdown before calling the create API. Do not pass HTML through as `markdown`.
- When creating a folder, keep only the minimum inputs: `parentId` and `name`.

## Reading Strategy

- User searches notes by name: `search` -> `file/content` if needed.
- User browses a directory: `list` -> `file/content` if needed.
- User gathers material by time range: `fileList` -> call `file/content` for each candidate.
- If the user asks to summarize, organize, or extract key points from recent, weekly, or daily notes, first narrow the range with `fileList`, then read content. Do not answer that nothing was found without checking.

## Response Style

- `Result`
- `Matches`
- `Content Summary`
- `Next Step`
