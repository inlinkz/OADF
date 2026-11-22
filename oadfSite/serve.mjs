import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".yaml": "text/plain; charset=utf-8",
  ".yml": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

const headers = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

export function resolvePublic(dir, urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return { status: 400 };
  }
  if (pathname.includes("\0")) return { status: 400 };
  const rel = pathname.replace(/^[/\\]+/, "");
  const abs = path.resolve(dir, rel);
  const base = path.resolve(dir);
  if (abs !== base && !abs.startsWith(base + path.sep)) return { status: 400 };
  return { pathname, abs };
}

export function createServer(dir) {
  return http.createServer((req, res) => {
    const located = resolvePublic(dir, req.url || "/");
    if (located.status) {
      res.writeHead(located.status);
      res.end();
      return;
    }
    let stat = null;
    try {
      stat = fs.statSync(located.abs);
    } catch {
      stat = null;
    }
    if (stat?.isDirectory()) {
      if (!located.pathname.endsWith("/")) {
        const search = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        res.writeHead(308, { ...headers, Location: `${located.pathname}/${search}` });
        res.end();
        return;
      }
      const index = path.join(located.abs, "index.html");
      if (fs.existsSync(index)) {
        send(res, 200, index);
        return;
      }
    } else if (stat?.isFile()) {
      send(res, 200, located.abs);
      return;
    }
    const missing = path.join(dir, "404.html");
    if (fs.existsSync(missing)) {
      send(res, 404, missing);
      return;
    }
    res.writeHead(404, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });
}

function send(res, status, file) {
  const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(status, { ...headers, "Content-Type": type });
  fs.createReadStream(file).pipe(res);
}

function openBrowser(url) {
  const child = platform() === "win32"
    ? spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true })
    : spawn(platform() === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 4173;
  const server = createServer(publicDir);
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`Serving ${url}`);
    console.log("Stop with Ctrl+C.");
    openBrowser(url);
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exit(1);
  });
}
