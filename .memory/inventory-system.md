# Inventory System

> Implements the MapleStory item inventory with tabbed categories, drag-drop,
> ground drops, and loot. C++ reference: `UIItemInventory`, `Inventory`, `InventoryType`.

## Inventory Types (C++ `InventoryType::by_item_id`)

Item ID prefix (`floor(id / 1000000)`) determines the inventory tab:

| Prefix | Type   | Tab Label | Example IDs           |
|--------|--------|-----------|-----------------------|
| 1      | EQUIP  | Equip     | 1040002 (Coat)        |
| 2      | USE    | Use       | 2000000 (Red Potion)  |
| 3      | SETUP  | Set-up    | 3010000               |
| 4      | ETC    | Etc       | 4000000 (Snail Shell) |
| 5      | CASH   | Cash      | 5000000               |

Helper: `inventoryTypeById(id)` returns `"EQUIP"` / `"USE"` / `"SETUP"` / `"ETC"` / `"CASH"` / `null`.

## Data Model

### `playerInventory` (Array)

Each entry:
```js
{
  id: number,       // item ID
  name: string,     // display name (async loaded from String.wz)
  qty: number,      // stack count (equips always 1)
  iconKey: string,  // key into iconDataUriCache
  invType: string,  // "EQUIP" | "USE" | "SETUP" | "ETC" | "CASH"
  category: string, // equip slot type for EQUIP items (e.g. "Coat"), null otherwise
}
```

### Tab State

- `currentInvTab` — currently selected tab (`"EQUIP"` | `"USE"` | `"SETUP"` | `"ETC"` | `"CASH"`)
- `INV_TABS` — `["EQUIP", "USE", "SETUP", "ETC", "CASH"]`
- Tab buttons in `#inv-tabs` HTML container

### Slot Layout

- `INV_COLS = 4`, `INV_ROWS = 6` → 24 visible slots per tab
- Grid rendered by `refreshInvGrid()`, filtered by `currentInvTab`
- Items beyond 24 in a tab are not visible (no scroll yet)

## UI Structure

### HTML (`index.html`)

```html
<div id="inventory-window" class="game-window hidden">
  <div class="game-window-titlebar" data-window="inventory">...</div>
  <div id="inv-tabs" class="inv-tabs">
    <button class="inv-tab active" data-tab="EQUIP">Equip</button>
    <button class="inv-tab" data-tab="USE">Use</button>
    <button class="inv-tab" data-tab="SETUP">Set-up</button>
    <button class="inv-tab" data-tab="ETC">Etc</button>
    <button class="inv-tab" data-tab="CASH">Cash</button>
  </div>
  <div id="inv-grid" class="inv-grid"></div>
</div>
```

### CSS (`styles.css`)

- `.inv-tabs` — flex row, background matches window chrome
- `.inv-tab` — compact tab button (9px font, rounded top corners)
- `.inv-tab.active` — lighter background, bottom border hidden (merges with grid)
- `.inv-grid` — 4-column CSS grid of 36×36px slots

## Tab Switching

- Click tab button → sets `currentInvTab`, calls `refreshInvGrid()`
- Active tab button gets `.active` class
- Wired in init via `document.querySelectorAll("#inv-tabs .inv-tab")` click listeners

## Slot Interactions

### Single Click — Start Drag
- Click any item slot → `startItemDrag(source, index, item)`
- Sets `draggedItem` state, dims source slot to 40% opacity
- Ghost icon follows cursor (bottom-right anchor via CSS transform)
- Click again or Escape → `cancelItemDrag()`

### Double-Click — Equip (EQUIP tab only)
- Double-click inventory EQUIP item → `equipItemFromInventory(invIndex)`
- Moves item from inventory to `playerEquipped`
- If slot occupied, existing equip swapped back to inventory
- Loads WZ data, clears character placement cache

### Drop on Map
- Click game canvas while dragging → `dropItemOnMap()`
- Spawns ground drop at player X, finds foothold Y below
- C++ physics: vspeed=-5.0 upward arc, gravity 0.14/tick, spin 0.2rad/tick
- Item X never changes; lands at foothold, switches to floating bob
- Only lootable after landing animation completes

## Item Icon Loading

### Equip Icons
- `loadEquipIcon(equipId, category)` → fetches `Character.wz/{category}/{padded}.img.json`
- Reads `info/icon` or `info/iconRaw` canvas → base64 data URI
- Cached in `iconDataUriCache` keyed `equip-icon:{id}`

### Consumable/Etc Icons
- `loadItemIcon(itemId)` → fetches `Item.wz/Consume/{prefix}.img.json` or `Item.wz/Etc/{prefix}.img.json`
- Reads `{paddedId}/info/icon` canvas
- Cached in `iconDataUriCache` keyed `item-icon:{id}`

### Item Names
- `loadItemName(itemId)` → fetches from `String.wz/Eqp.img.json`, `Consume.img.json`, or `Etc.img.json`
- Async; updates UI on resolve

## Ground Drops

### Drop Object Shape
```js
{
  id, name, qty, iconKey, category,
  x,          // world X (fixed at drop position)
  y,          // world Y (animated)
  destY,      // foothold landing Y - 4
  vy,         // vertical velocity (starts at -5.0)
  onGround,   // false=DROPPED, true=FLOATING
  opacity,    // 1.0 normal, fades during pickup
  angle,      // rotation (0.2/tick while airborne, 0 when landed)
  bobPhase,   // cosine phase for floating bob
  spawnTime,  // performance.now() at spawn
  pickingUp,  // true during loot animation
  pickupStart,// timestamp of loot start
}
```

### Drop States (C++ `Drop::State`)
- **DROPPED** (`onGround=false`): vertical gravity arc, spin, X fixed
- **FLOATING** (`onGround=true`): bob `5.0 + (cos(phase)-1)*2.5`, lootable
- **PICKEDUP** (`pickingUp=true`): fly toward player, fade out over 400ms

### Drop Rendering (`drawGroundDrops`)
- Airborne: rotate around icon center (no visual X drift)
- Landed: bottom-center anchor, icon sits above foothold
- Bob offset applied during FLOATING state

### Loot
- Z key (configurable) → `tryLootDrop()`
- 50px range, player on ground, drop must be `onGround`
- One item per press (C++ `lootenabled` parity)
- Equip items: non-stackable, added with `invType: "EQUIP"`
- Other items: stack if same ID exists in inventory

## Starter Items

```js
// initPlayerInventory()
{ id: 2000000, qty: 30 },  // Red Potion     → USE tab
{ id: 2000001, qty: 15 },  // Orange Potion  → USE tab
{ id: 2000002, qty: 5  },  // White Potion   → USE tab
{ id: 2010000, qty: 10 },  // Blue Potion    → USE tab
{ id: 4000000, qty: 8  },  // Snail Shell    → ETC tab
{ id: 4000001, qty: 3  },  // Blue Snail Shell → ETC tab
```

## Keybinds

- `inventory` — toggle inventory window (default: KeyI)
- `loot` — pick up nearest ground drop (default: KeyZ)

## Known Limitations

- No scroll/pagination within a tab (max 24 visible slots)
- No item sorting or gathering (C++ has Sort/Gather buttons)
- No item use (double-click USE items does nothing yet)
- No meso display
- No item tooltips with stat details (only name/qty/ID)
- No stack splitting when dropping partial quantities
