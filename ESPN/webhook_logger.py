#!/usr/bin/env python3
"""
Local webhook logger for testing nfl_monitor.py.

Usage:
    python webhook_logger.py [port]

Set NFL_NOTIFY_URL=http://localhost:8765 when running nfl_monitor.py.
Incoming POST payloads are printed to stdout and appended to webhook.log.
"""

import json
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
LOG_FILE = "webhook.log"


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)

        timestamp = datetime.now(timezone.utc).isoformat()
        try:
            body = json.loads(raw)
            formatted = json.dumps(body, indent=2)
        except Exception:
            formatted = raw.decode(errors="replace")

        entry = f"[{timestamp}] POST {self.path}\n{formatted}\n{'-' * 60}\n"
        print(entry, flush=True)
        with open(LOG_FILE, "a") as f:
            f.write(entry)

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *_):
        pass  # silence default access log noise


if __name__ == "__main__":
    server = HTTPServer(("", PORT), Handler)
    print(f"Listening on http://localhost:{PORT}  —  logging to {LOG_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
