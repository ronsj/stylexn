// Serves the static export (out/) for the Playwright run in CI: `next start`
// does not work with `output: "export"`. Directory URLs map to index.html;
// anything else is a file under out/ or the exported 404 page.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(import.meta.dirname, "../out");
const flag = process.argv.lastIndexOf("-p");
const port = Number(flag > -1 ? process.argv[flag + 1] : (process.env.PORT ?? 3001));

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolveFile(pathname) {
  const path = normalize(join(root, decodeURIComponent(pathname)));
  if (!path.startsWith(root)) return null;
  for (const candidate of [path, join(path, "index.html")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const file = resolveFile(pathname);
  const status = file ? 200 : 404;
  const body = file ?? join(root, "404.html");
  res.writeHead(status, { "content-type": types[extname(body)] ?? "application/octet-stream" });
  createReadStream(body).pipe(res);
}).listen(port, () => console.log(`docs-site: serving out/ on http://localhost:${port}`));
