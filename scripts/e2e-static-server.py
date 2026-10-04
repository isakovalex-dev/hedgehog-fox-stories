#!/usr/bin/env python3
"""Serve the built site concurrently for Playwright's parallel browser workers."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


class QuietStaticFileHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    dist_directory = Path(__file__).resolve().parents[1] / "dist"
    handler = partial(QuietStaticFileHandler, directory=str(dist_directory))
    server = ReusableThreadingHTTPServer(("127.0.0.1", 4318), handler)

    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
