// Computer detectives, so a solo player still gets a full table.
//
// A bot is an ordinary seat with no socket behind it. Everything it decides
// comes out of its BotBrain, which only ever sees what the table saw — the
// bots do not read the solution or anyone's hand.

import { BotBrain } from "./botBrain.js";
import { getCardSets, SECRET_PASSAGES } from "./constants.js";

// House guests, not suspects — a bot should never share a name with a card.
const BOT_NAMES = [
  "Inspector Vane",
  "Constable Ash",
  "Sergeant Quill",
  "Nurse Thimble",
  "Mr. Blackwood",
  "Miss Hollow",
  "Captain Frost",
];

export function nextBotName(room) {
  const taken = new Set(room.players.map((p) => p.name));
  return BOT_NAMES.find((n) => !taken.has(n)) || `Detective ${room.players.length + 1}`;
}

// Hands are dealt in start(), so brains can only be built afterwards.
export function primeBots(room) {
  const hands = room.players.map((p) => ({ id: p.id, handSize: p.cards.length }));
  const cardSets = getCardSets(room.players.length);
  for (const player of room.players) {
    if (player.isBot) player.brain = new BotBrain(player.id, hands, cardSets, player.cards);
  }
}

const manhattan = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

// Where to walk. If we already know the answer, any room will do — we just
// need to be standing in one to accuse. Otherwise head for a room whose card
// we haven't accounted for yet.
function decideMove(room, bot) {
  const { cells, rooms } = room.computeReachable(bot, room.turnState.diceValue);
  const solved = !!bot.brain.solution();
  const wanted = new Set(bot.brain.candidates("room"));

  if (rooms.length) {
    const target = solved ? rooms[0] : rooms.find((name) => wanted.has(name)) || rooms[0];
    return { room: target };
  }
  if (!cells.length) return null;

  // No door in reach, so close the distance to somewhere worth being.
  const goals = [];
  for (const [name, def] of Object.entries(room.board.rooms)) {
    if (!solved && !wanted.has(name)) continue;
    goals.push(...def.entryCells);
  }
  if (!goals.length) return { cell: cells[Math.floor(Math.random() * cells.length)] };
  let best = cells[0];
  let bestScore = Infinity;
  for (const cell of cells) {
    const score = Math.min(...goals.map((g) => manhattan(cell, g)));
    if (score < bestScore) {
      bestScore = score;
      best = cell;
    }
  }
  return { cell: best };
}

// One visible beat of a bot's turn. Returns true if it did something, so the
// caller knows to broadcast and come back for the next beat.
export function botStep(room, bot, deliverReveal) {
  bot.brain.observe(room.facts);

  // Answering someone else's suggestion — this happens even when eliminated.
  const pending = room.pendingSuggestion;
  if (pending) {
    if (pending.responderOrder[pending.index] !== bot.id) return false;
    const matches = room.cardsMatchingSuggestion(bot, pending.suggestion);
    if (!matches.length) {
      deliverReveal(room, room.respondToSuggestion(bot.id, { action: "pass" })?.privateReveal);
      return true;
    }
    const card = bot.brain.chooseCardToShow(matches, pending.by);
    bot.brain.noteWeShowed(pending.by, card.value);
    deliverReveal(room, room.respondToSuggestion(bot.id, { action: "show", cardValue: card.value })?.privateReveal);
    return true;
  }

  if (room.currentPlayerId !== bot.id || bot.eliminated) return false;
  const { diceValue, hasMoved, hasSuggested } = room.turnState;
  const answer = bot.brain.solution();

  // Certain, and standing in a room: say so and end the game.
  if (answer && bot.position.room) {
    room.makeAccusation(bot.id, answer);
    return true;
  }

  if (!hasMoved && bot.position.room) {
    // A passage is a free ride to a room we still care about.
    const exit = SECRET_PASSAGES[bot.position.room];
    if (exit && (answer || bot.brain.candidates("room").includes(exit))) {
      room.useSecretPassage(bot.id);
      return true;
    }
  }
  if (!hasMoved && diceValue == null) {
    room.rollDice(bot.id);
    return true;
  }
  if (!hasMoved) {
    const target = decideMove(room, bot);
    // Nowhere to go (boxed in): give up the turn rather than stall the table.
    if (!target) {
      room.endTurn(bot.id);
      return true;
    }
    room.moveTo(bot.id, target);
    return true;
  }
  if (bot.position.room && !hasSuggested) {
    deliverReveal(
      room,
      room.makeSuggestion(bot.id, {
        suspect: bot.brain.pick("suspect"),
        weapon: bot.brain.pick("weapon"),
        room: bot.position.room,
      })?.privateReveal
    );
    return true;
  }
  room.endTurn(bot.id);
  return true;
}

// Drives every bot in every room. One pending timer per room, so a burst of
// state changes can't stack up duplicate turns.
export function createBotRunner({ getRoom, broadcast, deliverReveal, pace = 900 }) {
  const timers = new Map();

  function cancel(code) {
    const timer = timers.get(code);
    if (timer) clearTimeout(timer);
    timers.delete(code);
  }

  function whoseMove(room) {
    if (room.status !== "playing") return null;
    const pending = room.pendingSuggestion;
    if (pending) {
      const responder = room.players.find((p) => p.id === pending.responderOrder[pending.index]);
      return responder?.isBot ? responder : null; // otherwise a human owes an answer
    }
    const current = room.currentPlayer();
    return current?.isBot && !current.eliminated ? current : null;
  }

  function schedule(code) {
    cancel(code);
    const room = getRoom(code);
    if (!room) return;
    const bot = whoseMove(room);
    if (!bot || !bot.brain) return;
    const delay = room.pendingSuggestion ? Math.round(pace * 0.6) : pace;
    timers.set(
      code,
      setTimeout(() => {
        timers.delete(code);
        const live = getRoom(code);
        if (!live) return;
        const actor = whoseMove(live);
        if (!actor?.brain) return;
        try {
          if (!botStep(live, actor, deliverReveal)) return;
        } catch (err) {
          // A bot must never wedge the table. Drop its turn and carry on.
          console.error(`[bot] ${actor.name} in ${code}:`, err.message);
          try {
            if (live.currentPlayerId === actor.id && !live.pendingSuggestion) live.endTurn(actor.id);
          } catch { /* already moved on */ }
        }
        broadcast(code);
        schedule(code);
      }, delay)
    );
  }

  return { schedule, cancel, primeBots };
}
