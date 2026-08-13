# Port And Health Check Rules

## Default Entry

- Default base URL: `http://127.0.0.1:46588`
- All requests must go through `shared/scripts/ainote_api.py`.
- The script resolves the real local port from AINOTE config first, including `%APPDATA%/AINOTE/config/open_model_config.json`, then falls back to legacy lowercase / doxent config paths and finally `46588`.
- Do not hand-write port probing logic in the skill response.

## Automatic Local Service Wake-Up

Before sending a local OpenModel request, `ainote_api.py` checks the corresponding health endpoint. If the local service is unavailable, the script tries to start the installed AINOTE app in background OpenModel mode and waits briefly for the service to become ready.

This wake-up is intentionally best-effort:

- If AINOTE is already running, the app should handle the background wake-up without showing UI.
- If AINOTE is not installed or cannot be found, the script continues to fail normally with a connection error.
- If the user has not signed in to AINOTE before, the app should not show the login window for background wake-up. The user may need to open AINOTE manually and sign in.
- Do not manually open AINOTE or ask the user to open it unless the script reports that the local service remains unavailable.

## Health Endpoint Mapping

- notes -> check `/open-model-note/health`
- schedules/tasks -> check `/open-model-schedule/health`
- common APIs -> check `/open-model-common/health`
- book APIs -> check `/open-model-book/health`
