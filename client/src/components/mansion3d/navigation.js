// Render-only route planning. The server remains authoritative about legal moves.
export function cellPoint(board, cell) {
  return { x: cell.c + 0.5 - board.cols / 2, z: cell.r + 0.5 - board.rows / 2 };
}
export function playerPoint(board, player, players) {
  if (player.position.cell) return cellPoint(board, player.position.cell);
  const room = board.rooms[player.position.room];
  if (!room) return { x: 0, z: 0 };
  const { r1, c0, c1 } = room.rect;
  const siblings = players.filter(p => p.position.room === player.position.room);
  const i = Math.max(0, siblings.findIndex(p => p.id === player.id));
  return { x: (c0 + c1 + 1) / 2 - board.cols / 2 + (i % 3 - 1) * 0.68,
    z: r1 - board.rows / 2 - 0.35 - Math.floor(i / 3) * 0.72 };
}
export function walkingRoute(board, from, to, players, playerId) {
  if (!from || !to || from.room === to.room && from.room) return [];
  // Secret passages are a deliberate teleport, not a walk through other rooms.
  if (from.room && board.rooms[from.room]?.secretPassage === to.room) return [];
  const starts = from.cell ? [from.cell] : board.rooms[from.room]?.entryCells || [];
  const goals = to.cell ? [to.cell] : board.rooms[to.room]?.entryCells || [];
  const key = p => `${p.r},${p.c}`;
  const goalKeys = new Set(goals.map(key));
  const occupied = new Set(players.filter(p => p.id !== playerId && p.position.cell).map(p => key(p.position.cell)));
  const queue = starts.filter(p => !occupied.has(key(p))).map(p => [p]);
  const seen = new Set(queue.map(path => key(path[0])));
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i], current = path[path.length - 1];
    if (goalKeys.has(key(current))) {
      const points = path.map(p => cellPoint(board, p));
      if (from.room) {
        const room = board.rooms[from.room];
        points.unshift(cellPoint(board, room.doorCells[room.entryCells.findIndex(p => key(p) === key(path[0]))]));
      }
      if (to.room) {
        const room = board.rooms[to.room];
        points.push(cellPoint(board, room.doorCells[room.entryCells.findIndex(p => key(p) === key(current))]));
      }
      return points;
    }
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = { r: current.r + dr, c: current.c + dc }, k = key(next);
      if (seen.has(k) || occupied.has(k) || board.cells[next.r]?.[next.c]?.type !== 'corridor') continue;
      seen.add(k); queue.push([...path, next]);
    }
  }
  return [];
}

// A keyboard step may cross a room boundary only through its paired doorway.
export function keyboardDestination(board, from, dr, dc, reachableCells, reachableRooms) {
  const next = { r: from.r + dr, c: from.c + dc };
  const tile = board.cells[next.r]?.[next.c];
  if (tile?.type === 'corridor' && reachableCells.has(`${next.r},${next.c}`)) return { cell: next };
  if (tile?.type === 'door' && reachableRooms.has(tile.room)) {
    const room = board.rooms[tile.room];
    const index = room.doorCells.findIndex(p => p.r === next.r && p.c === next.c);
    const entry = room.entryCells[index];
    if (entry?.r === from.r && entry?.c === from.c) return { room: tile.room };
  }
  return null;
}

export function reachableDoorway(board, cell, reachableRooms) {
  if (!cell) return null;
  return Object.entries(board.rooms).find(([name, room]) => reachableRooms.has(name) && room.entryCells.some(entry => entry.r === cell.r && entry.c === cell.c))?.[0] || null;
}
