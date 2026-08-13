---
name: schedule
description: "Use this module when the user needs to operate real schedules, reminders, todos, tasks, or focus stars in Ainote / Read-Write Notes, including viewing, creating, updating, deleting, completing, moving, querying focus stars, or expressing time-based arrangements in natural language such as a meeting tomorrow, a reminder tonight, or a task due before Friday."
---

# ainote schedule

## Overview

This module handles real schedule and task operations in Ainote / Read-Write Notes.
If the user is arranging time, creating an event, adding a reminder, recording a todo, completing a task, adjusting time, moving a task, or deleting a schedule, use this module even if the user does not explicitly say `schedule`, `event`, `task`, `reminder`, or `todo`. Natural-language requests such as "standup tomorrow morning at 9am", "one-on-one with Zhang San next Monday at 3pm", "remind me to submit the weekly report tonight", "add a todo due before Friday", "move the afternoon meeting to 4pm", and "complete that reimbursement task" should all match this module directly.
This module also handles read-only focus-star queries.

## Trigger Priority

- If the user expresses "do something at a certain time" in the Ainote / Read-Write Notes / Office Notes context, prefer this module.
- Match action phrases broadly, including meeting, appointment, reminder, todo, task, itinerary, schedule, arrangement, reschedule, postpone, move earlier, complete, and delete.
- Match focus-star phrases including `关注星`, focus star, starred snippet, and nimble.
- Even if `schedule`, `event`, `task`, or `reminder` is not present, enter this module directly when the semantics are about creating or updating a real time-based arrangement.
- If a sentence contains both time information and an action target, interpret it by default as creating or updating an event/task, not as ordinary chat or text polishing.

## Before You Start

- Read `references/open-model-schedule-api.md` first.
- Follow `../shared/port-and-health.md`.
- Follow `../shared/write-and-sync.md`.
- **Mandatory**: all API calls must go through `../shared/scripts/ainote_api.py`. See "Network Request Rules" in the root `SKILL.md`.

## Core Flow

1. Query before performing any write operation.
2. Use `/open-model-schedule/overview` first for read operations.
3. Use `/open-model-schedule/item` for single-item details.
4. Use `/open-model-schedule/nimble/list` for focus-star list queries by time or keyword.
5. Use `/open-model-schedule/nimble/detail` for one focus-star detail, source-note detail, or related schedule task/todo detail.
6. Use `/open-model-schedule/create`, `/open-model-schedule/update`, `/open-model-schedule/delete`, and `/open-model-schedule/operate` for write operations.
7. Confirm the target before deleting, completing, or moving anything.

## API Scope

- `/open-model-schedule/health`
- `/open-model-schedule/overview`
- `/open-model-schedule/item`
- `/open-model-schedule/nimble/list`
- `/open-model-schedule/nimble/detail`
- `/open-model-schedule/create`
- `/open-model-schedule/update`
- `/open-model-schedule/delete`
- `/open-model-schedule/operate`
- `/open-model/sync`

## Timestamp Rules

**Before calculating any event `startTime`, `endTime`, or `remindTime`, run the following command to get the current timestamp. Do not estimate the year from model memory.**

```powershell
# Get the current timestamp in milliseconds.
$nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
Write-Host "Current timestamp (ms): $nowMs"

# Also print local time for verification.
Write-Host "Current local time: $([DateTimeOffset]::Now.ToString('yyyy-MM-dd HH:mm:ss zzz'))"
```

- Use `$nowMs` as the baseline and calculate target times with millisecond offsets. One day is `86400000` ms and one hour is `3600000` ms.
- After calculation, convert the result back to a readable time string and verify that the year is correct before writing the request body.
- **Never** hard-code a year from memory or rough inference.

## Working Rules

- Do not promise legacy `events/*`, `tasks/*`, or `task-lists/*` APIs.
- The current real API does not provide task-list CRUD.
- For event reminders, prefer interpreting and writing `remindTime`. Infer a reasonable reminder time when possible; the default should be 30 minutes before the schedule starts.
- When creating or updating a task, user phrases such as due by, deadline, before Friday, or before tonight must be parsed into `expireTime`. A deadline with a specific hour and minute is shown as a non-all-day task and should default to a reminder 5 minutes before the deadline.
- Task reminder lead time is expressed with `advanceTime` in milliseconds. A non-`-1` `advanceTime` enables the reminder. Use `advanceTime: -1` only when disabling the reminder, and do not use `hasScheduleTime` as a fallback.
- `operate` is only for task items.
- Focus-star APIs are read-only. Do not call `/open-model/sync` after focus-star reads.
- Do not expose focus-star, note, schedule, or task identifiers in the final answer. Use returned ids only for follow-up API calls.
- `pageId` in focus-star data is an internal page locator, not a page number. Do not show it as `页` / `page`.

## Response Style

- `Result`
- `Matches`
- `Additional Notes`
- `Next Step`
