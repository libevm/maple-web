#!/usr/bin/env bun
/**
 * Toggle GM flag for a character.
 * Usage: bun run make-gm <username> [--db <path>]
 */
import { initDatabase, isGm, setGm, characterExists } from "./db.ts";

const args = process.argv.slice(2);
let name = "";
let dbPath = "./data/maple.db";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--db" && args[i + 1]) {
    dbPath = args[++i];
  } else if (!name) {
    name = args[i];
  }
}

if (!name) {
  console.error("Usage: bun run make-gm <username> [--db <path>]");
  process.exit(1);
}

const db = initDatabase(dbPath);

if (!characterExists(db, name)) {
  console.error(`Character '${name}' not found.`);
  process.exit(1);
}

const wasGm = isGm(db, name);
setGm(db, name, !wasGm);
console.log(`${name}: GM ${wasGm ? "revoked" : "granted"}`);
