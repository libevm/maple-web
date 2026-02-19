# Implementation Plan — MapleWeb Online

> Step-by-step instructions for AI developers.
> Read `.memory/client-server.md` for full architecture context.
> Read `AGENTS.md` for workflow rules.

---

## Phase 1 — Client-Side Save/Load (Offline)

Goal: Character progress persists across page reloads using localStorage.

### 1.1 Add session ID generation

**File:** `client/web/app.js`

1. At top of file (near other `const` declarations around line 191), add:
   ```js
   const SESSION_KEY = "mapleweb.session";
   const CHARACTER_SAVE_KEY = "mapleweb.character.v1";
   ```
2. Add a function `getOrCreateSessionId()`:
   - Read `localStorage.getItem(SESSION_KEY)`
   - If null, generate `crypto.randomUUID()`, store it, return it
   - If exists, return it
3. Call `getOrCreateSessionId()` during init (before `loadMap`) and store in a top-level `let sessionId`.

### 1.2 Add `buildCharacterSave()` function

**File:** `client/web/app.js`

1. Create function that reads all runtime state and returns a `CharacterSave` object:
   ```js
   function buildCharacterSave() {
     return {
       identity: {
         name: runtime.player.name,
         gender: false,
         skin: 0,
         face_id: 20000,
         hair_id: DEFAULT_HAIR_ID,
       },
       stats: {
         level: runtime.player.level,
         job: runtime.player.job,
         exp: runtime.player.exp,
         max_exp: runtime.player.maxExp,
         hp: runtime.player.hp,
         max_hp: runtime.player.maxHp,
         mp: runtime.player.mp,
         max_mp: runtime.player.maxMp,
         speed: runtime.player.stats.speed,
         jump: runtime.player.stats.jump,
         meso: 0,
       },
       location: {
         map_id: runtime.mapId || "100000001",
         spawn_portal: 0,
         facing: runtime.player.facing,
       },
       equipment: [...playerEquipped.entries()].map(([slot_type, eq]) => ({
         slot_type,
         item_id: eq.id,
         item_name: eq.name,
       })),
       inventory: playerInventory.map(it => ({
         item_id: it.id,
         qty: it.qty,
         inv_type: it.invType,
         slot: it.slot,
         category: it.category || null,
       })),
       achievements: {
         mobs_killed: 0,
         maps_visited: [],
         portals_used: 0,
         items_looted: 0,
         max_level_reached: runtime.player.level,
         total_damage_dealt: 0,
         deaths: 0,
         play_time_ms: 0,
       },
       version: 1,
       saved_at: new Date().toISOString(),
     };
   }
   ```
2. Match the `CharacterSave` interface from `client-server.md` exactly.

### 1.3 Add `applyCharacterSave(save)` function

**File:** `client/web/app.js`

1. Create function that takes a `CharacterSave` object and applies it to runtime state:
   - Set `runtime.player.name`, `.level`, `.job`, `.exp`, `.maxExp`, `.hp`, `.maxHp`, `.mp`, `.maxMp`, `.stats.speed`, `.stats.jump`
   - Set `runtime.player.facing` from `save.location.facing`
   - Clear `playerEquipped`, repopulate from `save.equipment` array:
     - For each entry: `playerEquipped.set(entry.slot_type, { id: entry.item_id, name: entry.item_name, iconKey: loadEquipIcon(entry.item_id, equipWzCategoryFromId(entry.item_id)) })`
     - Async load names: `loadItemName(entry.item_id).then(name => ...)`
   - Clear `playerInventory`, repopulate from `save.inventory` array:
     - For each entry: push `{ id: entry.item_id, qty: entry.qty, invType: entry.inv_type, slot: entry.slot, category: entry.category, name: "...", iconKey }` 
     - Use `loadItemIcon()` or `loadEquipIcon()` based on `inv_type`
     - Async load names
   - Call `refreshUIWindows()`
2. Return the `save.location.map_id` so the caller knows which map to load.

### 1.4 Add `saveCharacter()` function

**File:** `client/web/app.js`

1. Create function:
   ```js
   function saveCharacter() {
     const save = buildCharacterSave();
     localStorage.setItem(CHARACTER_SAVE_KEY, JSON.stringify(save));
     rlog("Character saved to localStorage");
   }
   ```
2. This is the offline-only version. Online version added in Phase 3.

### 1.5 Add `loadCharacter()` function

**File:** `client/web/app.js`

1. Create function:
   ```js
   function loadCharacter() {
     const raw = localStorage.getItem(CHARACTER_SAVE_KEY);
     if (!raw) return null;
     try {
       const save = JSON.parse(raw);
       if (!save || save.version !== 1) return null;
       return save;
     } catch { return null; }
   }
   ```

### 1.6 Wire save triggers

**File:** `client/web/app.js`

1. **Portal transition**: In `runPortalMapTransition()` (line ~5501), call `saveCharacter()` before `loadMap()`.
2. **Equip/unequip**: At end of `equipItemFromInventory()` (line ~1022) and `unequipItem()` (line ~987), call `saveCharacter()`.
3. **Level up**: In the level-up block (line ~3864, where `runtime.player.level += 1`), call `saveCharacter()` after stat changes.
4. **Periodic timer**: Add `setInterval(saveCharacter, 30000)` near init.
5. **Page unload**: Add `window.addEventListener("beforeunload", saveCharacter)` near init.

### 1.7 Wire load on startup

**File:** `client/web/app.js`

1. At the bottom of the file (around line 10400), before `loadMap(initialMapId)`:
   ```js
   const savedCharacter = loadCharacter();
   let initialMapId;
   if (savedCharacter) {
     const mapFromSave = applyCharacterSave(savedCharacter);
     initialMapId = params.get("mapId") ?? mapFromSave ?? "100000001";
     rlog("Loaded character from localStorage: " + savedCharacter.identity.name);
   } else {
     initialMapId = params.get("mapId") ?? "100000001";
   }
   ```
2. Keep `initPlayerEquipment()` and `initPlayerInventory()` as defaults — only called if no save exists. Wrap them:
   ```js
   if (!savedCharacter) {
     initPlayerEquipment();
     initPlayerInventory();
   }
   ```

### 1.8 Update default map

**File:** `client/web/app.js`

1. Change the fallback map from `"104040000"` to `"100000001"` (line ~10407).

### 1.9 Test

- Run `bun run client:offline`
- Play: move to another map, equip/unequip, gain EXP
- Reload page → verify character state restored (map, level, HP, equipment, inventory)
- Run `bun run ci` — must pass

### 1.10 Update `.memory`

- Update `sync-status.md` with new git hash and changes
- Update `canvas-rendering.md` if loading flow changed
- Update `inventory-system.md` and `equipment-system.md` if init flow changed

---

## Phase 2 — Server Character Persistence

Goal: Game server stores character data in SQLite. Online client saves/loads via REST API.

### 2.1 Add SQLite database module

**File:** `server/src/db.ts` (NEW)

1. Import `Database` from `bun:sqlite`.
2. Create and export `initDatabase(dbPath: string)`:
   - Open or create SQLite database at `dbPath` (default `./data/maple.db`)
   - Run `CREATE TABLE IF NOT EXISTS characters (session_id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER DEFAULT 1, updated_at TEXT DEFAULT (datetime('now')))`
   - Run `CREATE TABLE IF NOT EXISTS names (name TEXT PRIMARY KEY COLLATE NOCASE, session_id TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now')))`
   - Return the `Database` instance
3. Export helper functions:
   - `saveCharacterData(db, sessionId, data)` — `INSERT OR REPLACE INTO characters`
   - `loadCharacterData(db, sessionId)` — `SELECT data FROM characters WHERE session_id = ?`
   - `reserveName(db, sessionId, name)` — check if name taken by another session; if not, `INSERT OR REPLACE INTO names`; return `{ ok: true }` or `{ ok: false, reason: "name_taken" }`
   - `getNameBySession(db, sessionId)` — `SELECT name FROM names WHERE session_id = ?`

### 2.2 Add character REST endpoints

**File:** `server/src/character-api.ts` (NEW)

1. Export a function `handleCharacterRequest(request, url, db)` that routes:
   - `GET /api/character/load` → extract session ID from `Authorization: Bearer <id>` header → call `loadCharacterData(db, sessionId)` → return JSON or 404
   - `POST /api/character/save` → extract session ID → parse JSON body → call `saveCharacterData(db, sessionId, body)` → return 200
   - `POST /api/character/name` → extract session ID → parse `{ name }` from body → call `reserveName(db, sessionId, name)` → return result
2. Return `null` if the path doesn't match (so the router can fall through).

### 2.3 Wire character API into server

**File:** `server/src/server.ts`

1. Import `initDatabase` from `./db.ts` and `handleCharacterRequest` from `./character-api.ts`.
2. In `createServer()`, accept an optional `dbPath` in config.
3. In the `fetch()` handler, before the existing asset API routing:
   - If path starts with `/api/character/`, call `handleCharacterRequest(request, url, db)` and return the response.
4. Initialize the database in `start()` before calling `Bun.serve()`.

### 2.4 Add static file serving to server

**File:** `server/src/server.ts`

1. Add the static file serving logic from `tools/dev/serve-client-offline.mjs`:
   - Serve `client/web/` files for `/`, `/*.js`, `/*.css`, `/*.html`
   - Serve `/resources/*` from `resources/`
   - Serve `/resourcesv2/*` from `resourcesv2/`
   - Inject `window.__MAPLE_ONLINE__ = true` and `window.__MAPLE_SERVER_URL__` into `index.html` response
2. This means the game server can serve everything — no need for the separate proxy in `serve-client-online.mjs`. Update `serve-client-online.mjs` to just start the game server instead.

### 2.5 Update server dev script

**File:** `server/src/dev.ts`

1. Replace the placeholder with actual server startup:
   ```ts
   import { createServer } from "./server.ts";
   import { InMemoryDataProvider } from "./data-provider.ts";
   
   const provider = new InMemoryDataProvider();
   const { start } = createServer(provider, { port: 5200, debug: true, dbPath: "./data/maple.db" });
   const server = start();
   console.log(`🍄 MapleWeb game server running at http://localhost:${server.port}`);
   ```

### 2.6 Wire online client save/load

**File:** `client/web/app.js`

1. Modify `saveCharacter()`:
   ```js
   async function saveCharacter() {
     const save = buildCharacterSave();
     if (window.__MAPLE_ONLINE__) {
       try {
         await fetch("/api/character/save", {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "Authorization": "Bearer " + sessionId,
           },
           body: JSON.stringify(save),
         });
       } catch (e) { rlog("Save to server failed: " + e.message); }
     } else {
       localStorage.setItem(CHARACTER_SAVE_KEY, JSON.stringify(save));
     }
   }
   ```
2. Modify `loadCharacter()`:
   ```js
   async function loadCharacter() {
     if (window.__MAPLE_ONLINE__) {
       try {
         const resp = await fetch("/api/character/load", {
           headers: { "Authorization": "Bearer " + sessionId },
         });
         if (resp.ok) return await resp.json();
       } catch (e) { rlog("Load from server failed: " + e.message); }
       return null;
     }
     // offline fallback
     const raw = localStorage.getItem(CHARACTER_SAVE_KEY);
     if (!raw) return null;
     try { return JSON.parse(raw); } catch { return null; }
   }
   ```
3. Update call site to `await loadCharacter()` (startup is already async-capable since `loadMap` is async).

### 2.7 Add server tests

**File:** `server/src/index.test.mjs`

1. Add test block for character API:
   - `POST /api/character/save` → 200
   - `GET /api/character/load` → returns saved data
   - `GET /api/character/load` with unknown session → 404
   - `POST /api/character/name` → reserves name
   - `POST /api/character/name` with taken name → error
2. Use an in-memory SQLite database (`:memory:`) for tests.

### 2.8 Test end-to-end

- Run `bun run --cwd server dev` (starts game server on 5200)
- Run `bun run client:online` (starts client on 5173, proxies to 5200)
- Play, reload → character state persists via server
- Run `bun run ci` — must pass

### 2.9 Update `.memory`

- Update `client-server.md` implementation status
- Update `sync-status.md`

---

## Phase 3 — WebSocket Server

Goal: Server manages map rooms, relays real-time player state.

### 3.1 Add WebSocket types to shared-schemas

**File:** `packages/shared-schemas/src/multiplayer.ts` (NEW)

1. Define all client→server message types as TypeScript interfaces:
   ```ts
   export interface MoveMessage { type: "move"; x: number; y: number; action: string; facing: number; frame: number; }
   export interface ChatMessage { type: "chat"; text: string; }
   export interface FaceMessage { type: "face"; expression: string; }
   export interface AttackMessage { type: "attack"; stance: string; frame: number; }
   export interface SitMessage { type: "sit"; active: boolean; }
   export interface ProneMessage { type: "prone"; active: boolean; }
   export interface ClimbMessage { type: "climb"; active: boolean; action: string; }
   export interface EquipChangeMessage { type: "equip_change"; equipment: Array<{ slot_type: string; item_id: number; }>; }
   export interface DropItemMessage { type: "drop_item"; item_id: number; x: number; y: number; }
   export interface LootItemMessage { type: "loot_item"; drop_index: number; }
   export interface EnterMapMessage { type: "enter_map"; map_id: string; }
   export interface LeaveMapMessage { type: "leave_map"; }
   export interface LevelUpMessage { type: "level_up"; level: number; }
   export interface DamageTakenMessage { type: "damage_taken"; damage: number; direction: number; }
   export interface DieMessage { type: "die"; }
   export interface RespawnMessage { type: "respawn"; }
   export interface JumpMessage { type: "jump"; }
   export interface PortalEnterMessage { type: "portal_enter"; portal_name: string; }
   export type ClientMessage = MoveMessage | ChatMessage | FaceMessage | AttackMessage | SitMessage | ProneMessage | ClimbMessage | EquipChangeMessage | DropItemMessage | LootItemMessage | EnterMapMessage | LeaveMapMessage | LevelUpMessage | DamageTakenMessage | DieMessage | RespawnMessage | JumpMessage | PortalEnterMessage;
   ```
2. Define all server→client message types similarly (PlayerMoveMessage, PlayerChatMessage, MapStateMessage, GlobalLevelUpMessage, etc).
3. Export from `packages/shared-schemas/src/index.ts`.

### 3.2 Add WebSocket room manager

**File:** `server/src/ws.ts` (NEW)

1. Define `WSClient` interface:
   ```ts
   interface WSClient {
     id: string;        // session ID
     name: string;
     mapId: string;
     ws: ServerWebSocket<WSClientData>;
     look: { face_id: number; hair_id: number; skin: number; equipment: Array<{ slot_type: string; item_id: number; }>; };
   }
   ```
2. Create `RoomManager` class:
   - `rooms: Map<string, Set<WSClient>>` — map ID → clients
   - `allClients: Map<string, WSClient>` — session ID → client
   - `addClient(client)` — add to `allClients` and to the room for `client.mapId`
   - `removeClient(sessionId)` — remove from room and `allClients`, broadcast `player_leave`
   - `changeRoom(sessionId, newMapId)` — remove from old room, add to new room, broadcast `player_leave`/`player_enter`, send `map_state` to joiner
   - `broadcastToRoom(mapId, message, excludeId?)` — send JSON message to all clients in room except `excludeId`
   - `broadcastGlobal(message)` — send to all clients in `allClients`
   - `getMapState(mapId)` — return array of player snapshots for `map_state` message

### 3.3 Add WebSocket message handler

**File:** `server/src/ws.ts`

1. Create `handleClientMessage(client, rawMessage, roomManager)`:
   - Parse JSON
   - Switch on `message.type`:
     - `"move"` → `broadcastToRoom(client.mapId, { type: "player_move", id: client.id, ...message }, client.id)`
     - `"chat"` → `broadcastToRoom(client.mapId, { type: "player_chat", id: client.id, name: client.name, text: message.text }, client.id)`
     - `"face"` → broadcast `player_face`
     - `"attack"` → broadcast `player_attack`
     - `"sit"` → broadcast `player_sit`
     - `"prone"` → broadcast `player_prone`
     - `"climb"` → broadcast `player_climb`
     - `"equip_change"` → update `client.look.equipment`, broadcast `player_equip`
     - `"jump"` → broadcast `player_jump`
     - `"damage_taken"` → broadcast `player_damage`
     - `"die"` → broadcast `player_die`
     - `"respawn"` → broadcast `player_respawn`
     - `"enter_map"` → `changeRoom(client.id, message.map_id)`
     - `"leave_map"` → remove from current room
     - `"level_up"` → broadcast `player_level_up` to room + `global_level_up` to all if level >= 10
     - `"drop_item"` → broadcast `drop_spawn` to room
     - `"loot_item"` → broadcast `drop_loot` to room
     - `"portal_enter"` → no broadcast needed (enter_map handles it)

### 3.4 Wire WebSocket into Bun.serve

**File:** `server/src/server.ts`

1. Import `RoomManager` and `handleClientMessage` from `./ws.ts`.
2. Create a single `RoomManager` instance in `createServer()`.
3. In `Bun.serve()`, add `websocket` handler:
   ```ts
   websocket: {
     open(ws) {
       // Client sends session ID as first message — handled in message()
     },
     message(ws, rawMsg) {
       const data = ws.data as WSClientData;
       if (!data.authenticated) {
         // First message = session ID string (authentication)
         const sessionId = String(rawMsg);
         // Look up character from DB to get name + look
         const charData = loadCharacterData(db, sessionId);
         // Create WSClient, add to RoomManager
         data.authenticated = true;
         data.client = roomManager.addClient({...});
         // Send map_state to this client
         return;
       }
       handleClientMessage(data.client, String(rawMsg), roomManager);
     },
     close(ws) {
       const data = ws.data as WSClientData;
       if (data.client) roomManager.removeClient(data.client.id);
     },
   }
   ```
4. In `fetch()`, add WebSocket upgrade for `/ws`:
   ```ts
   if (url.pathname === "/ws") {
     const upgraded = server.upgrade(request, { data: { authenticated: false, client: null } });
     if (upgraded) return;
     return new Response("WebSocket upgrade failed", { status: 400 });
   }
   ```

### 3.5 Add periodic global player count broadcast

**File:** `server/src/ws.ts`

1. In `RoomManager`, add method `getPlayerCount()` → returns `allClients.size`.
2. After creating `RoomManager`, start `setInterval(() => roomManager.broadcastGlobal({ type: "global_player_count", count: roomManager.getPlayerCount() }), 10000)`.

### 3.6 Test WebSocket

- Write integration test in `server/src/index.test.mjs`:
  - Connect two WebSocket clients
  - Authenticate both with different session IDs
  - Both `enter_map` to same map
  - Client A sends `move` → verify Client B receives `player_move`
  - Client A sends `chat` → verify Client B receives `player_chat`
  - Client A disconnects → verify Client B receives `player_leave`
- Run `bun run ci` — must pass

### 3.7 Update `.memory`

---

## Phase 4 — Client WebSocket Integration

Goal: Client connects to server, sends local state, renders remote players.

### 4.1 Add WebSocket connection manager

**File:** `client/web/app.js`

1. Add near top:
   ```js
   let _ws = null;
   let _wsConnected = false;
   const remotePlayers = new Map(); // sessionId → { name, x, y, action, facing, frame, look, chatBubble, faceExpr, ... }
   ```
2. Add `connectWebSocket()`:
   - Only if `window.__MAPLE_ONLINE__`
   - `const wsUrl = window.__MAPLE_SERVER_URL__.replace("http", "ws") + "/ws"`
   - `_ws = new WebSocket(wsUrl)`
   - `onopen`: send `sessionId` as first message, set `_wsConnected = true`
   - `onmessage`: parse JSON, call `handleServerMessage(parsed)`
   - `onclose`: set `_wsConnected = false`, attempt reconnect after 3s
   - `onerror`: log
3. Call `connectWebSocket()` after `loadMap()` completes on init.

### 4.2 Add position send throttle

**File:** `client/web/app.js`

1. Add `let _lastPosSendTime = 0`:
2. In the game loop `update()` function (or at end of physics step), after player position is updated:
   ```js
   if (_wsConnected && performance.now() - _lastPosSendTime >= 50) {
     wsSend({ type: "move", x: Math.round(player.x), y: Math.round(player.y), action: player.action, facing: player.facing, frame: player.frameIndex });
     _lastPosSendTime = performance.now();
   }
   ```
3. Add helper `function wsSend(msg) { if (_ws && _ws.readyState === 1) _ws.send(JSON.stringify(msg)); }`.

### 4.3 Add action event sends

**File:** `client/web/app.js`

Wire `wsSend()` calls at each action point:

1. **Chat**: In `sendChatMessage()` (line ~1858), after setting `bubbleText`:
   `wsSend({ type: "chat", text: trimmed })`
2. **Face expression**: In the face expression hotkey handler (FACE_EXPRESSIONS block, line ~9905+):
   `wsSend({ type: "face", expression: expressionName })`
3. **Attack**: In the attack handler where `player.attacking = true`:
   `wsSend({ type: "attack", stance: player.attackStance, frame: 0 })`
4. **Sit**: When `player.action` changes to/from `"sit"`:
   `wsSend({ type: "sit", active: player.action === "sit" })`
5. **Prone**: When `player.action` changes to/from `"prone"`:
   `wsSend({ type: "prone", active: player.action === "prone" || player.action === "proneStab" })`
6. **Climb**: When `player.climbing` changes:
   `wsSend({ type: "climb", active: player.climbing, action: player.action })`
7. **Equip change**: At end of `equipItemFromInventory()` and `unequipItem()`:
   `wsSend({ type: "equip_change", equipment: [...playerEquipped.entries()].map(([st, eq]) => ({ slot_type: st, item_id: eq.id })) })`
8. **Drop item**: In `dropItemOnMap()`:
   `wsSend({ type: "drop_item", item_id: drop.id, x: drop.x, y: drop.destY })`
9. **Loot**: In `tryLootDrop()` on success:
   `wsSend({ type: "loot_item", drop_index: i })`
10. **Level up**: In the level-up block:
    `wsSend({ type: "level_up", level: runtime.player.level })`
11. **Damage taken**: In `applyPlayerDamage()` or trap hit:
    `wsSend({ type: "damage_taken", damage: amount, direction: dir })`
12. **Jump**: When jump starts (in physics, when `vy` goes negative from ground):
    `wsSend({ type: "jump" })`
13. **Map transition**: In `runPortalMapTransition()`, before `loadMap()`:
    `wsSend({ type: "leave_map" })` and after map loads: `wsSend({ type: "enter_map", map_id: runtime.mapId })`

### 4.4 Handle incoming server messages

**File:** `client/web/app.js`

1. Add `function handleServerMessage(msg)`:
   ```js
   switch (msg.type) {
     case "player_enter":
       remotePlayers.set(msg.id, {
         name: msg.name, x: 0, y: 0, targetX: 0, targetY: 0,
         action: "stand1", facing: -1, frame: 0,
         look: msg.look, chatBubble: null, chatBubbleExpires: 0,
         faceExpr: "default",
       });
       // Trigger equip WZ data load for their equipment
       break;
     case "player_leave":
       remotePlayers.delete(msg.id);
       break;
     case "player_move":
       const rp = remotePlayers.get(msg.id);
       if (rp) {
         rp.targetX = msg.x; rp.targetY = msg.y;
         rp.action = msg.action; rp.facing = msg.facing; rp.frame = msg.frame;
       }
       break;
     case "player_chat":
       const rpc = remotePlayers.get(msg.id);
       if (rpc) { rpc.chatBubble = msg.text; rpc.chatBubbleExpires = performance.now() + 8000; }
       break;
     case "player_face":
       const rpf = remotePlayers.get(msg.id);
       if (rpf) rpf.faceExpr = msg.expression;
       break;
     case "player_attack":
     case "player_sit":
     case "player_prone":
     case "player_climb":
     case "player_jump":
       const rpa = remotePlayers.get(msg.id);
       if (rpa) { rpa.action = msg.action || rpa.action; }
       break;
     case "player_equip":
       const rpe = remotePlayers.get(msg.id);
       if (rpe) { rpe.look.equipment = msg.equipment; /* reload WZ */ }
       break;
     case "player_level_up":
       const rpl = remotePlayers.get(msg.id);
       if (rpl) { /* show level-up effect */ }
       break;
     case "player_damage":
     case "player_die":
     case "player_respawn":
       // Update remote player visual state
       break;
     case "map_state":
       remotePlayers.clear();
       for (const p of msg.players) {
         remotePlayers.set(p.id, { name: p.name, x: p.x, y: p.y, targetX: p.x, targetY: p.y, action: p.action, facing: p.facing, frame: p.frame, look: p.look, chatBubble: null, chatBubbleExpires: 0, faceExpr: "default" });
       }
       break;
     case "global_level_up":
       // Show congratulations in chat log
       break;
     case "global_announcement":
       // Show server message in chat log
       break;
     case "global_player_count":
       // Update player count display (optional)
       break;
   }
   ```

### 4.5 Add remote player interpolation

**File:** `client/web/app.js`

1. In the game loop `update()`, after local player physics:
   ```js
   for (const [id, rp] of remotePlayers) {
     const lerpSpeed = 0.25; // 25% per frame toward target
     rp.x += (rp.targetX - rp.x) * lerpSpeed;
     rp.y += (rp.targetY - rp.y) * lerpSpeed;
   }
   ```

### 4.6 Add remote player rendering

**File:** `client/web/app.js`

1. In `drawMapLayersWithCharacter()`, after drawing the local player at the matching layer:
   - Iterate `remotePlayers`, for each remote player in the current layer:
     - Reuse `composeCharacterPlacements()` with their action/frame/facing
     - Draw at their interpolated (x, y) position
     - This requires loading their equip WZ data on `player_enter` — use `loadEquipWzData()` for each equipped item
2. Add `drawRemotePlayerNameLabel(rp)` — draw name tag below remote character.
3. Add `drawRemotePlayerChatBubble(rp)` — draw chat bubble above remote character (reuse existing chat bubble draw logic).

### 4.7 Clear remote players on map change

**File:** `client/web/app.js`

1. In `loadMap()`, at the start: `remotePlayers.clear()`.

### 4.8 Test multiplayer

- Open two browser tabs pointing to the same online server
- Both should see each other's character moving in real time
- Chat messages should appear as bubbles above remote players
- One player leaves map → other sees them disappear
- Run `bun run ci` — must pass

### 4.9 Update `.memory`

---

## Phase 5 — V2 Resource Extraction

Goal: Extract and simplify resources for the 21 V2 maps into `resourcesv2/`.

### 5.1 Create extraction script

**File:** `tools/build-assets/extract-v2-maps.mjs` (NEW)

1. Define the V2 map list:
   ```js
   const V2_MAPS = ["100000001","103000900","103000901","103000902","103000903","103000904","103000905","103000906","103000907","103000908","105040310","105040311","105040312","105040313","105040314","105040315","101000100","101000101","280020000","280020001"];
   ```
2. For each map:
   - Read `resources/Map.wz/Map/Map{first_digit}/{id}.img.json`
   - Copy to `resourcesv2/Map.wz/Map/Map{first_digit}/{id}.img.json`
3. Scan each map JSON to collect dependencies (same logic as the scan we ran):
   - BGM paths → sound files
   - Mob IDs → `Mob.wz/{padded}.img.json`
   - NPC IDs → `Npc.wz/{padded}.img.json`
   - Tile set names → `Map.wz/Tile/{tS}.img.json`
   - Object set names → `Map.wz/Obj/{oS}.img.json`
   - Background set names → `Map.wz/Back/{bS}.img.json`
4. Copy each dependency file to corresponding path under `resourcesv2/`.
5. For sound: copy the BGM sound files from `Sound.wz/{file}.img.json` (only include the needed BGM entries, not the entire file).

### 5.2 Copy String.wz dependencies

1. Copy `resources/String.wz/Map.img.json` → `resourcesv2/String.wz/Map.img.json` (needed for map names)
2. Copy `resources/String.wz/Mob.img.json` → `resourcesv2/String.wz/Mob.img.json`
3. Copy `resources/String.wz/Npc.img.json` → `resourcesv2/String.wz/Npc.img.json`
4. Copy `resources/String.wz/Eqp.img.json` → `resourcesv2/String.wz/Eqp.img.json`
5. Copy `resources/String.wz/Consume.img.json` → `resourcesv2/String.wz/Consume.img.json`
6. Copy `resources/String.wz/Etc.img.json` → `resourcesv2/String.wz/Etc.img.json`

### 5.3 Copy shared assets

1. Copy `resources/UI.wz/Basic.img.json` (cursor, UI elements)
2. Copy `resources/Sound.wz/UI.img.json` (UI sounds)
3. Copy `resources/Sound.wz/Game.img.json` (game sounds)
4. Copy `resources/Effect.wz/BasicEff.img.json` (level-up effect)
5. Copy `resources/Base.wz/zmap.img.json` (z-order)
6. Copy `resources/Map.wz/MapHelper.img.json` (portal sprites)
7. Copy character WZ files that are currently hardcoded:
   - `Character.wz/00002000.img.json` (body)
   - `Character.wz/00012000.img.json` (head)
   - `Character.wz/Face/00020000.img.json` (face)
   - `Character.wz/Hair/00030000.img.json` (hair)
   - Default equips: `Character.wz/Coat/01040002.img.json`, `Pants/01060002.img.json`, `Shoes/01072001.img.json`, `Weapon/01302000.img.json`

### 5.4 Run extraction

```bash
bun run tools/build-assets/extract-v2-maps.mjs
```

Verify output:
```bash
find resourcesv2 -name "*.json" | wc -l   # should be ~60-80 files
du -sh resourcesv2/                         # should be much smaller than resources/
```

### 5.5 Add V2 resource path routing to client

**File:** `client/web/app.js`

1. Add a constant `const V2_MAPS = new Set(["100000001","103000900",...])`.
2. Add a flag `let useV2Resources = false` — set to `true` when `window.__MAPLE_ONLINE__` is active or when a query param `?v2=1` is present.
3. Modify `fetchJson(path)`: if `useV2Resources` and path starts with `/resources/`, try `/resourcesv2/` first, fall back to `/resources/`.
   - Or simpler: replace the prefix: `const resolvedPath = useV2Resources ? path.replace("/resources/", "/resourcesv2/") : path;`
4. This means the V2 client loads from `resourcesv2/` which contains only the needed files. Missing files (not in V2 set) will 404 — this is expected; those maps aren't in the V2 set.

### 5.6 Test V2 resources

- Run `bun run client:offline` with `?v2=1&mapId=103000900`
- Verify Shumi's JQ loads correctly from `resourcesv2/`
- Verify all 21 V2 maps load without 404 errors for required assets
- Run `bun run ci` — must pass

### 5.7 Update `.memory`

- Update `client-server.md` V2 section with actual file counts and sizes
- Update `canvas-rendering.md` if resource path logic changed
- Update `sync-status.md`

---

## Phase Summary

| Phase | Deliverable | Depends On |
|-------|-------------|------------|
| 1 | Offline persistence (localStorage) — progress survives reload | Nothing |
| 2 | Server persistence (SQLite + REST) — online save/load | Phase 1 |
| 3 | WebSocket server — map rooms, message relay | Phase 2 |
| 4 | Client multiplayer — send actions, render remote players | Phase 3 |
| 5 | V2 resource extraction — slim asset set for 21 maps | Nothing (can run in parallel) |

---

## Verification Checklist

After each phase, verify:
- [ ] `bun run ci` passes
- [ ] `bun run client:offline` works (no regressions)
- [ ] `.memory/` updated with changes
- [ ] No hardcoded secrets or tokens in committed code
- [ ] New files have appropriate error handling
- [ ] Server endpoints return proper HTTP status codes and JSON error bodies
