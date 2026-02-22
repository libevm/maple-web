import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const host = process.env.ADMIN_UI_HOST ?? "127.0.0.1";
const requestedPort = Number(process.env.ADMIN_UI_PORT ?? "5174");
const gameServerUrl = process.env.GAME_SERVER_URL ?? "http://127.0.0.1:5200";
const proxyTimeoutMs = Number(process.env.PROXY_TIMEOUT_MS ?? "10000");

const repoRoot = normalize(join(import.meta.dir, "..", ".."));
const webRoot = join(repoRoot, "client", "admin-ui");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function contentType(path) {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}

function serveFile(filePath) {
  if (!existsSync(filePath)) return new Response("Not Found", { status: 404 });
  const stat = statSync(filePath);
  if (!stat.isFile()) return new Response("Not Found", { status: 404 });
  const body = readFileSync(filePath);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-cache",
    },
  });
}

async function proxyAdmin(request, url) {
  const upstreamUrl = `${gameServerUrl}${url.pathname}${url.search}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), proxyTimeoutMs);

  try {
    const bodyAllowed = request.method !== "GET" && request.method !== "HEAD";
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: request.headers,
      body: bodyAllowed ? request.body : undefined,
      duplex: bodyAllowed ? "half" : undefined,
      signal: controller.signal,
    });

    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE", message: "Game server unavailable" } }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

let port = requestedPort;
let server;
while (true) {
  try {
    server = Bun.serve({
      hostname: host,
      port,
      async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname.startsWith("/api/admin/")) {
          return proxyAdmin(request, url);
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response("Method Not Allowed", { status: 405 });
        }

        if (url.pathname === "/" || url.pathname === "/index.html") {
          return serveFile(join(webRoot, "index.html"));
        }

        const relative = url.pathname.replace(/^\/+/, "");
        const filePath = normalize(join(webRoot, relative));
        if (!filePath.startsWith(webRoot)) {
          return new Response("Bad Request", { status: 400 });
        }

        return serveFile(filePath);
      },
    });
    break;
  } catch {
    port += 1;
  }
}

console.log(`🛠️  Admin UI running at http://${host}:${server.port}`);
console.log(`   Proxying /api/admin/* -> ${gameServerUrl}`);
