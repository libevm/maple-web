# .memory Sync Status

Last synced: 2026-02-18T18:50:00+11:00
Status: ✅ Synced

## Current authoritative memory files
- `.memory/game-design.md`
- `.memory/cpp-port-architecture-snapshot.md`
- `.memory/half-web-port-architecture-snapshot.md`
- `.memory/cpp-vs-half-web-port-gap-snapshot.md`
- `.memory/tech-stack.md`
- `.memory/implementation-plan.md`
- `.memory/canvas-rendering.md`
- `.memory/physics.md`
- `.memory/physics-units.md`

## Codebase Metrics Snapshot
- `client/web/app.js`: **7246 lines** (single-file debug web client)
- `client/src/` files: 13 (Phase 6 scaffolding — world-stage, combat-orchestrator, entity-pool)
- `server/src/` files: 6 (data-provider, server, build/dev/test harness)
- `packages/shared-schemas/src/` files: 4 (Zod schemas, constants)
- `tools/build-assets/src/` files: 13 (scanner, extractors, JSON reader, blob store, pipeline report)
- `tools/` other (observability, quality, policy, docs, workspace): 23 .mjs/.js files
- `docs/` files: 8 (process docs, pwa-findings, index)
- `resources/` WZ JSON: **22,182 files** across 16 WZ directories
- CI: **135 tests pass** across all workspaces (`bun run ci`)

## What was synced in this pass

### Full audit of `.memory/` vs actual codebase (2026-02-18)
No code changes since previous sync (only debug image cleanup + sync-status update commits).
All `.memory/` docs verified against actual `client/web/app.js` (7246 lines) function list, render pipeline, physics constants, and runtime state.

**Corrections applied:**
1. **canvas-rendering.md**: Fixed render order to accurately show `drawLifeSprites(filterLayer)` is called inside `drawMapLayersWithCharacter()` per map layer — not as a standalone step. Updated draw order listing.
2. **canvas-rendering.md**: Updated to document all runtime state fields including `keybinds`, `portalScroll`, `npcDialogue`, `hiddenPortalState`, `settings` (bgm/sfx/fixedRes/minimap), `debug` sub-toggles.
3. **physics.md**: Verified all constants match app.js. Swimming physics documented. No changes needed.
4. **physics-units.md**: Verified conversion formulas and code references. No changes needed.
5. **implementation-plan.md**: Verified execution status entries are accurate. No changes needed (last entry already covered all features).
6. **sync-status.md**: Updated timestamp, metrics, and phase status.

### Feature inventory (verified present in app.js)

**Rendering:**
- Backgrounds (parallax, tiling, animated, black-bg maps)
- Map layers (tiles + objects, z-sorted per layer)
- Character composition (body/head/face/hair/equips, anchor-based, zmap ordering)
- Life sprites (mobs + NPCs, per-layer rendering with HP bars)
- Reactors (state 0 idle, animated frames)
- Portals (type-aware: visible/hidden/scripted, animated frames)
- Damage numbers (WZ sprites, critical gold, miss text)
- Chat bubbles (word-wrapped, timed)
- Player name label
- Status bar (HP/MP/EXP gauges, level/job)
- Map name banner (fade-in/out)
- Minimap (collapsible, player/portal/mob/NPC/reactor dots)
- Loading screen (progress bar)
- Transition overlay (fade in/out for portal transfers)
- Debug overlays (footholds, ropes, life markers, reactor markers)

**Physics/Movement:**
- Foothold-based platforming (C++ parity constants)
- Gravity, friction, slope drag, ground-slip
- Jump, down-jump (foothold exclusion window)
- Rope/ladder climbing (attach/detach, cooldown, top-exit, side-jump)
- Wall collision (2-link lookahead, airborne + grounded)
- Swimming physics (separate gravity/friction/force constants)
- Edge traversal (prev/next foothold chain resolution)
- Swept landing detection (ray-segment intersection)
- Portal scroll (momentum-based camera glide to destination)

**Combat:**
- Click-to-attack mobs (350ms cooldown, STR-based damage)
- Mob stagger → aggro → patrol state machine
- Knockback (C++ faithful: 0.2 hforce for ~31 ticks, ground friction)
- Mob HP from WZ `maxHP`, damage formula with STR/weapon/level
- Hit/Die stances, mob-specific SFX
- Death fade-out, 8s respawn timer
- EXP on kill, level-up system
- Damage numbers (WZ sprites, critical chance)

**Interaction:**
- NPC click → dialogue box (portrait, word-wrap, scripted options, page navigation)
- Known NPC scripts (taxis, Spinel town warps)
- Portal interaction (↑ key, type-aware, intramap/intermap warp)
- Hidden portal reveal (touch-based, fade-in)
- Chat input (Enter to open, local messages + system messages)

**UI/Settings:**
- Settings modal (BGM/SFX toggle, fixed resolution, minimap toggle)
- Keybind customization (attack, jump, pickup, stored in localStorage)
- Debug panel (overlay toggles, mouse-fly mode, stat editor, teleport presets)
- Resizable chat log (drag handle, collapse/expand)
- Mouse-fly debug mode
- Canvas focus-gated keyboard input

**Audio:**
- BGM playback (map-driven, fade-out on map change)
- SFX (jump, portal, mob hit/die, attack)
- Audio unlock button (browser autoplay policy)

**Asset Loading:**
- Three-layer cache (jsonCache → metaCache → imageCache)
- Promise deduplication for concurrent requests
- Map preload pipeline (8 parallel workers, progress tracking)
- Character data preloading (all parts for 6 frames per action)
- Life animation loading (mob/NPC with link resolution)
- Reactor animation loading
- UOL resolution for character frame parts

## Phase completion status
- Phase 0 (Steps 1-4): ✅ Complete (DoD, logging, debug flags, debug panel requirements)
- Phase 1 (Steps 5-7): ✅ Complete (workspace structure, scripts, quality gates)
- Phase 2-5: ✅ Complete (shared schemas, asset pipeline tooling, data provider, server)
- Phase 6 (Steps 33-35): ✅ Scaffolding complete (world-stage, combat-orchestrator, entity-pool)
- Phase 7: Not started — requires game server protocol
- Phase 8 (Steps 40-44): ⏳ Partial
  - **Combat system**: ✅ Stagger/aggro/KB complete, WZ HP, damage formula
  - **Equipment rendering**: ✅ Complete (hair/coat/pants/shoes/weapon, climbing parity)
  - **Player HUD**: ✅ Complete (name, status bar, map banner, minimap)
  - **Mob rendering**: ✅ Layer-correct rendering with HP bars
  - **NPC system**: ✅ Dialogue with scripts, portraits, options
  - **Reactor system**: ✅ State 0 rendering + animation
  - **Portal system**: ✅ Type-aware rendering + interaction + transitions

## Next expected update point
- Phase 7: Networking and multiplayer (needs server protocol)
- More visual polish: weather, effects, skill UI
- Performance: foothold spatial index, animation interpolation
