import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { getServerStatus } from "./index.ts";
import { createServer } from "./server.ts";
import { InMemoryDataProvider } from "./data-provider.ts";

// ─── Harness ────────────────────────────────────────────────────────

describe("server workspace harness", () => {
  test("returns ready status", () => {
    expect(getServerStatus()).toBe("server-workspace-ready");
  });
});

// ─── Server Integration Tests ───────────────────────────────────────

describe("asset API server", () => {
  let server;
  let provider;
  let baseUrl;

  beforeAll(() => {
    provider = new InMemoryDataProvider();

    // Seed test data
    provider.putAsset("map", "100000000", { name: "Henesys", id: "100000000" });
    provider.putSection("map", "100000000", "info", { bgm: "Bgm00/Town", returnMap: 999999999 });
    provider.putSection("map", "100000000", "footholds", [{ id: "1", x1: 0, y1: 100, x2: 200, y2: 100 }]);
    provider.putAsset("mob", "100100", { name: "Green Snail", level: 3 });
    provider.putBlob("abc123def456", Buffer.from("blob-content"), "application/octet-stream");

    const { start } = createServer(provider, { port: 0, debug: false });
    server = start();
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server?.stop();
  });

  // ─── Health ─────────────────────────────────────────────────────

  test("GET /health returns healthy status", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.ready).toBe(true);
    expect(typeof body.indexEntries).toBe("number");
    expect(typeof body.blobCount).toBe("number");
  });

  test("GET /health returns unhealthy when not ready", async () => {
    provider.setReady(false);
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    provider.setReady(true);
  });

  test("GET /ready aliases /health", async () => {
    const res = await fetch(`${baseUrl}/ready`);
    expect(res.status).toBe(200);
  });

  // ─── Metrics ────────────────────────────────────────────────────

  test("GET /metrics returns request stats", async () => {
    const res = await fetch(`${baseUrl}/metrics`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.requestCount).toBe("number");
    expect(body.requestCount).toBeGreaterThan(0);
    expect(typeof body.uptimeMs).toBe("number");
  });

  // ─── Asset Entity ───────────────────────────────────────────────

  test("GET /api/v1/asset/:type/:id returns entity", async () => {
    const res = await fetch(`${baseUrl}/api/v1/asset/map/100000000`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe("Henesys");
    expect(body.correlationId).toBeDefined();
  });

  test("GET /api/v1/asset/:type/:id returns 404 for missing entity", async () => {
    const res = await fetch(`${baseUrl}/api/v1/asset/map/999999`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("GET /api/v1/asset/:type/:id returns 400 for invalid type", async () => {
    const res = await fetch(`${baseUrl}/api/v1/asset/weapon/123`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_TYPE");
  });

  // ─── Section ────────────────────────────────────────────────────

  test("GET /api/v1/asset/:type/:id/:section returns section data", async () => {
    const res = await fetch(`${baseUrl}/api/v1/asset/map/100000000/info`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.bgm).toBe("Bgm00/Town");
  });

  test("GET section returns 400 for invalid section name", async () => {
    const res = await fetch(`${baseUrl}/api/v1/asset/map/100000000/attacks`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_SECTION");
  });

  test("GET section returns 404 for missing section", async () => {
    const res = await fetch(`${baseUrl}/api/v1/asset/map/100000000/minimap`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  // ─── Blob ───────────────────────────────────────────────────────

  test("GET /api/v1/blob/:hash returns blob content", async () => {
    const res = await fetch(`${baseUrl}/api/v1/blob/abc123def456`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(res.headers.get("ETag")).toBe('"abc123def456"');
    const text = await res.text();
    expect(text).toBe("blob-content");
  });

  test("GET /api/v1/blob/:hash returns 404 for missing blob", async () => {
    const res = await fetch(`${baseUrl}/api/v1/blob/nonexistent`);
    expect(res.status).toBe(404);
  });

  // ─── Batch ──────────────────────────────────────────────────────

  test("POST /api/v1/batch returns ordered results", async () => {
    const res = await fetch(`${baseUrl}/api/v1/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { type: "map", id: "100000000" },
        { type: "mob", id: "100100" },
        { type: "map", id: "999999" },
      ]),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.results.length).toBe(3);
    expect(body.results[0].result.ok).toBe(true);
    expect(body.results[1].result.ok).toBe(true);
    expect(body.results[2].result.ok).toBe(false);
    expect(body.results[2].result.error.code).toBe("NOT_FOUND");
  });

  test("POST /api/v1/batch with section lookups", async () => {
    const res = await fetch(`${baseUrl}/api/v1/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { type: "map", id: "100000000", section: "info" },
        { type: "map", id: "100000000", section: "footholds" },
      ]),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result.ok).toBe(true);
    expect(body.results[0].result.data.bgm).toBe("Bgm00/Town");
    expect(body.results[1].result.ok).toBe(true);
  });

  test("POST /api/v1/batch rejects oversized batch", async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      type: "map",
      id: String(i),
    }));

    const { start: s2 } = createServer(provider, { port: 0, debug: false, maxBatchSize: 5 });
    const s2Server = s2();
    const url2 = `http://localhost:${s2Server.port}`;

    const res = await fetch(`${url2}/api/v1/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BATCH_TOO_LARGE");

    s2Server.stop();
  });

  // ─── CORS & Headers ─────────────────────────────────────────────

  test("responses include CORS and correlation headers", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("X-Correlation-Id")).toBeDefined();
  });

  test("asset responses include cache headers", async () => {
    const res = await fetch(`${baseUrl}/api/v1/asset/map/100000000`);
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
  });

  // ─── 404 ────────────────────────────────────────────────────────

  test("unknown routes return 404", async () => {
    const res = await fetch(`${baseUrl}/api/v1/unknown`);
    expect(res.status).toBe(404);
  });
});
