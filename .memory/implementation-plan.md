# Implementation Plan (AI Developer Playbook)

Date: 2026-02-18
Runtime: **Bun**
Architecture: `client/` + `server/` + `tools/build-assets/` + shared schemas

## Current State Summary

The web debug client (`client/web/`) is a fully playable MapleStory browser client with:
- Full scene rendering (backgrounds, tiles, objects, portals, characters)
- C++ faithful physics (ground/air/swim)
- Chat system matching C++ UIChatBar
- Settings system with audio/display controls
- Debug panel with teleport, stats, overlays, runtime summary

## Active Architecture

### Physics Engine (`client/web/app.js`)
- **TPS**: 125 (matches C++ TIMESTEP=8ms)
- **Ground**: Force-based walk with C++ friction/slope model
  - `walkforce = 0.05 + 0.11 * speed/100`
  - `jumpforce = 1.0 + 3.5 * jump/100`
  - `climbforce = speed / 100`
  - Friction: 0.5, SlopeFactor: 0.1, GroundSlip: 3.0
- **Air**: Gravity (0.14/tick) + opposing-direction brake (0.025/tick)
  - Fall speed cap: 670 px/s
- **Water**: Swimming physics on `map.swim` maps
  - Horizontal: SWIM_HFRICTION=0.14, SWIM_HFORCE=0.12
  - Vertical: SWIMFRICTION=0.08, SWIMGRAVFORCE=0.07
  - Space = swim-jump impulse (80% jump force), repeatable while held
  - UP/DOWN = continuous vertical swim force (FLYFORCE=0.25)
  - "fly" animation while swimming
- **Defaults**: Speed=115, Jump=110

### Camera System
- Smooth follow with `12.0/dimension` easing (C++ Camera.cpp)
- X clamp: VRLeft/VRRight → walls (leftW+25, rightW-25) → bounds
- Y clamp: VRTop/VRBottom → borders (topB-300, botB+100) → bounds
- Bottom-anchor when map shorter than viewport
- Scene render bias: `max(0, (canvasH-600)/2)` for tall viewports
- Portal momentum tween for same-map warps

### Settings System (NEW)
- Gear button in canvas, themed modal overlay
- **Audio**: BGM toggle, SFX toggle (both enabled by default)
- **Display**: Fixed 16:9 resolution (enabled by default, recommended)
- Audio enabled by default — no unlock button needed
- All settings persisted in localStorage (`mapleweb.settings.v1`)

### Chat System
- In-canvas chat bar (Enter toggles, Escape closes)
- Chat log with resize handle, collapse/expand via double-click
- 128 char limit, movement suppressed while typing
- System messages for map load, swim maps

### Rendering
- Parallax: fixed 800×600 reference for WZ rx/ry values
- Background: native WZ type flags only (no force-tiling)
- Hidden portals: 500ms delay + 400ms fade-in
- Touch portals (type 3/9): auto-enter on contact
- Character: dynamic part composition with z-order from Base.wz

### Debug Features
- Debug panel: map load, teleport, stats, overlays, runtime summary
- MouseFly mode (Ctrl+Space): character follows cursor
- Overlay toggles: footholds, ropes, life markers

## Key Files
- `client/web/app.js` — main application logic
- `client/web/index.html` — HTML structure
- `client/web/styles.css` — all styling
- `tools/dev/serve-client-web.mjs` — dev server

## Validation
- `bun run ci` — automated tests
- `CLIENT_WEB_PORT=5210 bun run client:web` — manual smoke test
