import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from './GameRoom.js';
import { acceptInteraction, interactionSnapshot, bindRoomInteractions } from './roomInteractions.js';
function fixture() {
 const game=new GameRoom('PROPS',3);
 for(const name of ['Alice','Bob','Cara'])game.addPlayer(name,name);
 game.start();for(const player of game.players)player.position={room:'Salon',cell:null};
 return {game,a:game.players[0],b:game.players[1]};
}
test('friends share one drawer state, and snapshots preserve it without changing game rules',()=>{
 const {game,a,b}=fixture(), before=JSON.stringify(game.toClientState(a.id));
 assert.equal(acceptInteraction(game,a.id,{room:'Salon',kind:'drawer'},1000).open,true);
 assert.equal(acceptInteraction(game,b.id,{room:'Salon',kind:'drawer'},1001).open,false);
 assert.equal(interactionSnapshot(game)[0].open,false);
 assert.equal(JSON.stringify(game.toClientState(a.id)),before);
});
test('interactions require being inside the room and reject invalid objects or spam',()=>{
 const {game,a}=fixture();
 for(const input of [null,{room:'Scullery',kind:'drawer'},{room:'Salon',kind:'solution'},{room:'Salon',kind:'door'}])assert.equal(acceptInteraction(game,a.id,input),null);
 assert.ok(acceptInteraction(game,a.id,{room:'Salon',kind:'piano'},1000));
 assert.equal(acceptInteraction(game,a.id,{room:'Salon',kind:'drawer'},1100),null);
 a.connected=false;assert.equal(acceptInteraction(game,a.id,{room:'Salon',kind:'drawer'},5000),null);
});
test('piano has a shared cooldown and finished matches expose no active props',()=>{
 const {game,a,b}=fixture(), input={room:'Salon',kind:'piano'};
 acceptInteraction(game,a.id,input,1000);
 assert.equal(acceptInteraction(game,b.id,input,2000),null);
 assert.ok(acceptInteraction(game,b.id,input,3000));
 game.status='finished';assert.deepEqual(interactionSnapshot(game),[]);
 assert.equal(acceptInteraction(game,a.id,input,6000),null);
});
test('transport broadcasts to the whole game, including the actor, and rejects seat spoofing',()=>{
 const {game,a}=fixture(), messages=[];let receive;
 const socket={id:a.socketId,data:{code:game.code,playerId:a.id},on:(_,handler)=>receive=handler};
 const io={to:code=>({emit:(event,payload)=>messages.push({code,event,payload})})};
 bindRoomInteractions(socket,{getRoom:()=>game},io);
 receive({code:game.code,playerId:'someone-else',room:'Salon',kind:'drawer'});assert.equal(messages.length,0);
 receive({code:game.code,playerId:a.id,room:'Salon',kind:'drawer'});assert.equal(messages.length,1);
 assert.equal(messages[0].code,game.code);assert.equal(messages[0].event,'roomInteraction');assert.equal(messages[0].payload.open,true);
});
