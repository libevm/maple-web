/**
 * In-memory data provider — Implements the DataProvider interface
 * using in-memory stores for testing and development.
 *
 * Phase 4, Step 22-25.
 */

import type { DataProvider } from "./server.ts";

const VALID_TYPES = new Set([
  "map", "mob", "npc", "character", "equip",
  "effect", "audio", "ui", "skill", "reactor", "item",
]);

const VALID_SECTIONS: Record<string, Set<string>> = {
  map: new Set(["info", "footholds", "portals", "backgrounds", "tiles", "objects", "life", "ladderRopes", "audio", "reactors", "minimap"]),
  mob: new Set(["info", "stances", "audio"]),
  npc: new Set(["info", "stances", "audio"]),
  character: new Set(["info", "stances", "zmap"]),
  equip: new Set(["info", "stances"]),
  effect: new Set(["info", "frames"]),
  audio: new Set(["info", "data"]),
  ui: new Set(["info", "frames"]),
  skill: new Set(["info", "levels", "effect", "hit"]),
  reactor: new Set(["info", "states"]),
  item: new Set(["info", "icon"]),
};

export class InMemoryDataProvider implements DataProvider {
  private assets = new Map<string, unknown>();
  private sections = new Map<string, unknown>();
  private blobs = new Map<string, { data: Buffer; contentType: string }>();
  private ready = true;
  private version = "dev";

  setReady(ready: boolean): void {
    this.ready = ready;
  }

  setVersion(version: string): void {
    this.version = version;
  }

  putAsset(type: string, id: string, data: unknown): void {
    this.assets.set(`${type}:${id}`, data);
  }

  putSection(type: string, id: string, section: string, data: unknown): void {
    this.sections.set(`${type}:${id}:${section}`, data);
  }

  putBlob(hash: string, data: Buffer, contentType: string = "application/octet-stream"): void {
    this.blobs.set(hash, { data, contentType });
  }

  // ─── DataProvider Interface ─────────────────────────────────────

  isReady(): boolean {
    return this.ready;
  }

  getStats(): { indexEntries: number; blobCount: number; version: string } {
    return {
      indexEntries: this.assets.size + this.sections.size,
      blobCount: this.blobs.size,
      version: this.version,
    };
  }

  getAsset(type: string, id: string): unknown | null {
    return this.assets.get(`${type}:${id}`) ?? null;
  }

  getSection(type: string, id: string, section: string): unknown | null {
    return this.sections.get(`${type}:${id}:${section}`) ?? null;
  }

  getBlob(hash: string): { data: Buffer; contentType: string } | null {
    return this.blobs.get(hash) ?? null;
  }

  isValidType(type: string): boolean {
    return VALID_TYPES.has(type);
  }

  isValidSection(type: string, section: string): boolean {
    return VALID_SECTIONS[type]?.has(section) ?? false;
  }
}
