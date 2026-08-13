# Write Operation And Sync Rules

## Real Write Operations

The following actions modify real Ainote data:
- create
- update
- delete
- move
- rename
- complete
- uncomplete

## Confirmation Rules

Before performing a high-risk action, confirm:
- Object identifier
- Object name
- Object type
- Impact scope

This rule applies to `delete`, `move`, `rename`, `complete`, `uncomplete`, and similar direct state-changing actions.

## Sync Rules

- When the underlying flow requires sync after write, call `/open-model/sync` only after the real write succeeds.
- Do not call `/open-model/sync` for read-only operations.
- When reporting results to the user, make it clear that sync only means the sync flow was triggered. It does not guarantee that the remote side has completed and become visible.
