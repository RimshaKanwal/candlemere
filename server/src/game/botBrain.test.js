import test from "node:test";
import assert from "node:assert/strict";
import { BotBrain } from "./botBrain.js";

const CARDS = {
  suspects: ["Miss Carmine", "Brigadier Ochre", "Dowager Ivory"],
  weapons: ["Candelabra", "Letter Opener", "Fire Poker"],
  rooms: ["Scullery", "Salon", "Glasshouse"],
};
const HANDS = [{ id: "me", handSize: 2 }, { id: "b", handSize: 2 }, { id: "c", handSize: 2 }];
const card = (type, value) => ({ type, value });

function brain(own) {
  return new BotBrain("me", HANDS, CARDS, own);
}

test("its own hand is ruled out for everyone else", () => {
  const b = brain([card("suspect", "Miss Carmine"), card("weapon", "Candelabra")]);
  assert.equal(b.holds.get("Miss Carmine"), "me");
  assert.ok(b.lacksOf("b").has("Miss Carmine"));
  assert.ok(b.lacksOf("c").has("Candelabra"));
  assert.deepEqual(b.candidates("suspect"), ["Brigadier Ochre", "Dowager Ivory"]);
});

test("a pass rules out all three cards for that player", () => {
  const b = brain([card("suspect", "Miss Carmine"), card("weapon", "Candelabra")]);
  b.observe([{ type: "pass", playerId: "b", suggestion: { suspect: "Brigadier Ochre", weapon: "Letter Opener", room: "Salon" } }]);
  for (const c of ["Brigadier Ochre", "Letter Opener", "Salon"]) assert.ok(b.lacksOf("b").has(c));
});

test("a showed-one-of-three collapses once the other two are ruled out", () => {
  const b = brain([card("suspect", "Miss Carmine"), card("weapon", "Candelabra")]);
  const trio = { suspect: "Brigadier Ochre", weapon: "Letter Opener", room: "Salon" };
  // The fact log only ever grows; the brain reads forward from its cursor.
  const log = [{ type: "show", playerId: "c", suggestion: trio }];
  b.observe(log);
  assert.equal(b.holds.get("Brigadier Ochre"), undefined);
  // Later, c passes on two of those same cards — so the show must be the third.
  log.push({ type: "pass", playerId: "c", suggestion: { suspect: "Brigadier Ochre", weapon: "Fire Poker", room: "Glasshouse" } });
  log.push({ type: "pass", playerId: "c", suggestion: { suspect: "Dowager Ivory", weapon: "Letter Opener", room: "Glasshouse" } });
  b.observe(log);
  assert.equal(b.holds.get("Salon"), "c");
});

test("a card nobody can hold is the answer", () => {
  const b = brain([card("suspect", "Miss Carmine"), card("weapon", "Candelabra")]);
  const trio = { suspect: "Brigadier Ochre", weapon: "Letter Opener", room: "Salon" };
  b.observe([
    { type: "pass", playerId: "b", suggestion: trio },
    { type: "pass", playerId: "c", suggestion: trio },
  ]);
  // We hold neither Ochre nor the Letter Opener, and both opponents passed.
  assert.equal(b.solved("suspect"), "Brigadier Ochre");
  assert.equal(b.solved("weapon"), "Letter Opener");
  assert.equal(b.solved("room"), "Salon");
  assert.deepEqual(b.solution(), { suspect: "Brigadier Ochre", weapon: "Letter Opener", room: "Salon" });
});

test("a full hand rules out every other card for that player", () => {
  const b = brain([card("suspect", "Miss Carmine"), card("weapon", "Candelabra")]);
  b.noteShownCard("b", card("suspect", "Brigadier Ochre"));
  b.noteShownCard("b", card("room", "Salon"));
  // b's two cards are known, so b holds nothing else.
  assert.ok(b.lacksOf("b").has("Letter Opener"));
  assert.ok(b.lacksOf("b").has("Glasshouse"));
});

test("solving a category lets the envelope card crack other constraints", () => {
  const b = brain([card("suspect", "Miss Carmine"), card("room", "Scullery")]);
  // Both opponents pass on Ochre, so Ochre is the answer (we hold Carmine,
  // leaving Ivory unaccounted — so this is not simply last-one-standing).
  const trio = { suspect: "Brigadier Ochre", weapon: "Candelabra", room: "Salon" };
  const log = [{ type: "pass", playerId: "b", suggestion: trio }, { type: "pass", playerId: "c", suggestion: trio }];
  b.observe(log);
  assert.equal(b.solved("suspect"), "Brigadier Ochre");
  // c showed one of {Ochre, Fire Poker, Glasshouse}. Ochre is in the envelope
  // and we can rule out Glasshouse, so it has to be the Fire Poker.
  log.push({ type: "show", playerId: "c", suggestion: { suspect: "Brigadier Ochre", weapon: "Fire Poker", room: "Glasshouse" } });
  b.observe(log);
  b.noteShownCard("b", card("room", "Glasshouse"));
  assert.equal(b.holds.get("Fire Poker"), "c");
});

test("it never claims an answer it cannot justify", () => {
  const b = brain([card("suspect", "Miss Carmine"), card("weapon", "Candelabra")]);
  assert.equal(b.solution(), null);
  b.observe([{ type: "show", playerId: "b", suggestion: { suspect: "Brigadier Ochre", weapon: "Letter Opener", room: "Salon" } }]);
  assert.equal(b.solution(), null);
});

test("a card is shown again to whoever already saw it", () => {
  const b = brain([card("suspect", "Miss Carmine"), card("weapon", "Candelabra")]);
  b.noteWeShowed("b", "Candelabra");
  const hand = [card("suspect", "Miss Carmine"), card("weapon", "Candelabra")];
  assert.equal(b.chooseCardToShow(hand, "b").value, "Candelabra");
  assert.equal(b.chooseCardToShow(hand, "c").value, "Miss Carmine");
});
