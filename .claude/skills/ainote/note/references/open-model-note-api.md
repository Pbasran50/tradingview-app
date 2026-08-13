# open-model-note API

## Required Constraints

- Port, default entry, and health-check rules are defined in `../shared/port-and-health.md`.
- High-risk write operations and confirmation rules are defined in `../shared/write-and-sync.md`.
- Text request-body encoding constraints are defined in `../shared/encoding-rules.md`.

---

## Quick Decision

| User intent | API |
| --- | --- |
| Check whether note capability is available | `GET /open-model-note/health` |
| Browse by directory or list notes under a folder | `GET /open-model-note/list` |
| View only note files or filter notes by keyword/time | `GET /open-model-note/fileList` |
| Search notes or find notes whose names contain a keyword | `GET /open-model-note/search` |
| Read note content | `GET /open-model-note/file/content` |
| Create a note or create a note from Markdown | `POST /open-model-note/file/create` |
| Create a folder | `POST /open-model-note/folder/create` |
| Rename a note | `POST /open-model-note/file/rename` |
| Rename a folder | `POST /open-model-note/folder/rename` |
| Move a note | `POST /open-model-note/file/move` |
| Move a folder | `POST /open-model-note/folder/move` |
| Delete a note | `POST /open-model-note/file/delete` |
| Delete a folder | `POST /open-model-note/folder/delete` |

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

### OpenModelNoteItem

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Object id |
| `name` | string | Name |
| `type` | `folder \| file` | Object type |
| `updateTime` | number | Update time |

### OpenModelNoteFileContent

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | File id |
| `name` | string | File name |
| `type` | `1 \| 2 \| 10 \| 20 \| 21 \| ...` | Note type |
| `content` | string | Normalized body text |

---

## API Details

### 1. Health Check

GET `/open-model-note/health`

**Trigger scenario**: the user wants to confirm whether the local note capability is available.

#### Request Parameters

None.

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | boolean | Whether the capability is enabled |
| `status` | string | Service status |
| `service` | string | Service name, usually `open-model-note` |
| `capabilities` | string[] | List of currently available APIs |

#### Response Example

```json
{
  "enabled": true,
  "status": "ok",
  "service": "open-model-note",
  "capabilities": [
    "/open-model-note/health",
    "/open-model-note/list",
    "/open-model-note/fileList"
  ]
}
```

---

### 2. List

GET `/open-model-note/list`

**Trigger scenario**: the user knows the directory and wants to see files and folders under a specific folder.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `parentId` | string | No | Parent folder id. Defaults to `0`. |
| `recursive` | boolean | No | Whether to recursively list files and folders under child folders. Defaults to `false`. |
| `startTime` | number | No | Modification-time start |
| `endTime` | number | No | Modification-time end |

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `data` | `OpenModelNoteItem[]` | Files and folders in the current directory |

#### Notes

- The root directory merges notes whose `dirId` is `0` and notes with an empty directory.
- When `recursive=true`, the API returns folders and notes in the entire subtree under `parentId`. The result is still a flat list and does not include `parentId` itself.
- Deleted items and items in the recycle bin are filtered out.
- If `startTime` / `endTime` is provided, the result is filtered by `updateTime` as a closed interval.

---

### 3. File List

GET `/open-model-note/fileList`

**Trigger scenario**: the user only wants note files without folders, or needs to filter daily/weekly report material by keyword and time range.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `keyword` | string | No | Comma-separated keywords matched against note names or summaries |
| `keywords` | string | No | Same as `keyword` |
| `startTime` | number | No | Modification-time start |
| `endTime` | number | No | Modification-time end |

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `data` | `OpenModelNoteItem[]` | Note files only |

#### Notes

- Folders are not returned.
- Multiple keywords use an "any keyword matches" strategy.
- Search is case-insensitive.
- If `startTime` / `endTime` is provided, the result is further filtered by `updateTime`.

---

### 4. Search

GET `/open-model-note/search`

**Trigger scenario**: the user searches notes or folders by name.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `keyword` | string | Yes | Search keyword |
| `startTime` | number | No | Modification-time start |
| `endTime` | number | No | Modification-time end |

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `data` | `OpenModelNoteItem[]` | Matching folders and files |

#### Notes

- Searches by name only.
- Both folders and notes may match.
- Search is case-insensitive.
- If `startTime` / `endTime` is provided, the result is further filtered by `updateTime`.

---

### 5. Get File Content

GET `/open-model-note/file/content`

**Trigger scenario**: the user wants to read note body text, summarize it, or analyze it further.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | File id |

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `data` | `OpenModelNoteFileContent` | File content object |

#### Supported Types

| Type | Normalization |
| --- | --- |
| `RICH` | Prefer `contentText`; otherwise strip tags from HTML |
| `RECORD` | Read transcription text files and normalize paragraphs |
| `COMPLEX` | Extract text by page and block |
| `MIND` | Convert to tree-style list text |
| `MIXTURE` | Concatenate by page and fall back to regular content when needed |

---

### 6. Create File

POST `/open-model-note/file/create`

**Trigger scenario**: the user wants to create a note or save Markdown content as a note.

#### Request Format

- Must use `POST`.
- Request header must be `Content-Type: application/json; charset=utf-8`.
- Request body must be a JSON object. URL query strings, form bodies, and bare strings such as `parentId=root` are not supported.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `parentId` | string | No | Parent folder id. Defaults to `0`. |
| `name` | string | Yes | File name |
| `markdown` | string | No | Markdown content. May be empty. |

#### Request Example

```json
{
  "parentId": "0",
  "name": "20260430 Market Highlights",
  "markdown": "# Daily Highlights\n\n- **US stocks**: Example content"
}
```

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | New file id |
| `name` | string | New file name |

#### Response Example

```json
{
  "id": "noteId",
  "name": "noteName"
}
```

#### Notes

- `markdown` must be real Markdown: use `#` for headings, `-` or `1.` for lists, and `**text**` for bold. Do not pass HTML tags such as `<h1>`, `<ul>`, `<li>`, or `<b>`.
- Internally, Markdown is converted to HTML before the note is created.

---

### 7. Create Folder

POST `/open-model-note/folder/create`

**Trigger scenario**: the user wants to organize the directory structure by creating a new folder.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `parentId` | string | No | Parent folder id. Defaults to `0`. |
| `name` | string | Yes | Folder name |

#### Notes

- The parent directory is validated before creation.

---

### 8. Rename File

POST `/open-model-note/file/rename`

**Trigger scenario**: the user wants to change a note title.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | File id |
| `name` | string | Yes | New file name |

#### Notes

- Only note metadata is updated; no content-update marker is triggered.

---

### 9. Rename Folder

POST `/open-model-note/folder/rename`

**Trigger scenario**: the user wants to change a folder name.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Folder id |
| `name` | string | Yes | New folder name |

#### Notes

- Direct child notes under the folder have their `dirName` updated as well.

---

### 10. Move File

POST `/open-model-note/file/move`

**Trigger scenario**: the user wants to move one or more notes to another folder.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | File id. Multiple ids are supported as a comma-separated string. |
| `parentId` | string | No | Target folder id. Defaults to `0`. |

#### Notes

- Only the owning directory is changed; ordering is not handled.
- Batch moves run sequentially. If one item fails, subsequent processing stops.

---

### 11. Move Folder

POST `/open-model-note/folder/move`

**Trigger scenario**: the user wants to adjust the folder hierarchy.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Folder id. Multiple ids are supported as a comma-separated string. |
| `parentId` | string | No | Target folder id. Defaults to `0`. |

#### Notes

- Moving the root directory is not supported.
- A folder cannot be moved into itself or into one of its descendants.
- If a same-name folder already exists in the target directory, the moved folder is automatically renamed to `Name(1)`, `Name(2)`, and so on.
- Batch moves run sequentially. If one item fails, subsequent processing stops.

---

### 12. Delete File

POST `/open-model-note/file/delete`

**Trigger scenario**: the user has explicitly confirmed deleting one or more notes.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | File id. Multiple ids are supported as a comma-separated string. |

#### Notes

- The underlying call uses the recycle-bin deletion logic `recycleNote`.
- Confirm that the target exists before deleting.
- Batch deletes run sequentially. If one item fails, subsequent processing stops.

---

### 13. Delete Folder

POST `/open-model-note/folder/delete`

**Trigger scenario**: the user has explicitly confirmed deleting an entire folder tree.

#### Request Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Folder id. Multiple ids are supported as a comma-separated string. |

#### Notes

- Child folders are deleted recursively.
- All notes under the folder are moved into the recycle-bin/delete flow.
- This is riskier than deleting a single file and must be confirmed before calling the API.
- Batch deletes run sequentially. If one item fails, subsequent processing stops.
