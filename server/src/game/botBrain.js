// A bot's private notepad.
//
// It knows three kinds of thing, and grinds them against each other until
// nothing new falls out:
//   holds       card -> the player confirmed to be holding it
//   lacks       player -> cards they definitely do NOT hold
//   constraints "this player showed one of these three, we don't know which"
//
// Everything a human could deduce from watching the table is derivable from
// those, so the bots play the same information game their opponents do —
// they never peek at the solution or at anyone's hand.

export class BotBrain {
  // hands: [{ id, handSize }] for every player at the table, including self.
  constructor(selfId, hands, cardSets, ownCards) {
    this.selfId = selfId;
    this.hands = hands;
    this.categories = {
      suspect: cardSets.suspects,
      weapon: cardSets.weapons,
      room: cardSets.rooms,
    };
    this.categoryOf = new Map();
    for (const [category, values] of Object.entries(this.categories)) {
      for (const value of values) this.categoryOf.set(value, category);
    }

    this.holds = new Map();
    this.lacks = new Map(hands.map((h) => [h.id, new Set()]));
    this.constraints = [];
    this.cursor = 0; // how far through the room's fact log we've read
    this.shownTo = new Map(); // player -> cards we've already flashed them

    for (const card of ownCards) this.holds.set(card.value, selfId);
    this.deduce();
  }

  lacksOf(playerId) {
    if (!this.lacks.has(playerId)) this.lacks.set(playerId, new Set());
    return this.lacks.get(playerId);
  }

  handSizeOf(playerId) {
    return this.hands.find((h) => h.id === playerId)?.handSize ?? 0;
  }

  // Public table talk, replayed from the room's fact log.
  observe(facts) {
    for (; this.cursor < facts.length; this.cursor++) {
      const fact = facts[this.cursor];
      const trio = fact.suggestion && [fact.suggestion.suspect, fact.suggestion.weapon, fact.suggestion.room];
      if (fact.type === "pass") {
        // They held none of the three — the strongest public fact there is.
        for (const card of trio) this.lacksOf(fact.playerId).add(card);
      } else if (fact.type === "show" && fact.playerId !== this.selfId) {
        // Someone disproved it. If we were the one asking we'll learn the
        // exact card privately; otherwise all we know is "one of these three".
        this.constraints.push({ playerId: fact.playerId, cards: trio });
      }
      // "skip" (a disconnected seat) proves nothing — they were never asked.
    }
    this.deduce();
  }

  // We suggested, and this player showed us this exact card.
  noteShownCard(playerId, card) {
    this.holds.set(card.value, playerId);
    this.deduce();
  }

  // We showed this card to that player, so showing it again costs us nothing.
  noteWeShowed(playerId, cardValue) {
    if (!this.shownTo.has(playerId)) this.shownTo.set(playerId, new Set());
    this.shownTo.get(playerId).add(cardValue);
  }

  deduce() {
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;

      // A card sits in exactly one hand, so nobody else can hold it.
      for (const [card, owner] of this.holds) {
        for (const hand of this.hands) {
          if (hand.id === owner || this.lacksOf(hand.id).has(card)) continue;
          this.lacksOf(hand.id).add(card);
          changed = true;
        }
      }

      // "Showed one of three" collapses once two are ruled out.
      this.constraints = this.constraints.filter((c) => !c.cards.some((card) => this.holds.get(card) === c.playerId));
      for (const constraint of this.constraints) {
        const live = constraint.cards.filter((card) => !this.lacksOf(constraint.playerId).has(card));
        if (live.length === 1 && this.holds.get(live[0]) !== constraint.playerId) {
          this.holds.set(live[0], constraint.playerId);
          changed = true;
        }
      }

      // A full hand accounted for means every other card is ruled out for them.
      for (const hand of this.hands) {
        let owned = 0;
        for (const owner of this.holds.values()) if (owner === hand.id) owned++;
        if (owned < hand.handSize) continue;
        for (const card of this.categoryOf.keys()) {
          if (this.holds.get(card) === hand.id || this.lacksOf(hand.id).has(card)) continue;
          this.lacksOf(hand.id).add(card);
          changed = true;
        }
      }

      // A solved category means that card is in the envelope, so no hand has
      // it — which is exactly the fact that cracks other constraints open.
      for (const category of Object.keys(this.categories)) {
        const answer = this.solved(category);
        if (!answer) continue;
        for (const hand of this.hands) {
          if (this.lacksOf(hand.id).has(answer)) continue;
          this.lacksOf(hand.id).add(answer);
          changed = true;
        }
      }

      if (!changed) return;
    }
  }

  // Cards in a category that could still be the answer.
  candidates(category) {
    return this.categories[category].filter((card) => !this.holds.has(card));
  }

  // The answer for a category, if it's the last one standing or if every
  // single hand has ruled it out.
  solved(category) {
    const live = this.candidates(category);
    if (live.length === 1) return live[0];
    return live.find((card) => this.hands.every((h) => this.lacksOf(h.id).has(card))) || null;
  }

  solution() {
    const suspect = this.solved("suspect");
    const weapon = this.solved("weapon");
    const room = this.solved("room");
    return suspect && weapon && room ? { suspect, weapon, room } : null;
  }

  // What to ask about. Candidates are already the cards whose owner we don't
  // know, so asking about one of those is what buys information; if a
  // category is fully solved, anything will do.
  pick(category, prefer = null) {
    const live = this.candidates(category);
    if (prefer && live.includes(prefer)) return prefer;
    const pool = live.length ? live : this.categories[category];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Showing the same card to the same person again leaks nothing new.
  chooseCardToShow(cards, askerId) {
    const seen = this.shownTo.get(askerId);
    return (seen && cards.find((c) => seen.has(c.value))) || cards[0];
  }
}
