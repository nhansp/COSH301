#!/usr/bin/env python3
"""Serve the deck and relay remote-control commands.

    /              the deck (index.html)
    /ctl           phone remote (ctl.html)
    /presenter     presenter view for the laptop (presenter.html)
    /api/events    server-sent events: "state" (deck position) and "cmd" (remote commands)
    /api/state     GET the last position; POST from the deck to publish it
    /api/cmd       POST from a remote: {"cmd": "next" | "prev" | "goto" | "sync" | "replay" | "toggle", "to": "n"}

Files are served with HTTP Range support, so the demo video can seek without downloading all of it.

Usage: python3 serve.py [--host 127.0.0.1] [--port 8765]
"""

import argparse
import json
import queue
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CMDS = {"next", "prev", "goto", "sync", "replay", "toggle"}

# What the deck publishes about the slide on screen. Only these keys are kept.
INT_KEYS = ("slide", "total")
STR_KEYS = ("id", "title", "section", "speaker", "notes", "nextTitle", "nextSpeaker")
state = {"slide": 1, "total": 0, "id": "", "title": "", "section": "", "speaker": "", "notes": "",
         "nextTitle": "", "nextSpeaker": "", "outline": [], "speakers": {}}
listeners = []
lock = threading.Lock()

def broadcast(event, data):
    msg = f"event: {event}\ndata: {json.dumps(data)}\n\n".encode()
    with lock:
        for q in list(listeners):
            q.put(msg)


RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if not self.path.startswith("/api/"):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def do_GET(self):
        route = self.path.split("?")[0]
        if route in ("/ctl", "/ctl/"):
            self.path = "/ctl.html"
        elif route in ("/presenter", "/presenter/"):
            self.path = "/presenter.html"
        if self.path == "/api/events":
            return self.events()
        if self.path == "/api/state":
            return self.reply(state)
        if route.endswith((".py", ".sh")) or "/." in self.path:
            return self.send_error(404)
        if self.headers.get("Range"):
            return self.send_ranged()
        return super().do_GET()

    def send_ranged(self):
        """Serve one byte range (what <video> asks for when seeking); anything odd falls back to the full file."""
        path = Path(self.translate_path(self.path.split("?")[0]))
        m = RANGE_RE.match(self.headers["Range"].strip())
        if not m or not path.is_file():
            return super().do_GET()
        size = path.stat().st_size
        a, b = m.groups()
        if a == "" and b == "":
            return super().do_GET()
        start, end = (size - int(b), size - 1) if a == "" else (int(a), int(b) if b else size - 1)
        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        try:
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(1 << 16, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 262144)) or b"{}")
        except (json.JSONDecodeError, ValueError):
            return self.send_error(400)
        if not isinstance(body, dict):
            return self.send_error(400)
        if self.path == "/api/state":
            with lock:
                for k in INT_KEYS:
                    if isinstance(body.get(k), int):
                        state[k] = body[k]
                for k in STR_KEYS:
                    if isinstance(body.get(k), str):
                        state[k] = body[k][:4000]
                if isinstance(body.get("outline"), list):
                    state["outline"] = body["outline"][:300]
                if isinstance(body.get("speakers"), dict):
                    state["speakers"] = body["speakers"]
            broadcast("state", state)
            return self.reply(state)
        if self.path == "/api/cmd" and body.get("cmd") in CMDS:
            broadcast("cmd", {"cmd": body["cmd"], "to": str(body.get("to", ""))[:32]})
            return self.reply({"ok": True})
        return self.send_error(404)

    def reply(self, data):
        raw = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def events(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        q = queue.Queue()
        with lock:
            listeners.append(q)
        try:
            self.wfile.write(f"event: state\ndata: {json.dumps(state)}\n\n".encode())
            self.wfile.flush()
            while True:
                try:
                    msg = q.get(timeout=15)
                except queue.Empty:
                    msg = b": ping\n\n"
                self.wfile.write(msg)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with lock:
                listeners.remove(q)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    srv = ThreadingHTTPServer((a.host, a.port), partial(Handler, directory=str(ROOT)))
    srv.daemon_threads = True
    print(f"serving {ROOT} on http://{a.host}:{a.port}  (remote: /ctl, presenter: /presenter)", flush=True)
    srv.serve_forever()
