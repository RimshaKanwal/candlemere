import test from "node:test";
import assert from "node:assert/strict";
import { GameRoom } from "./GameRoom.js";
import { primeBots, botStep, nextBotName } from "./bots.js";

// Mirrors what index.js does with a private reveal: a bot suggester is told
// the card the same way a human is, just into its brain instead of a socket.
function reveal(room, privateReveal) {
  if (!privateReveal?.shownCard || !privateReveal.byId) return;
  const suggester = room.players.find((p) => p.id === privateReveal.suggesterId);
  if (suggester?.isBot) suggester.brain.noteShownCard(privateReveal.byId, privateReveal.shownCard);
}

function whoseMove(room) {
  if (room.status !== "playing") return null;
  const pending = room.pendingSuggestion;
  if (pending) {
    const responder = room.players.find((p) => p.id === pending.responderOrder[pending.index]);
    return responder?.isBot ? responder : null;
  }
  const current = room.currentPlayer();
  return current?.isBot && !current.eliminated ? current : null;
}

// Runs an all-bot table to completion, so every rule the bots touch — moving,
// suggesting, disproving, accusing — is exercised against the real GameRoom.
function playOut(seats, stepCap = 20000) {
  const room = new GameRoom("TEST", 8, {});
  for (let i = 0; i < seats; i++) room.addBot(nextBotName(room));
  room.start();
  primeBots(room);

  let steps = 0;
  while (room.status === "playing" && steps < stepCap) {
    const actor = whoseMove(room);
    assert.ok(actor, "an all-bot table should always have someone to move");
    botStep(room, actor, reveal);
    steps++;
  }
  return { room, steps };
}

test("a bot seat is added with a name that is never also a card", () => {
  const room = new GameRoom("TEST", 6, {});
  room.addPlayer("sock", "Rimshi", 1);
  const bot = room.addBot(nextBotName(room));
  assert.equal(bot.isBot, true);
  assert.equal(bot.socketId, null);
  assert.equal(bot.userId, null);
  assert.equal(bot.isHost, false);
  assert.ok(bot.connected, "bots must answer suggestions, so they count as present");
  assert.equal(room.hasBots, true);
  assert.equal(room.humanCount, 1);

  const { suspects } = { suspects: room.toClientState(bot.id).cardSets.suspects };
  assert.ok(!suspects.includes(bot.name));
});

test("one human plus two bots is enough to start", () => {
  const room = new GameRoom("TEST", 6, {});
  room.addPlayer("sock", "Rimshi", 1);
  assert.equal(room.canStart(), false);
  room.addBot(nextBotName(room));
  assert.equal(room.canStart(), false);
  room.addBot(nextBotName(room));
  assert.equal(room.canStart(), true, "a solo player with two bots fills a table");
});

test("bots are only removable in the lobby", () => {
  const room = new GameRoom("TEST", 6, {});
  room.addPlayer("sock", "Rimshi", 1);
  const bot = room.addBot(nextBotName(room));
  room.addBot(nextBotName(room));
  room.removeBot(bot.id);
  assert.equal(room.players.length, 2);
  assert.throws(() => room.removeBot("nope"), /No such bot/);

  room.addBot(nextBotName(room));
  room.start();
  assert.throws(() => room.removeBot(room.players.find((p) => p.isBot).id), /already started/);
});

test("a bot table plays a whole game to a finish", () => {
  const { room, steps } = playOut(3);
  assert.equal(room.status, "finished", `game stalled after ${steps} steps`);
  assert.ok(steps > 10, "a real game takes more than a handful of moves");
});

test("bots never accuse unless they are right", () => {
  // The brain only reports a solution it can justify, so a wrong accusation
  // would mean the deduction is unsound. Repeat for a spread of deals.
  for (let game = 0; game < 40; game++) {
    const { room } = playOut(3 + (game % 4));
    const wrong = room.log.filter((l) => l.type === "accusation" && /WRONG/.test(l.message));
    assert.equal(wrong.length, 0, `a bot guessed wrong: ${wrong[0]?.message}`);
    assert.ok(room.winnerId, "someone should have cracked it");
    const claim = room.lastAccusation;
    assert.equal(claim.correct, true);
    assert.deepEqual(
      { suspect: claim.suspect, weapon: claim.weapon, room: claim.room },
      room.solution,
      "the winning accusation must match the envelope exactly"
    );
  }
});

test("bots only ever show a card they actually hold", () => {
  for (let game = 0; game < 10; game++) {
    const { room } = playOut(4);
    // respondToSuggestion throws on a card you don't hold, so reaching a
    // finished state at all proves every show was legitimate; assert the
    // table really did exchange cards rather than passing throughout.
    const shows = room.facts.filter((f) => f.type === "show");
    assert.ok(shows.length > 0, "a four-hand deal should produce disproofs");
    for (const fact of shows) {
      assert.ok(room.players.some((p) => p.id === fact.playerId), "shown by a real seat");
    }
  }
});

test("the fact log carries only what the table witnessed", () => {
  const { room } = playOut(3);
  for (const fact of room.facts) {
    assert.ok(["show", "pass", "skip"].includes(fact.type));
    assert.deepEqual(Object.keys(fact).sort(), ["playerId", "suggestion", "type"]);
    // A "show" records who answered, never which card — that stays private.
    assert.equal(fact.card, undefined);
  }
});
