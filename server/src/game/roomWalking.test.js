import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from './GameRoom.js';
import { acceptRoomWalk, walkingSnapshot, bindRoomWalking } from './roomWalking.js';
function fixture() {
  const game=new GameRoom('WALK',3);
  for(const name of ['Alice','Bob','Cara'])game.addPlayer(name,name);
  game.start();
  const player=game.players[0];player.position={room:'Scullery',cell:null};
  const {c0,c1,r0,r1}=game.board.rooms.Scullery.rect;
  return {game,player,pose:{room:'Scullery',x:(c0+c1+1)/2-game.board.cols/2,z:(r0+r1+1)/2-game.board.rows/2,yaw:0}};
}
test('room walking is shared ephemeral state and leaves rules, cards and turn untouched',()=>{
  const {game,player,pose}=fixture(), before=JSON.stringify(game.toClientState(player.id));
  assert.ok(acceptRoomWalk(game,player.id,pose,1000));
  assert.equal(walkingSnapshot(game).length,1);
  assert.equal(JSON.stringify(game.toClientState(player.id)),before);
});
test('rejects non-finite, outside-room, wrong-room and disconnected updates',()=>{
  const {game,player,pose}=fixture();
  for(const invalid of [null,{...pose,x:NaN},{...pose,z:Infinity},{...pose,x:1000},{...pose,room:'Bureau'}])assert.equal(acceptRoomWalk(game,player.id,invalid),null);
  player.connected=false;assert.equal(acceptRoomWalk(game,player.id,pose),null);
});
test('throttles updates and rejects jumps, accepts normal walking',()=>{
  const {game,player,pose}=fixture();
  assert.ok(acceptRoomWalk(game,player.id,pose,1000));
  assert.equal(acceptRoomWalk(game,player.id,pose,1020),null);
  assert.equal(acceptRoomWalk(game,player.id,{...pose,x:pose.x+2},1100),null);
  assert.ok(acceptRoomWalk(game,player.id,{...pose,x:pose.x+.2},1100));
});
test('room exit and game completion discard stale positions',()=>{
  const {game,player,pose}=fixture();acceptRoomWalk(game,player.id,pose);
  player.position={room:'Bureau',cell:null};assert.deepEqual(walkingSnapshot(game),[]);
  player.position={room:'Scullery',cell:null};acceptRoomWalk(game,player.id,pose);
  game.status='finished';assert.deepEqual(walkingSnapshot(game),[]);
});

test('transport binds to the owned seat and only broadcasts validated room poses',()=>{
  const {game,player,pose}=fixture();let handler;const sent=[];
  const socket={id:player.socketId,data:{code:game.code,playerId:player.id},on:(_event,fn)=>handler=fn,to:code=>({emit:(event,value)=>sent.push({code,event,value})})};
  bindRoomWalking(socket,{getRoom:code=>code===game.code?game:null});
  handler({...pose,code:game.code,playerId:'someone-else'});handler({...pose,code:'OTHER',playerId:player.id});
  assert.equal(sent.length,0);
  handler({...pose,code:game.code,playerId:player.id});assert.equal(sent.length,1);
  assert.equal(sent[0].code,game.code);assert.equal(sent[0].value.playerId,player.id);
  assert.deepEqual(Object.keys(sent[0].value).sort(),['playerId','room','time','x','yaw','z']);
  socket.id='stale-connection';handler({...pose,code:game.code,playerId:player.id});assert.equal(sent.length,1);
});
