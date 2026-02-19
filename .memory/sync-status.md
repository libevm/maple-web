# .memory Sync Status

Last synced: 2026-02-20T11:00:00+11:00
Status: ✅ Synced

## Current authoritative memory files

| File | Purpose |
|------|---------|
| `canvas-rendering.md` | Full canvas rendering pipeline: asset loading, caching, draw order, coordinates, transitions, diagnostics |
| `physics.md` | Physics system: player/mob movement, footholds, gravity, swimming, climbing, AI |
| `physics-units.md` | Physics constant units and tick-rate conversion reference |
| `inventory-system.md` | Inventory tabs, slot layout, drag-drop, ground drops, loot, item icons |
| `equipment-system.md` | Equipment window, equip/unequip flow, dynamic character sprite rendering |
| `client-server.md` | **Complete client-server architecture**: session/auth model, character state schema, WebSocket protocol, V2 map set, resource pipeline, implementation order |
| `game-design.md` | High-level game design notes and feature goals |
| `tech-stack.md` | Technology choices, tooling, build system (note: partially stale — actual stack is vanilla JS + raw Bun.serve, not Fastify/Vite) |
| `implementation-plan.md` | **Step-by-step implementation plan** for online multiplayer: 5 phases, ~40 steps, with exact file paths, code snippets, and test instructions |
| `cpp-port-architecture-snapshot.md` | C++ reference client architecture snapshot (read-only reference) |

## Codebase Metrics Snapshot
- `client/web/app.js`: ~10,400 lines (single-file debug web client)
- Latest git: see `git log --oneline -1` on `origin/main`
- CI: `bun run ci` ✅

## Client Run Commands
- `bun run client:offline` — standalone client, no server (default port 5173)
- `bun run client:online` — client + API proxy to game server (default `http://127.0.0.1:5200`)
- `bun run client:web` — legacy alias for `client:offline`

## Key Architecture Decisions (this session)

### Session model
- Session ID = random UUID in localStorage (`mapleweb.session`), primary key for all server state
- Character name first-come-first-serve, immutable once claimed
- Auth optional (Phase 2): passphrase-based recovery, no email/OAuth

### WebSocket protocol
- 50ms position updates while moving
- Immediate action events: attack, chat, face, sit, prone, climb, equip change, drop, loot, level up, damage, die, respawn, jump, portal
- Map-scoped rooms: players only receive updates for their current map
- Global broadcasts: level up celebrations, achievements, announcements, player count
- JSON format for readability (v1)

### Persistence split
- Server-persisted (6 groups): identity, stats, location, equipment, inventory, achievements
- Client-only localStorage (2 groups): keybinds, settings

### V2 map set
- 21 maps: Henesys Townstreet + 3 Shumi JQs (9 maps) + 3 John JQs (6 maps) + Forest of Patience (2) + Breath of Lava (2)
- Dependencies: 5 BGMs, 7 mobs, 11 NPCs, 6 tile sets, 10 obj sets, 6 bg sets
- Default spawn: `100000001` (Henesys Townstreet)

### Default map change
- V2 default map: `100000001` (Henesys Townstreet), was `104040000`

## Recent Changes

### client-server.md complete rewrite (2026-02-20)
- Session/auth model with passphrase recovery plan
- SQLite schema for characters + name reservation
- Full WebSocket message protocol (24 client→server types, 19 server→client types)
- V2 map list with all dependencies enumerated
- 10-step implementation order
- Removed keybinds/settings from server persistence

### client:offline and client:online commands (2026-02-20, 02e6c26)
- `serve-client-offline.mjs` (standalone)
- `serve-client-online.mjs` (API proxy + `__MAPLE_ONLINE__` injection)
- `serve-client-web.mjs` → alias for offline

## Key Data Structures

```js
_winZCounter = 25                          // increments per bringWindowToFront()
playerInventory[i].slot                    // 0-31, position within tab grid
lifeRuntimeState[i].nameVisible            // false until attacked
RESOURCE_CACHE_NAME = "maple-resources-v1" // Cache API key
SETTINGS_CACHE_KEY = "mapleweb.settings.v1"
KEYBINDS_STORAGE_KEY = "mapleweb.keybinds.v1"
// Future: SESSION_KEY = "mapleweb.session"
// Tooltip z-index: 99990 | Cursor z-index: 99999
```
