import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard } from '../../../../server/src/game/constants.js';
import { cellPoint, playerPoint, walkingRoute, keyboardDestination, reachableDoorway } from './navigation.js';

for (const count of [3, 6, 8]) {
  test(`${count} players: corridor route reaches the real room doorway`, () => {
    const board = buildBoard(count);
    const player = { id: 'self', position: { cell: { r: 7, c: 3 }, room: null } };
    const route = walkingRoute(board, player.position, { room: 'Scullery' }, [player], player.id);
    assert.deepEqual(route.at(-1), cellPoint(board, board.rooms.Scullery.doorCells[0]));
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
  assert.deepEqual(walkingRoute(board, { room: 'Scullery' }, { room: 'Bureau' }, [], 'self'), []);
});
test('eight avatars sharing a room have distinct positions within its floor', () => {
  const board = buildBoard(8);
  const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, position: { room: 'Bureau' } }));
  const points = players.map(p => playerPoint(board, p, players));
  assert.equal(new Set(points.map(p => `${p.x},${p.z}`)).size, 8);
  const {r0,r1,c0,c1} = board.rooms.Bureau.rect;
  for (const point of points) {
    assert.ok(point.x > c0 - board.cols / 2 && point.x < c1 + 1 - board.cols / 2);
    assert.ok(point.z > r0 - board.rows / 2 && point.z < r1 + 1 - board.rows / 2);
  }
});

test('keyboard walking enters the Salon through a reachable doorway', () => {
  const board=buildBoard(3), rooms=new Set(['Salon']);
  assert.deepEqual(keyboardDestination(board,{r:7,c:10},-1,0,new Set(),rooms),{room:'Salon'});
  assert.equal(keyboardDestination(board,{r:7,c:10},-1,0,new Set(),new Set()),null);
  assert.equal(keyboardDestination(board,{r:6,c:9},0,1,new Set(),rooms),null,'cannot enter through the side of a doorway');
  assert.equal(keyboardDestination(board,{r:7,c:11},-1,0,new Set(),rooms),null,'cannot walk through a wall');
});
test('keyboard corridor movement stays within the dice reach', () => {
  const board=buildBoard(3), cells=new Set(['7,9']);
  assert.deepEqual(keyboardDestination(board,{r:7,c:8},0,1,cells,new Set()),{cell:{r:7,c:9}});
  assert.equal(keyboardDestination(board,{r:7,c:9},0,1,cells,new Set()),null);
});

test('Enter at a doorway chooses a reachable room rather than ending in the corridor', () => {
  const board=buildBoard(3);
  assert.equal(reachableDoorway(board,{r:7,c:10},new Set(['Salon'])),'Salon');
  assert.equal(reachableDoorway(board,{r:7,c:10},new Set()),null);
  assert.equal(reachableDoorway(board,{r:7,c:9},new Set(['Salon'])),null);
});
