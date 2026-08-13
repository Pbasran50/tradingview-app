# open-model-schedule API

## Required Constraints

- Port, default entry, and health-check rules are defined in `../shared/port-and-health.md`.
- Write operations and `/open-model/sync` rules are defined in `../shared/write-and-sync.md`.
- Text request-body encoding constraints are defined in `../shared/encoding-rules.md`.

---

## Quick Decision

| User intent | API |
| --- | --- |
| Confirm whether schedule capability is available | `GET /open-model-schedule/health` |
| View schedules and tasks for today or a date range | `GET /open-model-schedule/overview` |
| Read details for an event or task | `GET /open-model-schedule/item` |
| Search focus stars by time or keyword | `GET /open-model-schedule/nimble/list` |
| Read one focus-star detail with optional source note and related schedule tasks/todos | `GET /open-model-schedule/nimble/detail` |
| Create an event | `POST /open-model-schedule/create` |
| Create a task | `POST /open-model-schedule/create` |
| Update an event or task | `POST /open-model-schedule/update` |
| Delete an event or task | `POST /open-model-schedule/delete` |
| Complete, uncomplete, or move a task | `POST /open-model-schedule/operate` |
| Sync after a successful write | `POST /open-model/sync` |

---

## Common Response

### Success

```json
{
  "code": 200,
  "msg": "Success",
  "data": {}
}
```

### Failure

```json
{
  "code": 500,
  "msg": "Error message"
}
```

---

## Data Structures

### OpenModelScheduleEventItem

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Event id |
| `uuid` | string | Event uuid |
| `title` | string | Title |
| `summary` | string | Summary |
| `startTime` | number | Start time |
| `endTime` | number | End time |
| `startDay` | number | Start date |
| `endDay` | number | End date |
| `remindTime` | number | Absolute reminder time |
| `advanceTime` | number | Lead time relative to the start time |

### OpenModelScheduleTaskItem

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Task id |
| `title` | string | Task title |
| `localId` | string | Owning directory id |
| `doneFlag` | number | Completion status |
| `expireTime` | number | Due time |

### OpenModelScheduleNimbleItem

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Internal focus-star id. Do not return to the user |
| `localId` | string | Internal focus-star local id. Do not return to the user |
| `content` | string | Focus-star snippet |
| `updateTime` | number | Update time |
| `starFlag` | boolean | Whether it is marked as important |
| `noteId` | string | Internal source note id. Do not return to the user |
| `noteType` | number | Source note type |
| `pageId` | number/string | Internal page locator, not a user-facing page number |
| `noteName` | string | Source note title when available |
| `sourceId` | number/string | Internal source payload id. Do not return to the user |

### OpenModelScheduleNimbleDetailResult

| Field | Type | Description |
| --- | --- | --- |
| `item` | `OpenModelScheduleNimbleItem` | Focus-star detail |
| `sourceNote` | object/null | Source note detail when requested |
| `relatedTasks` | `OpenModelScheduleTaskItem[]` | Related schedule tasks/todos when requested |

---

## API Details

### 1. Health Check

GET `/open-model-schedule/health`

**Trigger scenario**: the user wants to confirm whether the local schedule capability is available.

#### Request Parameters

None.

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | boolean | Whether the capability is enabled |
| `status` | string | Service status |
| `service` | string | Service name, usually `open-model-schedule` |
| `capabilityDetails` | array | Current capability list |
| `message` | string | Message shown when the capability is not enabled |
| `configPath` | string | Config file path |

#### Response Example

```json
{
  "code": 200,
  "msg": "Success",
  "data": {
    "enabled": true,
    "status": "ok",
    "service": "open-model-schedule",
    "capabilityDetails": [
      { "path": "/open-model-schedule/health", "description": "Check schedule API health" },
      { "path": "/open-model-schedule/overview", "description": "Get schedule and task overview for one day or a date range" },
      { "path": "/open-model-schedule/item", "description": "Get details for one schedule or task" },
      { "path": "/open-model-schedule/create", "description": "Create a schedule or task" },
      { "path": "/open-model-schedule/update", "description": "Update a schedule or task" },
      { "path": "/open-model-schedule/delete", "description": "Delete a schedule or task" },
      { "path": "/open-model-schedule/operate", "description": "Complete, uncomplete, or move a task" }
    ]
  }
}
```

---

### 2. Overview Query

GET `/open-model-schedule/overview`

**Trigger scenario**: the user wants to view events and tasks for a day or a date range.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `day` | string | No | Single-day query, for example `2026-04-24` |
| `startDay` | string | No | Start date for range query |
| `endDay` | string | No | End date for range query |

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `scope` | string | `day` or `range` |
| `day` | string | Returned for a single-day query |
| `startDay` | string | Returned for a range query |
| `endDay` | string | Returned for a range query |
| `events` | `OpenModelScheduleEventItem[]` | Event list |
| `tasks` | `OpenModelScheduleTaskItem[]` | Task list |

#### Notes

- Supports both single-day queries and range queries.
- Invalid date ranges return an error, for example when the start date is later than the end date.

Single-day query example:

```http
GET /open-model-schedule/overview?day=2026-04-24
```

Range query example:

```http
GET /open-model-schedule/overview?startDay=2026-04-24&endDay=2026-04-30
```

---

### 3. Single Item Details

GET `/open-model-schedule/item`

**Trigger scenario**: the user has identified an event or task and wants to read details.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | string | Yes | `event` or `task` |
| `id` | string | Conditionally required | Required for task details. For event details, either `id` or `uuid` may be used. |
| `uuid` | string | Conditionally required | Available only for event details. Mutually exclusive with `id`. |

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `type` | string | `event` or `task` |
| `item` | object | Detail object for the corresponding type |

Event query example:

```http
GET /open-model-schedule/item?type=event&uuid=event-301
```

Task query example:

```http
GET /open-model-schedule/item?type=task&id=task-301
```

---

### 4. Focus-Star List Query

GET `/open-model-schedule/nimble/list`

**Trigger scenario**: the user wants to query focus stars by time or keyword.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `keyword` | string | No | Keyword matched against focus-star content and source note title |
| `startTime` | number/string | No | Start timestamp boundary |
| `endTime` | number/string | No | End timestamp boundary |
| `day` | string | No | Single-day query, for example `2026-04-24` |
| `startDay` | string | No | Start date for range query |
| `endDay` | string | No | End date for range query |
| `limit` | number/string | No | Maximum number of matched items |

#### Notes

- This is read-only. Do not call `/open-model/sync`.
- Use returned identifiers only for follow-up detail requests.
- Do not show `id`, `localId`, `noteId`, `sourceId`, or `pageId` to the user.
- `pageId` is not a page number.

---

### 5. Focus-Star Detail Query

GET `/open-model-schedule/nimble/detail`

**Trigger scenario**: the user wants one focus-star detail, its source note, or related schedule tasks/todos.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number/string | Conditionally required | Internal focus-star id. Required when `localId` is omitted |
| `localId` | string | Conditionally required | Internal focus-star local id. Required when `id` is omitted |
| `includeSourceNote` | boolean/string/number | No | Include source note detail when truthy |
| `includeRelatedTasks` | boolean/string/number | No | Include related schedule tasks/todos when truthy |
| `taskId` | string | No | Optional internal task id filter |

#### Notes

- This is read-only. Do not call `/open-model/sync`.
- Use `includeSourceNote=true` when the user asks for the source note.
- Use `includeRelatedTasks=true` when the user asks for related schedule tasks/todos.
- Do not return ids or identifier-bearing links to the user.

---

### 6. Create

POST `/open-model-schedule/create`

**Trigger scenario**: the user wants to create an event or task.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | string | Yes | `event` or `task` |

Event:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Conditionally required | Mutually exclusive with `summary`; at least one is required. Defaults to `""`. |
| `summary` | string | Conditionally required | Mutually exclusive with `title`; at least one is required. Defaults to `title`, otherwise `""`. |
| `startTime` | number/string | Yes | Parseable start time |
| `endTime` | number/string | Yes | Parseable end time |
| `remindTime` | number/string | No | Absolute reminder time. Omitted by default. |

Task:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | Task title |
| `expireTime` | number/string | No | Due time. Omitted by default. |
| `localId` | string | No | Task-list id. Defaults to `"0"`. |

#### Additional Parameters For Complex Operations

Pass these fields only for complex creation scenarios.

Event:

| Field | Type | Description |
| --- | --- | --- |
| `startTimeStr` | string | Start-time string |
| `endTimeStr` | string | End-time string |
| `advanceTime` | number/string | Lead time relative to the start time |
| `repeatDays` | string | Repeating weekday configuration |
| `repeatStartTime` | number/string | Repeat start time |
| `repeatEndTime` | number/string | Repeat end time |
| `startDay` | number/string | Start date |
| `endDay` | number/string | End date |
| `hasScheduleTime` | boolean/string/number | Whether a concrete time exists |
| `configTime` | boolean/string/number | Whether time has been configured |
| `sn` | string | Source identifier |
| `allDayAdvTime` | number/string | All-day reminder lead time |
| `desc` | string | Description |
| `extInfo` | string | Extended information |

Task:

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Task id |
| `doneFlag` | number/string | Completion status |
| `fromNote` | number/string | Whether it comes from a note |
| `extInfo` | string | Extended information |
| `advanceTime` | number/string | Lead time |
| `allDayAdvTime` | number/string | All-day reminder lead time |
| `hasScheduleTime` | boolean/string/number | Whether a concrete time exists |
| `configTime` | boolean/string/number | Whether time has been configured |

Task due-time rules:

- When the user expresses a task deadline such as due by, deadline, before Friday, or before tonight, pass the parsed deadline through `expireTime`.
- `expireTime` may be a millisecond timestamp, second timestamp, `YYYY-MM-DD HH:mm:ss`, `YYYY-MM-DD HH:mm`, ISO time, `YYYYMMDDHHmmss`, or another parseable string.
- If `expireTime` includes a specific hour and minute, it is automatically treated as a non-all-day task. Date-only deadlines are treated as all-day tasks.
- If `expireTime` includes a specific hour and minute and no reminder configuration is explicitly passed, the default reminder is 5 minutes before the due time.
- Task reminder time is expressed through `advanceTime` in milliseconds. A non-`-1` `advanceTime` enables the reminder; `advanceTime: -1` means no reminder.

#### Reminder-Time Rules

| Rule | Description |
| --- | --- |
| Both `remindTime` and `advanceTime` are provided | `remindTime` takes precedence |
| Internal processing | `advanceTime` is derived from `startTime - remindTime` |

Create event example:

```json
{
  "type": "event",
  "title": "Project meeting",
  "summary": "Discuss schedule",
  "startTime": 1770002400000,
  "endTime": 1770006000000,
  "remindTime": 1770001500000
}
```

Create task example:

```json
{
  "type": "task",
  "title": "Write weekly report",
  "localId": "0",
  "expireTime": 1770020000000
}
```

---

### 7. Update

POST `/open-model-schedule/update`

**Trigger scenario**: the user wants to update an event or task.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | string | Yes | `event` or `task` |

Event:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number/string | Conditionally required | Mutually exclusive with `uuid`; at least one is required. |
| `uuid` | string | Conditionally required | Mutually exclusive with `id`; at least one is required. |
| `title` | string | No | Preserve the original value when omitted. |
| `summary` | string | No | Preserve the original value when omitted. |
| `startTime` | number/string | No | Preserve the original value when omitted. |
| `endTime` | number/string | No | Preserve the original value when omitted. |
| `remindTime` | number/string | No | Preserve the original value when omitted. |

Task:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Task id |
| `title` | string | No | Preserve the original value when omitted. |
| `expireTime` | number/string | No | Preserve the original value when omitted. |
| `localId` | string | No | Preserve the original value when omitted. |

#### Additional Parameters For Complex Operations

Pass these fields only for complex update scenarios. Omitted fields preserve their original values.

Event:

| Field | Type | Description |
| --- | --- | --- |
| `startTimeStr` | string | Start-time string |
| `endTimeStr` | string | End-time string |
| `advanceTime` | number/string | Lead time relative to the start time |
| `repeatDays` | string | Repeating weekday configuration |
| `repeatStartTime` | number/string | Repeat start time |
| `repeatEndTime` | number/string | Repeat end time |
| `startDay` | number/string | Start date |
| `endDay` | number/string | End date |
| `hasScheduleTime` | boolean/string/number | Whether a concrete time exists |
| `configTime` | boolean/string/number | Whether time has been configured |
| `sn` | string | Source identifier |
| `allDayAdvTime` | number/string | All-day reminder lead time |
| `desc` | string | Description |
| `extInfo` | string | Extended information |

Task:

| Field | Type | Description |
| --- | --- | --- |
| `doneFlag` | number/string | Completion status |
| `fromNote` | number/string | Whether it comes from a note |
| `extInfo` | string | Extended information |
| `advanceTime` | number/string | Lead time |
| `allDayAdvTime` | number/string | All-day reminder lead time |
| `hasScheduleTime` | boolean/string/number | Whether a concrete time exists |
| `configTime` | boolean/string/number | Whether time has been configured |

#### Notes

- This API uses patch semantics: omitted fields preserve their original values.
- When updating a task reminder, passing `advanceTime` is enough. A non-`-1` `advanceTime` enables the reminder; `advanceTime: -1` means no reminder.
- If the underlying update returns a string error, the API passes that error message through directly.

Update event example:

```json
{
  "type": "event",
  "uuid": "event-601",
  "title": "Updated schedule",
  "remindTime": 1770001500000
}
```

Update task example:

```json
{
  "type": "task",
  "id": "task-601",
  "title": "Updated task"
}
```

---

### 8. Delete

POST `/open-model-schedule/delete`

**Trigger scenario**: the user has explicitly confirmed deleting an event or task.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | string | Yes | `event` or `task` |

Event:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number/string | Conditionally required | Mutually exclusive with `uuid`; at least one is required. |
| `uuid` | string | Conditionally required | Mutually exclusive with `id`; at least one is required. |

Task:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Task id |

#### Notes

- This is a risky action that directly modifies real data. Confirm the target first through `overview` or `item`.

Delete event example:

```json
{
  "type": "event",
  "id": 501,
  "uuid": "event-501"
}
```

Delete task example:

```json
{
  "type": "task",
  "id": "task-501"
}
```

---

### 9. Task Operation

POST `/open-model-schedule/operate`

**Trigger scenario**: the user wants to complete a task, uncomplete it, or move it to another directory.

#### Request Parameters

Task:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `action` | string | Yes | `complete` / `uncomplete` / `move` |
| `id` | string | Yes | Task id |
| `localId` | string | Conditionally required | Required when `action` is `move` |

#### Notes

- This API acts only on tasks.
- `type` is not currently required.

| Action | Example |
| --- | --- |
| Complete task | `{ "action": "complete", "id": "task-401" }` |
| Uncomplete task | `{ "action": "uncomplete", "id": "task-402" }` |
| Move task | `{ "action": "move", "id": "task-403", "localId": "dir-2" }` |

---

### 10. Sync After Write

POST `/open-model/sync`

**Trigger scenario**: call sync after `create`, `update`, `delete`, or `operate` succeeds.

#### Request Parameters

None.

#### Notes

- This is the sync-after-write API. It does not replace specific business write APIs.
- If the current action is read-only, do not call it.
- A successful response only means the sync flow was triggered. It does not guarantee that the remote side has completed and become visible.
