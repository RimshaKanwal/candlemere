import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard } from '../../../../server/src/game/constants.js';
import { cellPoint, playerPoint, walkingRoute } from './navigation.js';

for (const count of [3, 6, 8]) {
  test(`${count} players: corridor route reaches the real room doorway`, () => {
    const board = buildBoard(count);
    const player = { id: 'self', position: { cell: { r: 7, c: 3 }, room: null } };
    const route = walkingRoute(board, player.position, { room: 'Kitchen' }, [player], player.id);
    assert.deepEqual(route.at(-1), cellPoint(board, board.rooms.Kitchen.doorCells[0]));
    for (let i = 1; i < route.length; i++) {
      assert.equal(Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].z - route[i - 1].z), 1);
    }
  });
}
test('walks around other detectives instead of through them', () => {
  const board = buildBoard(6);
  const occupied = { id: 'other', position: { cell: { r: 7, c: 3 } } };
  const route = walkingRoute(board, { cell: { r: 7, c: 2 } }, { cell: { r: 7, c: 4 } }, [occupied], 'self');
  assert.ok(route.length > 3);
  assert.ok(!route.some(p => p.x === cellPoint(board, occupied.position.cell).x && p.z === cellPoint(board, occupied.position.cell).z));
});
test('secret passages do not animate through intervening walls', () => {
  const board = buildBoard(6);
  assert.deepEqual(walkingRoute(board, { room: 'Kitchen' }, { room: 'Study' }, [], 'self'), []);
});
test('eight avatars sharing a room have distinct positions within its floor', () => {
  const board = buildBoard(8);
  const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, position: { room: 'Study' } }));
  const points = players.map(p => playerPoint(board, p, players));
  assert.equal(new Set(points.map(p => `${p.x},${p.z}`)).size, 8);
  const {r0,r1,c0,c1} = board.rooms.Study.rect;
  for (const point of points) {
    assert.ok(point.x > c0 - board.cols / 2 && point.x < c1 + 1 - board.cols / 2);
    assert.ok(point.z > r0 - board.rows / 2 && point.z < r1 + 1 - board.rows / 2);
  }
});
