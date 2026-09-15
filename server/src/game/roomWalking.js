// Ephemeral room animation state. Never written to accounts or match history.
const sessions = new WeakMap();
function posesFor(game) {
  if (!sessions.has(game)) sessions.set(game, new Map());
  const poses = sessions.get(game);
  for (const [id, pose] of poses) {
    if (game.status !== 'playing' || game.players.find(p => p.id === id)?.position?.room !== pose.room) poses.delete(id);
  }
  return poses;
}
export function walkingSnapshot(game) { return [...posesFor(game).values()]; }
export function acceptRoomWalk(game, playerId, input, now = Date.now()) {
  if (!input || game.status !== 'playing') return null;
  const player = game.players.find(p => p.id === playerId);
  if (!player?.connected || !player.position?.room || player.position.room !== input.room) return null;
  const { x, z, yaw } = input;
  if (![x, z, yaw].every(Number.isFinite)) return null;
  const room = game.board.rooms[input.room];
  if (!room) return null;
  const { r0, r1, c0, c1 } = room.rect;
  if (x < c0 - game.board.cols / 2 + .3 || x > c1 + 1 - game.board.cols / 2 - .3 || z < r0 - game.board.rows / 2 + .3 || z > r1 + 1 - game.board.rows / 2 - .3) return null;
  const poses = posesFor(game), previous = poses.get(playerId);
  if (previous) {
    const dt = now - previous.time;
    if (dt < 50 || Math.hypot(x - previous.x, z - previous.z) > Math.min(dt / 1000, 1) * 4 + .35) return null;
  }
  const pose = { playerId, room: input.room, x, z, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), time: now };
  poses.set(playerId, pose);
  return pose;
}

export function bindRoomWalking(socket, manager) {
  socket.on('roomWalk', payload => {
    if (!payload || payload.code !== socket.data.code || payload.playerId !== socket.data.playerId) return;
    const room = manager.getRoom(socket.data.code);
    if (!room || room.players.find(p => p.id === socket.data.playerId)?.socketId !== socket.id) return;
    const pose = acceptRoomWalk(room, socket.data.playerId, payload);
    if (pose) socket.to(room.code).emit('roomWalk', pose);
  });
}
