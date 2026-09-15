// Shared props live with the match in memory, never in player profiles.
const sessions = new WeakMap();
function session(game) {
  if (!sessions.has(game)) sessions.set(game, { props: new Map(), lastAction: new Map(), seq: 0 });
  return sessions.get(game);
}
export function interactionSnapshot(game) {
  return game.status === 'playing' ? [...session(game).props.values()] : [];
}
export function acceptInteraction(game, playerId, input, now = Date.now()) {
  if (!input) return null;
  const player = game.players.find(p => p.id === playerId);
  if (game.status !== 'playing' || !player?.connected || player.position?.room !== input?.room) return null;
  if (!game.board.rooms[input.room] || !['drawer','piano'].includes(input.kind) || input.kind === 'piano' && input.room !== 'Ballroom') return null;
  const state = session(game), key = `${input.room}:${input.kind}`, previous = state.props.get(key);
  if (now - (state.lastAction.get(playerId) ?? -Infinity) < 350) return null;
  if (input.kind === 'piano' && previous && now - previous.time < 1800) return null;
  state.lastAction.set(playerId, now);
  const action = { room: input.room, kind: input.kind, open: input.kind === 'drawer' ? !previous?.open : false, playerId, playerName: player.name, time: now, seq: ++state.seq };
  state.props.set(key, action);
  return action;
}
export function bindRoomInteractions(socket, manager, io) {
  socket.on('roomInteraction', input => {
    if (!input || input.code !== socket.data.code || input.playerId !== socket.data.playerId) return;
    const game = manager.getRoom(socket.data.code);
    if (!game || game.players.find(p => p.id === socket.data.playerId)?.socketId !== socket.id) return;
    const action = acceptInteraction(game, socket.data.playerId, input);
    if (action) io.to(game.code).emit('roomInteraction', action);
  });
}
