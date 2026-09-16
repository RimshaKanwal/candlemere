# Candlemere

A real-time multiplayer social deduction game for 3–8 players. Someone was
killed at Candlemere House. Move through the mansion, test theories against
the other detectives, and work out which suspect, weapon and room are sitting
in the envelope — before anyone else does.

Playable in the browser in either an illustrated 2D board or a walkable 3D
mansion, with computer-controlled detectives that deduce the solution from
nothing but what happens in public at the table.

> **Status:** personal project. The rules are an original take on the
> country-house murder-mystery genre, with its own board, cast and weapons —
> it is not affiliated with, or licensed by, any commercial board game.

---

## Contents

- [What's interesting here](#whats-interesting-here)
- [How the game plays](#how-the-game-plays)
- [Architecture](#architecture)
- [Running it locally](#running-it-locally)
- [Environment variables](#environment-variables)
- [Tests](#tests)
- [Deploying](#deploying)
- [Security notes](#security-notes)
- [Project layout](#project-layout)

---

## What's interesting here

Three parts of this were the actual engineering problem, rather than the
scaffolding around it.

### Bots that deduce instead of cheating

[`server/src/game/botBrain.js`](server/src/game/botBrain.js) never reads the
solution or anyone's hand. It sees exactly what a human at the table sees — who
passed, who disproved what — and maintains three kinds of knowledge:

| | |
|---|---|
| `holds` | card → the player confirmed to hold it |
| `lacks` | player → cards they definitely do not hold |
| `constraints` | "this player showed one of these three, we don't know which" |

Those are ground against each other to a fixed point on every new fact. Four
inference rules do the work: a card sits in exactly one hand; a
"showed one of three" collapses once two are ruled out; a hand with every card
accounted for can hold nothing else; and — the one that makes the rest cascade —
a *solved* category means that card is in the envelope, so no hand holds it,
which cracks open constraints elsewhere on the table.

A bot accuses only when all three categories resolve, so it can never win on a
guess it couldn't justify.

### Hidden information enforced by the server, not the UI

The entire game state lives on the server, and `toClientState(forPlayerId)`
serializes a *different* payload per recipient. Cards are only ever included
for the player who holds them; `yourMatches` (which of your cards could
disprove the current suggestion) reaches only the current responder; the
solution stays `null` until the game is over. Nothing secret is sent to a
client and hidden with CSS, so opening devtools reveals nothing.

### A hostile-client movement model

Free walking inside a room streams poses at up to 12.5 Hz, which is exactly the
kind of channel that invites forged input. Every pose is validated server-side
before it is relayed —
[`server/src/game/roomWalking.js`](server/src/game/roomWalking.js) checks seat
ownership, finite coordinates, that the player is really in the room they claim,
update frequency, and that the implied speed is physically possible for the time
elapsed. Walking is cosmetic and ephemeral: it is held in memory keyed off the
match, never written to an account, and discarded on room exit.

---

## How the game plays

**The cast.** Six suspects (Miss Carmine, Brigadier Ochre, Dowager Ivory,
Deacon Viridian, Baroness Indigo, Professor Mulberry) and six weapons
(Candelabra, Letter Opener, Fire Poker, Duelling Pistol, Silk Cord, Marble
Bust). Games of 7–8 players switch to an expanded set that adds two more of
each, so hands stay a sensible size.

**The house.** Nine rooms — Scullery, Salon, Glasshouse, Supper Room, Smoking
Room, Reading Room, Parlour, Foyer, Bureau — around an open field of corridor
squares, plus the Vaults and one more for larger games. Two pairs of rooms are
linked by secret passages: Scullery ↔ Bureau, and Parlour ↔ Glasshouse.

**A turn.** Roll (1–12), then walk. Corridor squares occupied by other
detectives block passage, so the board really does get crowded. Stopping in a
corridor ends your turn; reaching a room lets you *suggest* — naming a suspect,
a weapon and the room you're standing in. Each player in turn order must
disprove it if they can, privately, by showing you one matching card. What
everyone else learns is only *that* someone disproved it, which is precisely
the information the deduction game runs on.

**Accusing.** Once you're sure, accuse. Right, and the case closes and you win.
Wrong, and you're eliminated — but you must stay at the table and keep
disproving everyone else's suggestions, which is its own punishment. An
optional house rule lets anyone accuse at any time, not just on their turn.

**After.** Everyone's private notepad is revealed side by side, so you can see
exactly where each player's reasoning went right or wrong.

**Persistence.** Accounts track wins, games played, current and best streak,
and a title ladder (Rookie → Detective → Master Detective → Legend). There are
achievements for winning inside eight turns, winning without ever being shown a
card, and winning as the last detective standing — plus a "Menace" crown for
whoever holds the most all-time wrong accusations. You can also play as a guest,
in which case nothing is stored.

---

## Architecture

```
   Browser                          Node server                    Postgres
┌──────────────┐               ┌──────────────────────┐        ┌────────────┐
│ React 19     │   Socket.IO   │ GameManager          │        │ users      │
│              │ ◄───────────► │  └─ GameRoom (rules, │        │  wins      │
│ 2D board     │   (per-player │      hidden state)   │ ─────► │  streaks   │
│ 3D mansion   │    payloads)  │  └─ BotBrain         │        │  badges    │
│  (three.js)  │               │                      │        └────────────┘
│              │   REST/JWT    │ auth · rate limiting │
└──────────────┘ ◄───────────► └──────────────────────┘
```

**Server.** Node + Express + Socket.IO. `GameRoom` is a plain class holding all
the rules and secret state; it has no knowledge of sockets or the database,
which is what makes it directly testable. `GameManager` maps room codes to
rooms. Match state is in-memory by design — a match is short-lived and a
restart ending in-flight games is an acceptable trade for the simplicity.
Only durable player stats go to Postgres.

Every socket event carrying a seat action passes through a middleware that
checks the acting `playerId` matches the one bound to that socket, so a player
cannot act on anyone else's behalf by editing a payload.

**Client.** React 19 + Vite. The 3D layer is built from local geometry with
three.js — no model downloads or asset pipeline — and is lazy-loaded, so nobody
pays for three.js at the sign-in screen. It falls back to the 2D board if WebGL
is unavailable or the context is lost, respects `prefers-reduced-motion`, pauses
rendering in hidden tabs, and labels the canvas for screen readers. The
[3D module has its own README](client/src/components/mansion3d/README.md).

**Reconnection.** A disconnect marks the seat offline and starts an 8-second
grace period before the seat is freed, so a page reload doesn't cost you your
game. Returning players reclaim their seat by *account identity*, not by
retyping a name.

---

## Running it locally

Requires Node 20+ and a Postgres database.

```bash
git clone git@github.com:RimshaKanwal/candlemere.git
cd candlemere
```

**Server**

```bash
cd server
npm install
cp .env.example .env     # then fill in DATABASE_URL and JWT_SECRET
npm run dev              # http://localhost:4000
```

The schema is created on boot — there is no separate migration step.

**Client** (in a second terminal)

```bash
cd client
npm install
cp .env.example .env     # defaults to the local server
npm run dev              # http://localhost:5173
```

Open the client, sign in, create a game, and share the 5-character room code.
Three players minimum — add bots to fill the table.

---

## Environment variables

**Server** (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. |
| `JWT_SECRET` | in production | Signs session tokens. The server refuses to start in production without it. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `CLIENT_ORIGIN` | yes | Origin allowed to call the API and open sockets. Defaults to `http://localhost:5173`. |
| `NODE_ENV` | in production | Set to `production` to enable strict checks. |
| `PGSSLROOTCERT` | optional | Your provider's CA bundle, to verify the database's TLS certificate. |
| `PORT` | optional | Defaults to `4000`. |

**Client** (`client/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | yes | Where the game server lives. Defaults to `http://localhost:4000`. |

---

## Tests

```bash
cd server && npm test        # game rules, bot deduction, movement validation
cd client && npm run test:3d # 3D navigation and camera
```

36 tests, using the built-in Node test runner with no test framework
dependency. They cover the parts where being wrong is invisible until it
matters: the bot's inference rules (including that it never claims an answer it
cannot justify), server-side rejection of forged movement and seat spoofing,
and corridor pathfinding around other players and through secret passages.

---

## Deploying

[`render.yaml`](render.yaml) provisions the server and a Postgres instance on
Render, generating `JWT_SECRET` and wiring `DATABASE_URL` automatically. Set
`CLIENT_ORIGIN` to your deployed client URL.

The client is a static Vite build — [`client/vercel.json`](client/vercel.json)
configures SPA routing for Vercel. Set `VITE_SERVER_URL` in the project's
environment settings to point at the deployed server.

---

## Security notes

What this project does deliberately:

- **Server-authoritative state.** No secret is ever sent to a client that
  shouldn't have it. See [above](#hidden-information-enforced-by-the-server-not-the-ui).
- **Seat binding.** Socket middleware rejects any action whose `playerId`
  doesn't match the seat bound to that connection.
- **Input validation on every client-supplied value** that gets stored or
  rebroadcast — movement poses, room interactions, quick-chat reactions
  (allowlisted), and submitted notepads (glyph values only, cell count capped).
- **PINs are bcrypt-hashed**, never stored or logged in the clear.
- **Brute-force resistance.** Sign-in is rate-limited per IP, and a username
  locks out for 15 minutes after five wrong PINs — a 4-digit PIN is only 10,000
  guesses, so the throttle is what actually protects the account.
- **No secrets in the repository.** Both `.env.example` files document the
  shape; the real files are gitignored.

Known limitations, stated plainly:

- **A 4–6 digit PIN is weak authentication.** It suits a game leaderboard among
  friends and nothing more. Accounts hold no personal data beyond a display
  name and win counts.
- **Signing up and logging in are the same action** — the first person to use a
  username claims it. This means an attacker can learn whether a username is
  taken. Fixing it properly means a real signup flow, which is deliberately out
  of scope.
- **Rate limiting is per-process and in-memory.** Correct for a single
  instance; it would need a shared store behind more than one.
- **Sessions are JWTs in `localStorage`**, so there is no server-side
  revocation before the 30-day expiry.

---

## Project layout

```
server/
  src/
    index.js              Express + Socket.IO wiring, event handlers
    auth.js               accounts, PIN hashing, tokens, stat recording
    db.js                 Postgres pool and schema bootstrap
    rateLimit.js          in-memory rate limiter
    game/
      GameRoom.js         all rules and hidden state for one match
      gameManager.js      room code → GameRoom
      botBrain.js         constraint-propagation deduction engine
      constants.js        cast, weapons, board geometry
      roomWalking.js      validated ephemeral pose relay
      roomInteractions.js shared prop state (drawers, piano)

client/
  src/
    pages/                Home, SignIn, Lobby, Game, Leaderboard
    components/
      Mansion3D.jsx       3D view container
      mansion3d/          engine, camera, navigation, scenery
      Notepad.jsx         personal deduction sheet
      NotesReveal.jsx     end-of-game comparison
    socket.js  auth.js  sound.js  titles.js
```
