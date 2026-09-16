export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;

// Classic set used for 3-6 players. Expanded set (adds 2 suspects + 2
// weapons) kicks in for 7-8 players so there are enough cards to deal
// a reasonable hand to everyone alongside the 3 solution cards.
const CLASSIC_SUSPECTS = [
  "Miss Carmine",
  "Brigadier Ochre",
  "Dowager Ivory",
  "Deacon Viridian",
  "Baroness Indigo",
  "Professor Mulberry",
];

const EXPANDED_SUSPECTS = [...CLASSIC_SUSPECTS, "Doctor Cerise", "Monsieur Sepia"];

const CLASSIC_WEAPONS = [
  "Candelabra",
  "Letter Opener",
  "Fire Poker",
  "Duelling Pistol",
  "Silk Cord",
  "Marble Bust",
];

const EXPANDED_WEAPONS = [...CLASSIC_WEAPONS, "Laudanum", "Antique Sabre"];

// ── Board geometry ──────────────────────────────────────────────────────
// The board is a 2D tile grid modeled on a classic country-house murder board: nine
// rooms (plus two extra for 7-8 players) arranged around an open field of
// corridor squares. Players move square-by-square with a die roll and enter
// rooms through doors. Rooms are authored as rectangles + door cells here;
// `buildBoard()` rasterizes them into a grid the client renders directly.

export const GRID = { rows: 25, cols: 24 };

// Each room: rect is inclusive {r0,r1,c0,c1}; doors list the room-edge cell
// (rendered as a gap in the wall) and its `entry` — the corridor square just
// outside, which is where you step in/out.
const CLASSIC_ROOM_DEFS = {
  Scullery: { rect: { r0: 1, r1: 5, c0: 1, c1: 5 }, doors: [{ cell: { r: 5, c: 3 }, entry: { r: 6, c: 3 } }] },
  Salon: {
    rect: { r0: 1, r1: 6, c0: 9, c1: 15 },
    doors: [
      { cell: { r: 6, c: 10 }, entry: { r: 7, c: 10 } },
      { cell: { r: 6, c: 14 }, entry: { r: 7, c: 14 } },
    ],
  },
  Glasshouse: { rect: { r0: 1, r1: 4, c0: 18, c1: 22 }, doors: [{ cell: { r: 4, c: 20 }, entry: { r: 5, c: 20 } }] },
  "Supper Room": {
    rect: { r0: 9, r1: 14, c0: 1, c1: 6 },
    doors: [
      { cell: { r: 11, c: 6 }, entry: { r: 11, c: 7 } },
      { cell: { r: 9, c: 4 }, entry: { r: 8, c: 4 } },
    ],
  },
  "Smoking Room": {
    rect: { r0: 8, r1: 11, c0: 18, c1: 22 },
    doors: [
      { cell: { r: 10, c: 18 }, entry: { r: 10, c: 17 } },
      { cell: { r: 11, c: 20 }, entry: { r: 12, c: 20 } },
    ],
  },
  "Reading Room": {
    rect: { r0: 14, r1: 17, c0: 17, c1: 22 },
    doors: [
      { cell: { r: 15, c: 17 }, entry: { r: 15, c: 16 } },
      { cell: { r: 14, c: 19 }, entry: { r: 13, c: 19 } },
    ],
  },
  Parlour: { rect: { r0: 19, r1: 23, c0: 1, c1: 6 }, doors: [{ cell: { r: 19, c: 4 }, entry: { r: 18, c: 4 } }] },
  Foyer: {
    rect: { r0: 18, r1: 23, c0: 10, c1: 14 },
    doors: [
      { cell: { r: 18, c: 11 }, entry: { r: 17, c: 11 } },
      { cell: { r: 18, c: 13 }, entry: { r: 17, c: 13 } },
    ],
  },
  Bureau: { rect: { r0: 20, r1: 23, c0: 18, c1: 22 }, doors: [{ cell: { r: 20, c: 20 }, entry: { r: 19, c: 20 } }] },
};

// Extra rooms activated only for 7-8 players.
const EXTRA_ROOM_DEFS = {
  Vaults: {
    rect: { r0: 10, r1: 15, c0: 9, c1: 14 },
    doors: [
      { cell: { r: 10, c: 11 }, entry: { r: 9, c: 11 } },
      { cell: { r: 15, c: 12 }, entry: { r: 16, c: 12 } },
      { cell: { r: 12, c: 9 }, entry: { r: 12, c: 8 } },
      { cell: { r: 13, c: 14 }, entry: { r: 13, c: 15 } },
    ],
  },
  "Menagerie": {
    rect: { r0: 15, r1: 17, c0: 1, c1: 5 },
    doors: [{ cell: { r: 16, c: 5 }, entry: { r: 16, c: 6 } }],
  },
};

// Center cellar stays a dead zone for classic (3-6 player) games.
const CENTER_CELLAR = { r0: 10, r1: 15, c0: 9, c1: 14 };

// Diagonal secret passages between opposite corner rooms — instant, no dice.
export const SECRET_PASSAGES = {
  Scullery: "Bureau",
  Bureau: "Scullery",
  Parlour: "Glasshouse",
  Glasshouse: "Parlour",
};

// Where each character's token starts — an edge corridor square.
export const START_POSITIONS = {
  "Miss Carmine": { r: 24, c: 7 },
  "Brigadier Ochre": { r: 17, c: 23 },
  "Dowager Ivory": { r: 0, c: 9 },
  "Deacon Viridian": { r: 0, c: 14 },
  "Baroness Indigo": { r: 6, c: 23 },
  "Professor Mulberry": { r: 8, c: 0 },
  "Doctor Cerise": { r: 24, c: 16 },
  "Monsieur Sepia": { r: 0, c: 5 },
};

export const CLASSIC_ROOMS = Object.keys(CLASSIC_ROOM_DEFS);
export const EXPANDED_ROOMS = [...CLASSIC_ROOMS, ...Object.keys(EXTRA_ROOM_DEFS)];
export const ROOMS = CLASSIC_ROOMS; // default card set

function roomDefsFor(playerCount) {
  return playerCount > 6 ? { ...CLASSIC_ROOM_DEFS, ...EXTRA_ROOM_DEFS } : CLASSIC_ROOM_DEFS;
}

// Rasterizes the room rectangles into a full tile grid. Returns the cell
// matrix plus a per-room summary (rect, door cells, corridor entry cells).
export function buildBoard(playerCount = 6) {
  const { rows, cols } = GRID;
  const roomDefs = roomDefsFor(playerCount);

  // Everything starts as walkable corridor.
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ type: "corridor" }))
  );

  // Classic games keep the center as an inaccessible cellar.
  if (playerCount <= 6) {
    for (let r = CENTER_CELLAR.r0; r <= CENTER_CELLAR.r1; r++) {
      for (let c = CENTER_CELLAR.c0; c <= CENTER_CELLAR.c1; c++) cells[r][c] = { type: "blank" };
    }
  }

  const rooms = {};
  for (const [name, def] of Object.entries(roomDefs)) {
    const { r0, r1, c0, c1 } = def.rect;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) cells[r][c] = { type: "room", room: name };
    }
    rooms[name] = { rect: def.rect, doorCells: [], entryCells: [], secretPassage: SECRET_PASSAGES[name] || null };
  }

  // Mark doors after all rooms are placed, and validate the entry square is
  // real corridor — a layout typo (door opening into a wall) fails loudly.
  for (const [name, def] of Object.entries(roomDefs)) {
    for (const door of def.doors) {
      cells[door.cell.r][door.cell.c] = { type: "door", room: name };
      const e = cells[door.entry.r]?.[door.entry.c];
      if (!e || e.type !== "corridor") {
        throw new Error(`Door entry for ${name} at (${door.entry.r},${door.entry.c}) is not corridor`);
      }
      rooms[name].doorCells.push(door.cell);
      rooms[name].entryCells.push(door.entry);
    }
  }

  return { rows, cols, cells, rooms, startPositions: START_POSITIONS };
}

export function getCardSets(playerCount) {
  const useExpanded = playerCount > 6;
  return {
    suspects: useExpanded ? EXPANDED_SUSPECTS : CLASSIC_SUSPECTS,
    weapons: useExpanded ? EXPANDED_WEAPONS : CLASSIC_WEAPONS,
    rooms: useExpanded ? EXPANDED_ROOMS : CLASSIC_ROOMS,
  };
}
