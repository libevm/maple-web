# .memory Sync Status

Last synced: 2026-02-20T09:30:00+11:00
Status: ✅ Synced

## Current authoritative memory files
- `.memory/game-design.md`
- `.memory/cpp-port-architecture-snapshot.md`
- `.memory/half-web-port-architecture-snapshot.md`
- `.memory/cpp-vs-half-web-port-gap-snapshot.md`
- `.memory/tech-stack.md`
- `.memory/implementation-plan.md`
- `.memory/canvas-rendering.md`
- `.memory/rendering-optimization-plan-2026-02-19.md`
- `.memory/physics.md`
- `.memory/physics-units.md`
- `.memory/inventory-system.md`
- `.memory/equipment-system.md`

## Codebase Metrics Snapshot
- `client/web/app.js`: ~10400 lines (single-file debug web client)
- Latest git: `6628fa3` on `origin/main`
- CI: `bun run ci` ✅

## What was synced in this pass

### Persistent browser Cache API (2026-02-20, 6628fa3)
- `cachedFetch(url)` wraps all resource fetches with Cache API (`caches.open("maple-resources-v1")`)
- Checks cache first, stores response on miss
- `fetchJson()` now uses `cachedFetch()` for all `/resources/` JSON
- `preloadLoadingScreenAssets()` uses `cachedFetch` for manifest, BGM, PNGs
- Subsequent page loads serve from browser cache with zero network requests

### Mob name only after attack (2026-02-20, 51c476b)
- Added `nameVisible` flag to mob state (default `false`)
- Set `nameVisible = true` on any attack (hit or miss) in damage apply
- Name label draw checks `state.nameVisible` — hidden until first hit
- Resets on mob death/respawn (state re-initialized)

### Player position init after map load (2026-02-20, f8ea031)
- Moved spawn portal lookup, player x/y/velocity init, foothold placement, camera positioning,
  animation state reset to AFTER `preloadMapAssets()` completes
- Player cannot interact with the map until loading finishes

### Verbose loading label + percentage (2026-02-20, 14710b4)
- Loading screen shows both status text and percentage: `"Loading assets 12/48 — 25%"`

### Compress login BGM + skip if map BGM playing (2026-02-20, 2e003d2)
- Re-encoded `resourcesv2/sound/login.mp3`: mono, 22050Hz, 48kbps (3.6MB → 2.2MB)
- `startLoginBgm()` checks `runtime.bgmAudio && !runtime.bgmAudio.paused` before playing
- Prevents login BGM from overlapping map BGM on subsequent map loads

### HUD button tooltips + hidden during loading (2026-02-20, f6aed48)
- HUD buttons hidden with `.hud-hidden` class until first map load completes
- `showHudButtons()` called on `loading.active = false`
- Hover shows custom tooltip popup below button (dark frosted glass style)
- Tooltips: "Key Bindings (K)", "Settings", "Debug Panel"
- Replaced `title` attrs with `data-tooltip` for custom popup

### Modern flat loading screen (2026-02-20, 39ec405)
- Removed text shadows and gold gradients from progress bar
- Title: white 85% opacity, system font
- Bar: flat pill shape, white 8% bg, white 70% fill, no gloss
- Gold spinner fallback shown while mushroom assets still loading

### Loading screen mushroom animation (2026-02-20, 7e6aa68 → 162f9f1)
- Extracted Orange Mushroom sprites + login BGM to `resourcesv2/`
- `resourcesv2/mob/orange-mushroom/`: manifest.json + 6 PNGs (stand, move, jump)
- `resourcesv2/sound/login.mp3`: title/login BGM
- Mushroom animates across progress bar region, 1.2x scale, bouncing sine wave
- Login BGM plays during loading (looped, 35% volume), stops on load complete
- `preloadLoadingScreenAssets()` runs in parallel with `loadMap()` (non-blocking)
- Dev server (`serve-client-web.mjs`) serves `/resourcesv2/` route + `.mp3` content type

### UI window toggles work over game windows (2026-02-20, abf587b)
- Moved E/I/K toggle handlers above `input.enabled` check in keydown handler
- Window toggles now work even when mouse is hovering over a game window

### Keyboard Mappings keybind (2026-02-20, 2aabdd8)
- Added `keybinds: "KeyK"` to default keybinds
- Added "Keyboard Mappings" label in keybind UI
- Toggle handler alongside equip/inventory

### Sound debounce (2026-02-20, 02163a6)
- `playUISound()` debounces: skips if same sound played < 100ms ago
- Prevents double DragEnd during click→click→dblclick sequence

### Previous sync entries
(All entries from prior syncs remain valid: WZ cursor fix, inventory tabs, equip/unequip,
drop animation rewrite, ghost item anchor, item drag-drop, ground drops, loot system,
NPC dialogue button-only, face expressions, slot-based inventory, floating window z-order,
tooltip z-index, chat bubble prone, close window sound, simplified tooltip, CANCLICK delay,
chat log handle cursor, HUD restyle, etc.)

## Key Data Structures

```js
// Window z-order
_winZCounter = 25  // increments on each bringWindowToFront() call

// Item slot field
playerInventory[i].slot  // 0-31, position within tab grid

// Mob name visibility
lifeRuntimeState[i].nameVisible  // false until attacked

// Persistent cache
RESOURCE_CACHE_NAME = "maple-resources-v1"  // Cache API key

// Tooltip z-index: 99990 (above all windows, below cursor at 99999)
```
