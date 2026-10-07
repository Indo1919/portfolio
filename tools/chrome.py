"""Shared helpers for the tools: a quiet local web server and headless Chrome that always exits."""

import functools
import http.server
import os
import shutil
import sys
import socketserver
import subprocess
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def find_chrome():
    """Chrome on this Mac, or on GitHub's Linux runners (set $CHROME to override)."""
    for path in (os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                 shutil.which("google-chrome"), shutil.which("google-chrome-stable"),
                 shutil.which("chromium"), shutil.which("chromium-browser")):
        if path and Path(path).exists():
            return path
    return None


CHROME = find_chrome()


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(directory=ROOT):
    """Serve a folder on a free localhost port. Returns (server, port); call server.shutdown() when done."""
    handler = functools.partial(_Quiet, directory=str(directory))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def chrome(args, timeout=40, out=None):
    """Run headless Chrome. Pages with endless animations keep Chrome alive after it has
    finished, so screenshots are watched for and the process stopped, and --dump-dom output
    is read even when Chrome has to be killed."""
    if not CHROME:
        raise SystemExit("Google Chrome isn't installed (or set $CHROME to its path).")
    prof = tempfile.mkdtemp(prefix="portfolio-chrome-")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
           f"--user-data-dir={prof}", *args]
    if sys.platform.startswith("linux"):
        cmd[1:1] = ["--no-sandbox", "--disable-dev-shm-usage"]  # CI containers (small /dev/shm crashes Chrome)
    try:
        if out is None:
            try:
                return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
            except subprocess.TimeoutExpired as e:
                data = e.stdout or b""
                return data.decode("utf-8", "ignore") if isinstance(data, bytes) else data
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        start = time.time()
        while time.time() - start < timeout:
            if out.exists() and out.stat().st_size > 0:
                time.sleep(0.6)
                break
            time.sleep(0.4)
        proc.kill()
        return None
    finally:
        shutil.rmtree(prof, ignore_errors=True)
