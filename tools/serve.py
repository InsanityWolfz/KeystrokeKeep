# Dev server for the browser build: like `python -m http.server`, but never lets the browser
# cache files, so edits show up on a normal reload. Usage: python tools/serve.py [port]
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def log_message(self, *a):
        pass

if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    port = int(os.environ.get('PORT') or (sys.argv[1] if len(sys.argv) > 1 else 5173))
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
