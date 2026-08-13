#!/usr/bin/env python3
"""
Encoding-safe HTTP client for Ainote API.

Solves PowerShell 5.1's silent re-encoding of request bodies from UTF-8 to ANSI.
Always call this script instead of Invoke-RestMethod / curl for Ainote API requests.

Compatible with Python 3.6+.
"""
import sys
import argparse
import json
import os
import platform
import subprocess
import time
import urllib.request
import urllib.error
import urllib.parse

DEFAULT_LOCAL_PORT = 46588
DEFAULT_TIMEOUT_SECONDS = 10
SERVICE_READY_TIMEOUT_SECONDS = 15
SERVICE_READY_INTERVAL_SECONDS = 0.5
HEALTH_CHECK_TIMEOUT_SECONDS = 1.5
BACKGROUND_OPEN_MODEL_ARG = "--background-open-model"
APP_LAUNCH_FILE_NAME = "app_launch.json"
AINOTE_EXE_NAMES = (
    "AINOTE-oversea-desktop.exe",
    "AINOTE.exe",
    "AiNote-desktop.exe",
)


def resolve_timeout(url):
    normalized_url = str(url or "").lower()
    if "/search" in normalized_url:
        return None
    return DEFAULT_TIMEOUT_SECONDS


def unique_paths(items):
    result = []
    seen = set()
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def resolve_open_model_config_candidates():
    home_dir = (os.environ.get("HOME") or os.path.expanduser("~") or "").strip()
    appdata = (os.environ.get("APPDATA") or "").strip()
    xdg_config_home = (os.environ.get("XDG_CONFIG_HOME") or "").strip()

    candidates = []
    if appdata:
        candidates.append(os.path.join(appdata, "AINOTE", "config", "open_model_config.json"))
        candidates.append(os.path.join(appdata, "ainote", "open_model_config.json"))
        candidates.append(os.path.join(appdata, "doxent", "open_model_config.json"))
    if home_dir:
        candidates.append(os.path.join(home_dir, "Library", "Application Support", "AINOTE", "config", "open_model_config.json"))
        candidates.append(os.path.join(home_dir, "Library", "Application Support", "ainote", "open_model_config.json"))
        candidates.append(os.path.join(home_dir, "Library", "Application Support", "doxent", "open_model_config.json"))
        candidates.append(os.path.join(xdg_config_home or os.path.join(home_dir, ".config"), "AINOTE", "config", "open_model_config.json"))
        candidates.append(os.path.join(xdg_config_home or os.path.join(home_dir, ".config"), "ainote", "open_model_config.json"))
        candidates.append(os.path.join(xdg_config_home or os.path.join(home_dir, ".config"), "doxent", "open_model_config.json"))
        candidates.append(os.path.join(home_dir, "AINOTE", "config", "open_model_config.json"))
        candidates.append(os.path.join(home_dir, "ainote", "open_model_config.json"))
        candidates.append(os.path.join(home_dir, "doxent", "open_model_config.json"))
    return unique_paths(candidates)


def resolve_open_model_port():
    for config_path in resolve_open_model_config_candidates():
        try:
            with open(config_path, "r", encoding="utf-8-sig") as handle:
                data = json.load(handle)
            port = int(data.get("port") or 0)
            if 0 < port <= 65535:
                return port
        except Exception:
            pass
    return DEFAULT_LOCAL_PORT


def resolve_request_url(url):
    parsed = urllib.parse.urlsplit(str(url or "").strip())
    hostname = (parsed.hostname or "").strip().lower()
    if parsed.scheme not in ("http", "https") or hostname not in ("127.0.0.1", "localhost"):
        return url

    port = resolve_open_model_port()
    if port <= 0:
        return url

    userinfo = ""
    if parsed.username:
        userinfo = parsed.username
        if parsed.password:
            userinfo += ":" + parsed.password
        userinfo += "@"

    host_for_netloc = parsed.hostname or hostname
    if ":" in host_for_netloc and not host_for_netloc.startswith("["):
        host_for_netloc = "[{}]".format(host_for_netloc)

    netloc = "{}{}:{}".format(userinfo, host_for_netloc, port)
    return urllib.parse.urlunsplit((
        parsed.scheme,
        netloc,
        parsed.path,
        parsed.query,
        parsed.fragment
    ))


def is_local_open_model_url(url):
    parsed = urllib.parse.urlsplit(str(url or "").strip())
    hostname = (parsed.hostname or "").strip().lower()
    return parsed.scheme in ("http", "https") and hostname in ("127.0.0.1", "localhost")


def resolve_health_url(url):
    parsed = urllib.parse.urlsplit(str(url or "").strip())
    path = parsed.path or ""
    if path.startswith("/open-model-schedule"):
        health_path = "/open-model-schedule/health"
    elif path.startswith("/open-model-book"):
        health_path = "/open-model-book/health"
    elif path.startswith("/open-model-common"):
        health_path = "/open-model-common/health"
    else:
        health_path = "/open-model-note/health"
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, health_path, "", ""))


def is_service_ready(health_url):
    try:
        req = urllib.request.Request(health_url, method="GET")
        with urllib.request.urlopen(req, timeout=HEALTH_CHECK_TIMEOUT_SECONDS) as resp:
            return 200 <= getattr(resp, "status", 200) < 600
    except urllib.error.HTTPError:
        # Any HTTP response means the local service accepted the connection.
        return True
    except Exception:
        return False


def wait_until_service_ready(health_url, timeout_seconds=SERVICE_READY_TIMEOUT_SECONDS):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if is_service_ready(health_url):
            return True
        time.sleep(SERVICE_READY_INTERVAL_SECONDS)
    return is_service_ready(health_url)


def normalize_exe_path(value):
    text = str(value or "").strip()
    if not text:
        return ""
    if text.startswith('"'):
        end = text.find('"', 1)
        if end > 1:
            text = text[1:end]
    else:
        text = text.split(",", 1)[0].strip()
        lower = text.lower()
        for suffix in (".exe", ".app"):
            index = lower.find(suffix)
            if index >= 0:
                text = text[:index + len(suffix)]
                break
    return text.strip().strip('"')


def resolve_launch_info_candidates():
    home_dir = (os.environ.get("HOME") or os.path.expanduser("~") or "").strip()
    appdata = (os.environ.get("APPDATA") or "").strip()
    xdg_config_home = (os.environ.get("XDG_CONFIG_HOME") or "").strip()

    candidates = []
    if appdata:
        candidates.append(os.path.join(appdata, "AINOTE", "config", APP_LAUNCH_FILE_NAME))
        candidates.append(os.path.join(appdata, "ainote", APP_LAUNCH_FILE_NAME))
    if home_dir:
        candidates.append(os.path.join(home_dir, "Library", "Application Support", "AINOTE", "config", APP_LAUNCH_FILE_NAME))
        candidates.append(os.path.join(home_dir, "Library", "Application Support", "ainote", APP_LAUNCH_FILE_NAME))
        candidates.append(os.path.join(xdg_config_home or os.path.join(home_dir, ".config"), "AINOTE", "config", APP_LAUNCH_FILE_NAME))
        candidates.append(os.path.join(xdg_config_home or os.path.join(home_dir, ".config"), "ainote", APP_LAUNCH_FILE_NAME))
        candidates.append(os.path.join(home_dir, "AINOTE", "config", APP_LAUNCH_FILE_NAME))
        candidates.append(os.path.join(home_dir, "ainote", APP_LAUNCH_FILE_NAME))
    return unique_paths(candidates)


def resolve_launch_entries_from_config():
    entries = []
    for config_path in resolve_launch_info_candidates():
        try:
            with open(config_path, "r", encoding="utf-8-sig") as handle:
                data = json.load(handle)
            exe_path = normalize_exe_path(data.get("exePath") or data.get("appPath") or data.get("path"))
            background_arg = str(data.get("backgroundArg") or BACKGROUND_OPEN_MODEL_ARG).strip() or BACKGROUND_OPEN_MODEL_ARG
            if exe_path:
                entries.append((exe_path, background_arg))
        except Exception:
            pass
    return entries


def resolve_windows_registry_launch_entries():
    if platform.system().lower() != "windows":
        return []
    try:
        import winreg
    except Exception:
        return []

    entries = []
    subkeys = (
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    )
    roots = (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE)

    for root in roots:
        for subkey in subkeys:
            try:
                key = winreg.OpenKey(root, subkey)
            except Exception:
                continue
            try:
                count = winreg.QueryInfoKey(key)[0]
                for index in range(count):
                    try:
                        child_name = winreg.EnumKey(key, index)
                        child = winreg.OpenKey(key, child_name)
                    except Exception:
                        continue
                    try:
                        display_name = str(winreg.QueryValueEx(child, "DisplayName")[0] or "")
                    except Exception:
                        display_name = ""
                    if "ainote" not in display_name.lower():
                        continue

                    for value_name in ("InstallLocation", "DisplayIcon"):
                        try:
                            value = normalize_exe_path(winreg.QueryValueEx(child, value_name)[0])
                        except Exception:
                            value = ""
                        if not value:
                            continue
                        if os.path.isdir(value):
                            for exe_name in AINOTE_EXE_NAMES:
                                entries.append((os.path.join(value, exe_name), BACKGROUND_OPEN_MODEL_ARG))
                        else:
                            entries.append((value, BACKGROUND_OPEN_MODEL_ARG))
            finally:
                try:
                    key.Close()
                except Exception:
                    pass
    return entries


def resolve_common_launch_entries():
    entries = []
    env_exe = normalize_exe_path(os.environ.get("AINOTE_APP_EXE"))
    if env_exe:
        entries.append((env_exe, os.environ.get("AINOTE_BACKGROUND_ARG") or BACKGROUND_OPEN_MODEL_ARG))

    if platform.system().lower() == "darwin":
        entries.append(("/Applications/AINOTE.app", BACKGROUND_OPEN_MODEL_ARG))
    elif platform.system().lower() == "windows":
        for base in (
            os.environ.get("LOCALAPPDATA"),
            os.environ.get("ProgramFiles"),
            os.environ.get("ProgramFiles(x86)"),
        ):
            if not base:
                continue
            for folder in ("AINOTE-oversea-desktop", "AINOTE-oversea", "AINOTE"):
                for exe_name in AINOTE_EXE_NAMES:
                    entries.append((os.path.join(base, folder, exe_name), BACKGROUND_OPEN_MODEL_ARG))
    return entries


def resolve_launch_entries():
    return unique_paths(resolve_launch_entries_from_config()
                        + resolve_windows_registry_launch_entries()
                        + resolve_common_launch_entries())


def start_ainote_background():
    for exe_path, background_arg in resolve_launch_entries():
        if not exe_path or not os.path.exists(exe_path):
            continue
        try:
            if platform.system().lower() == "darwin" and exe_path.endswith(".app"):
                subprocess.Popen(
                    ["open", "-gj", exe_path, "--args", background_arg],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    stdin=subprocess.DEVNULL,
                    close_fds=True,
                )
            else:
                creationflags = 0
                if platform.system().lower() == "windows":
                    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) \
                        | getattr(subprocess, "DETACHED_PROCESS", 0) \
                        | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
                subprocess.Popen(
                    [exe_path, background_arg],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    stdin=subprocess.DEVNULL,
                    close_fds=True,
                    creationflags=creationflags,
                )
            return True
        except Exception:
            pass
    return False


def ensure_ainote_service(request_url, auto_start=True):
    if not auto_start or not is_local_open_model_url(request_url):
        return
    health_url = resolve_health_url(request_url)
    if is_service_ready(health_url):
        return
    if start_ainote_background():
        wait_until_service_ready(health_url)


def main():
    p = argparse.ArgumentParser(description='Encoding-safe HTTP client for Ainote API')
    p.add_argument('--url', required=True, help='Full request URL')
    p.add_argument('--method', default='GET', help='HTTP method (default: GET)')
    p.add_argument('--body-encoded', dest='body_encoded',
                   help='URL percent-encoded JSON body (RECOMMENDED for Windows). '
                        'Use [System.Uri]::EscapeDataString($body) in PowerShell to encode.')
    p.add_argument('--body-file', dest='body_file',
                   help='Path to a UTF-8 file containing the JSON body')
    p.add_argument('--body', help='JSON body as a plain string (unsafe on Windows PS 5.1)')
    p.add_argument('--token', help='Authorization token (Bearer)')
    p.add_argument('--no-auto-start', action='store_true',
                   help='Do not try to start Ainote in background when the local service is unavailable')
    args = p.parse_args()

    headers = {'Content-Type': 'application/json; charset=utf-8'}
    if args.token:
        headers['Authorization'] = 'Bearer ' + args.token

    data = None
    if args.body_encoded:
        # Safest path: percent-encoded string → pure ASCII on the wire, no PS 5.1 interference
        from urllib.parse import unquote
        json_str = unquote(args.body_encoded, encoding='utf-8')
        data = json_str.encode('utf-8')
    elif args.body_file:
        # utf-8-sig strips BOM if present (Out-File / WriteAllText on PS 5.1 may add BOM)
        with open(args.body_file, 'r', encoding='utf-8-sig') as f:
            data = f.read().encode('utf-8')
    elif args.body:
        data = args.body.encode('utf-8')

    request_url = resolve_request_url(args.url)
    ensure_ainote_service(request_url, auto_start=not args.no_auto_start)
    req = urllib.request.Request(
        request_url,
        data=data,
        headers=headers,
        method=args.method.upper(),
    )

    try:
        timeout = resolve_timeout(request_url)
        if timeout is None:
            resp = urllib.request.urlopen(req)
        else:
            resp = urllib.request.urlopen(req, timeout=timeout)
        with resp:
            print(resp.read().decode('utf-8'))
            return 0
    except urllib.error.HTTPError as e:
        print('HTTP {}: {}'.format(e.code, e.read().decode('utf-8', errors='replace')), file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print('Connection error: {}'.format(e.reason), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
