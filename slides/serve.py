#!/usr/bin/env python3
"""Serve the deck and relay remote-control commands.

    /              the deck (index.html)
    /ctl           phone remote (ctl.html)
    /presenter     presenter view for the laptop (presenter.html)
    /api/events    server-sent events: "state" (deck position) and "cmd" (remote commands)
    /api/state     GET the last position; POST from the deck to publish it
    /api/cmd       POST from a remote: {"cmd": "next" | "prev" | "goto" | "sync" | "replay" | "toggle", "to": "n"}
    /mirror.mjpg   the phone's screen, read from a v4l2loopback device (see mirror.sh); optional
    /api/rot       the phone's display rotation, 0-3 (polled over adb while a viewer asks)

Files are served with HTTP Range support, so the demo video can seek without downloading all of it.

Usage: python3 serve.py [--host 127.0.0.1] [--port 8765]
Environment: MIRROR_DEV (default /dev/video10), MIRROR_ADB (default 10.0.0.18:38421)
"""

import argparse
import json
import os
import queue
import re
import subprocess
import threading
import time
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

MIRROR_DEV = os.environ.get("MIRROR_DEV", "/dev/video10")
MIRROR_ADB = os.environ.get("MIRROR_ADB", "10.0.0.18:38421")


class Mirror:
    """One ffmpeg reading the v4l2 device, JPEG frames fanned out to every viewer."""

    def __init__(self):
        self.cond = threading.Condition()
        self.frame, self.seq, self.viewers, self.proc = None, 0, 0, None

    def run(self):
        while True:
            with self.cond:
                if self.viewers == 0:
                    self.proc = None
                    return
            try:
                self.proc = subprocess.Popen(
                    ["ffmpeg", "-loglevel", "error", "-fflags", "nobuffer", "-flags", "low_delay",
                     "-f", "v4l2", "-i", MIRROR_DEV,
                     "-fps_mode", "passthrough", "-q:v", "5", "-f", "image2pipe", "-c:v", "mjpeg", "-"],
                    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            except OSError:
                time.sleep(3)   # no ffmpeg here; the deck shows its "waiting for phone" state
                continue
            buf = b""
            proc, last = self.proc, [time.time()]

            def watchdog():
                # a reader that opened the device while scrcpy was restarting gets stuck; restart it
                while proc.poll() is None:
                    time.sleep(1)
                    if time.time() - last[0] > 5:
                        proc.kill()
                        return
            threading.Thread(target=watchdog, daemon=True).start()
            while True:
                chunk = self.proc.stdout.read1(65536)
                if not chunk:
                    break
                buf += chunk
                while True:
                    a = buf.find(b"\xff\xd8")
                    b = buf.find(b"\xff\xd9", a + 2)
                    if a < 0 or b < 0:
                        break
                    with self.cond:
                        self.frame, self.seq = buf[a:b + 2], self.seq + 1
                        last[0] = time.time()
                        self.cond.notify_all()
                    buf = buf[b + 2:]
                with self.cond:
                    if self.viewers == 0:
                        self.proc.kill()
                        break
            self.proc.wait()
            time.sleep(1)

    def watch(self):
        with self.cond:
            self.viewers += 1
            if self.proc is None:
                self.proc = True
                threading.Thread(target=self.run, daemon=True).start()

    def unwatch(self):
        with self.cond:
            self.viewers -= 1


mirror = Mirror()
rot = {"rot": 0, "asked": 0.0, "running": False}


def mirror_serial():
    """The adb path mirror.sh is using right now."""
    try:
        return (ROOT / ".mirror-serial").read_text().strip() or MIRROR_ADB
    except OSError:
        return MIRROR_ADB


def poll_rotation():
    while time.time() - rot["asked"] < 10:
        try:
            out = subprocess.run(["adb", "-s", mirror_serial(), "shell", "dumpsys input | grep -m1 -o 'orientation=[0-3]'"],
                                 capture_output=True, text=True, timeout=4).stdout
            if out.strip():
                rot["rot"] = int(out.strip()[-1])
        except (subprocess.SubprocessError, ValueError, OSError):
            pass
        time.sleep(0.6)
    rot["running"] = False


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
        if self.path == "/api/rot":
            rot["asked"] = time.time()
            if not rot["running"]:
                rot["running"] = True
                threading.Thread(target=poll_rotation, daemon=True).start()
            return self.reply({"rot": rot["rot"]})
        if route == "/mirror.mjpg":
            return self.stream()
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

    def stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.end_headers()
        mirror.watch()
        seen = -1
        try:
            while True:
                with mirror.cond:
                    mirror.cond.wait_for(lambda: mirror.seq != seen, timeout=15)
                    frame, seen = mirror.frame, mirror.seq
                if frame:
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " +
                                     str(len(frame)).encode() + b"\r\n\r\n" + frame + b"\r\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            mirror.unwatch()

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
