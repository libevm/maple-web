# .memory Sync Status

Last synced: 2026-02-18T09:30:00+11:00
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

## What was synced in this pass
1. **C++ Mob::update faithful port** — complete rewrite of mob AI loop:
   - **TURNATEDGES check first** (C++ lines 193-199): if flag cleared → flip mob, re-set flag, exit HIT→STAND
   - **Force application by stance** (C++ lines 201-236):
     - MOVE: `hforce = flip ? speed : -speed`
     - HIT: `hforce = flip ? -KBFORCE : KBFORCE` (0.2 ground / 0.1 air)
     - STAND: no force
   - **physics.move_object** via `mobPhysicsStep()` with wall/edge limits
   - **Counter-based transitions** (C++ lines 241-261):
     - HIT: `next = counter > 200`
     - Default: `next = aniEnd && counter > 200`
   - **next_move()** (C++ lines 274-316): faithful random 3-way from MOVE, HIT/STAND→MOVE
   - Removed custom aggro/chase system — C++ has no client-side aggro (server controls mode=2)

2. **C++ update_fh foothold clamping** in `mobPhysicsStep`:
   - When mob walks past foothold chain end (nextId/prevId = 0):
     - Try `fhIdBelow()` for below foothold
     - If none found: clamp x back to foothold edge, zero hspeed (C++ `limitx`)
   - When next foothold is a wall: same clamping behavior
   - Mobs can never fall off their designated foothold chains

## Validation snapshot
- ✅ `bun run ci` — all tests pass across all workspaces

## Phase completion status
- Phase 0-5: ✅ Complete
- Phase 6: Scaffolding complete
- Phase 7: Not started — requires game server protocol
- Phase 8 (Steps 40-44): ⏳ Partial
- **Combat system**: ✅ C++ faithful — damage formula, knockback physics, foothold clamping, next_move
- **Equipment rendering**: ✅ Complete
- **Player HUD**: ✅ Complete

## Next expected update point
- Phase 7: Networking and multiplayer (needs server protocol)
- Phase 8: Remaining visual features (map weather/effects, projectiles)
- Phase 9: E2E validation
