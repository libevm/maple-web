import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { AssetClient } from "./asset-client.ts";
import { createServer } from "../../../server/src/server.ts";
import { InMemoryDataProvider } from "../../../server/src/data-provider.ts";

describe("AssetClient", () => {
  let server;
  let provider;
  let baseUrl;

  beforeAll(() => {
    provider = new InMemoryDataProvider();
    provider.putAsset("map", "100000000", { name: "Henesys" });
    provider.putSection("map", "100000000", "info", { bgm: "Bgm00/Town" });
    provider.putSection("map", "100000000", "footholds", [{ id: "1" }]);
    provider.putBlob("blobhash123", Buffer.from("blob-data"), "application/octet-stream");

    const { start } = createServer(provider, { port: 0, debug: false });
    server = start();
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server?.stop();
  });

  test("fetches asset entity", async () => {
    const client = new AssetClient({ baseUrl });
    const result = await client.getAsset("map", "100000000");
    expect(result).not.toBeNull();
    expect(result.name).toBe("Henesys");
  });

  test("fetches asset section", async () => {
    const client = new AssetClient({ baseUrl });
    const result = await client.getSection("map", "100000000", "info");
    expect(result).not.toBeNull();
    expect(result.bgm).toBe("Bgm00/Town");
  });

  test("returns null for missing entity", async () => {
    const client = new AssetClient({ baseUrl });
    const result = await client.getAsset("map", "999999");
    expect(result).toBeNull();
  });

  test("caches results", async () => {
    const client = new AssetClient({ baseUrl });

    // First fetch
    await client.getAsset("map", "100000000");
    const diag1 = client.diagnostics();
    expect(diag1.cache.misses).toBe(1);

    // Second fetch (cached)
    await client.getAsset("map", "100000000");
    const diag2 = client.diagnostics();
    expect(diag2.cache.hits).toBe(1);
  });

  test("coalesces duplicate in-flight requests", async () => {
    const client = new AssetClient({ baseUrl });

    // Fire two identical requests simultaneously
    const [r1, r2] = await Promise.all([
      client.getSection("map", "100000000", "footholds"),
      client.getSection("map", "100000000", "footholds"),
    ]);

    expect(r1).toEqual(r2);
    const diag = client.diagnostics();
    // One request was coalesced
    expect(diag.coalescedRequests).toBeGreaterThanOrEqual(1);
  });

  test("batch fetches multiple items", async () => {
    const client = new AssetClient({ baseUrl });
    const results = await client.batch([
      { type: "map", id: "100000000" },
      { type: "map", id: "999999" },
    ]);

    expect(results.length).toBe(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });

  test("fetches blob data", async () => {
    const client = new AssetClient({ baseUrl });
    const data = await client.getBlob("blobhash123");
    expect(data).not.toBeNull();
    const text = new TextDecoder().decode(data);
    expect(text).toBe("blob-data");
  });

  test("returns null for missing blob", async () => {
    const client = new AssetClient({ baseUrl });
    const data = await client.getBlob("nonexistent");
    expect(data).toBeNull();
  });

  test("clearCache resets cache", async () => {
    const client = new AssetClient({ baseUrl });
    await client.getAsset("map", "100000000");
    expect(client.diagnostics().cache.size).toBe(1);

    client.clearCache();
    expect(client.diagnostics().cache.size).toBe(0);
  });

  test("LRU eviction when cache full", async () => {
    const client = new AssetClient({ baseUrl, maxCacheEntries: 2 });

    await client.getAsset("map", "100000000");
    await client.getSection("map", "100000000", "info");
    expect(client.diagnostics().cache.size).toBe(2);

    // This should evict the oldest entry
    await client.getSection("map", "100000000", "footholds");
    const diag = client.diagnostics();
    expect(diag.cache.size).toBe(2);
    expect(diag.cache.evictions).toBe(1);
  });

  test("diagnostics reports accurate state", async () => {
    const client = new AssetClient({ baseUrl });
    await client.getAsset("map", "100000000");
    await client.getAsset("map", "999999"); // miss + not found

    const diag = client.diagnostics();
    expect(diag.totalRequests).toBe(2);
    expect(diag.cache.size).toBe(1); // only successful fetch cached
    expect(diag.inFlightRequests).toBe(0);
  });
});
