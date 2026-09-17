import test from "node:test";
import assert from "node:assert/strict";
import { BotBrain } from "./botBrain.js";

const CARDS = {
  suspects: ["Miss Ruby", "Captain Gold", "Lady Pearl"],
  weapons: ["Candlestick", "Letter Opener", "Fire Poker"],
  rooms: ["Kitchen", "Music Room", "Greenhouse"],
};
const HANDS = [{ id: "me", handSize: 2 }, { id: "b", handSize: 2 }, { id: "c", handSize: 2 }];
const card = (type, value) => ({ type, value });

function brain(own) {
  return new BotBrain("me", HANDS, CARDS, own);
}

test("its own hand is ruled out for everyone else", () => {
  const b = brain([card("suspect", "Miss Ruby"), card("weapon", "Candlestick")]);
  assert.equal(b.holds.get("Miss Ruby"), "me");
  assert.ok(b.lacksOf("b").has("Miss Ruby"));
  assert.ok(b.lacksOf("c").has("Candlestick"));
  assert.deepEqual(b.candidates("suspect"), ["Captain Gold", "Lady Pearl"]);
});

test("a pass rules out all three cards for that player", () => {
  const b = brain([card("suspect", "Miss Ruby"), card("weapon", "Candlestick")]);
  b.observe([{ type: "pass", playerId: "b", suggestion: { suspect: "Captain Gold", weapon: "Letter Opener", room: "Music Room" } }]);
  for (const c of ["Captain Gold", "Letter Opener", "Music Room"]) assert.ok(b.lacksOf("b").has(c));
});

test("a showed-one-of-three collapses once the other two are ruled out", () => {
  const b = brain([card("suspect", "Miss Ruby"), card("weapon", "Candlestick")]);
  const trio = { suspect: "Captain Gold", weapon: "Letter Opener", room: "Music Room" };
  // The fact log only ever grows; the brain reads forward from its cursor.
  const log = [{ type: "show", playerId: "c", suggestion: trio }];
  b.observe(log);
  assert.equal(b.holds.get("Captain Gold"), undefined);
  // Later, c passes on two of those same cards — so the show must be the third.
  log.push({ type: "pass", playerId: "c", suggestion: { suspect: "Captain Gold", weapon: "Fire Poker", room: "Greenhouse" } });
  log.push({ type: "pass", playerId: "c", suggestion: { suspect: "Lady Pearl", weapon: "Letter Opener", room: "Greenhouse" } });
  b.observe(log);
  assert.equal(b.holds.get("Music Room"), "c");
});

test("a card nobody can hold is the answer", () => {
  const b = brain([card("suspect", "Miss Ruby"), card("weapon", "Candlestick")]);
  const trio = { suspect: "Captain Gold", weapon: "Letter Opener", room: "Music Room" };
  b.observe([
    { type: "pass", playerId: "b", suggestion: trio },
    { type: "pass", playerId: "c", suggestion: trio },
  ]);
  // We hold neither Gold nor the Letter Opener, and both opponents passed.
  assert.equal(b.solved("suspect"), "Captain Gold");
  assert.equal(b.solved("weapon"), "Letter Opener");
  assert.equal(b.solved("room"), "Music Room");
  assert.deepEqual(b.solution(), { suspect: "Captain Gold", weapon: "Letter Opener", room: "Music Room" });
});

test("a full hand rules out every other card for that player", () => {
  const b = brain([card("suspect", "Miss Ruby"), card("weapon", "Candlestick")]);
  b.noteShownCard("b", card("suspect", "Captain Gold"));
  b.noteShownCard("b", card("room", "Music Room"));
  // b's two cards are known, so b holds nothing else.
  assert.ok(b.lacksOf("b").has("Letter Opener"));
  assert.ok(b.lacksOf("b").has("Greenhouse"));
});

test("solving a category lets the envelope card crack other constraints", () => {
  const b = brain([card("suspect", "Miss Ruby"), card("room", "Kitchen")]);
  // Both opponents pass on Gold, so Gold is the answer (we hold Ruby,
  // leaving Pearl unaccounted — so this is not simply last-one-standing).
  const trio = { suspect: "Captain Gold", weapon: "Candlestick", room: "Music Room" };
  const log = [{ type: "pass", playerId: "b", suggestion: trio }, { type: "pass", playerId: "c", suggestion: trio }];
  b.observe(log);
  assert.equal(b.solved("suspect"), "Captain Gold");
  // c showed one of {Gold, Fire Poker, Greenhouse}. Gold is in the envelope
  // and we can rule out Greenhouse, so it has to be the Fire Poker.
  log.push({ type: "show", playerId: "c", suggestion: { suspect: "Captain Gold", weapon: "Fire Poker", room: "Greenhouse" } });
  b.observe(log);
  b.noteShownCard("b", card("room", "Greenhouse"));
  assert.equal(b.holds.get("Fire Poker"), "c");
});

test("it never claims an answer it cannot justify", () => {
  const b = brain([card("suspect", "Miss Ruby"), card("weapon", "Candlestick")]);
  assert.equal(b.solution(), null);
  b.observe([{ type: "show", playerId: "b", suggestion: { suspect: "Captain Gold", weapon: "Letter Opener", room: "Music Room" } }]);
  assert.equal(b.solution(), null);
});

test("a card is shown again to whoever already saw it", () => {
  const b = brain([card("suspect", "Miss Ruby"), card("weapon", "Candlestick")]);
  b.noteWeShowed("b", "Candlestick");
  const hand = [card("suspect", "Miss Ruby"), card("weapon", "Candlestick")];
  assert.equal(b.chooseCardToShow(hand, "b").value, "Candlestick");
  assert.equal(b.chooseCardToShow(hand, "c").value, "Miss Ruby");
});
