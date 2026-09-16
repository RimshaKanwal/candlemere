import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

// Tokens are only as trustworthy as this key: anyone holding it can mint a
// valid session for any account. A checked-in fallback would therefore be a
// master key to every account on a deployed server, so production must supply
// its own and the process refuses to start without one.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
if (!process.env.JWT_SECRET && IS_PRODUCTION) {
  throw new Error(
    "JWT_SECRET is not set. Refusing to start with a guessable signing key — " +
      "generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
  );
}
if (!process.env.JWT_SECRET) {
  console.warn("[auth] JWT_SECRET is not set — falling back to an insecure development key.");
}
const JWT_SECRET = process.env.JWT_SECRET || "insecure-development-key";
const USERNAME_RE = /^[a-zA-Z0-9 _-]{2,20}$/;

// A 4-digit PIN is only 10,000 guesses, so what actually protects an account
// is the cost of guessing, not the PIN itself. Failures are counted per
// username and lock that name out for a while once they pile up. This is
// per-process and in-memory, like the rate limiter — see rateLimit.js.
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const pinFailures = new Map(); // username key -> { count, until }

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of pinFailures) {
    if (record.until <= now && record.count === 0) pinFailures.delete(key);
  }
}, LOCKOUT_MS).unref();

function assertNotLockedOut(key) {
  const record = pinFailures.get(key);
  if (!record || record.until <= Date.now()) return;
  const minutes = Math.ceil((record.until - Date.now()) / 60000);
  throw new Error(`Too many wrong PINs for that username. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
}

function notePinFailure(key) {
  const record = pinFailures.get(key) ?? { count: 0, until: 0 };
  record.count += 1;
  if (record.count >= MAX_PIN_ATTEMPTS) {
    record.until = Date.now() + LOCKOUT_MS;
    record.count = 0; // the lockout replaces the tally until it expires
  }
  pinFailures.set(key, record);
}

function toPublicUser(row) {
  return {
    userId: row.id,
    username: row.display_name,
    wins: row.wins,
    gamesPlayed: row.games_played,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    wrongAccusations: row.wrong_accusations,
    sherlockCount: row.sherlock_count,
    untouchableCount: row.untouchable_count,
    comebackCount: row.comeback_count,
  };
}

function issueToken(row) {
  return jwt.sign({ userId: row.id, username: row.display_name }, JWT_SECRET, { expiresIn: "30d" });
}

// Creates the account on first use, or verifies the PIN against an existing
// one. There's no separate signup step — the first person to use a name
// claims it with whatever PIN they typed.
export async function registerOrLogin(username, pin) {
  const trimmedName = (username || "").trim();
  const trimmedPin = (pin || "").trim();
  if (!USERNAME_RE.test(trimmedName)) {
    throw new Error("Username must be 2-20 characters (letters, numbers, spaces, - or _)");
  }
  if (!/^\d{4,6}$/.test(trimmedPin)) {
    throw new Error("PIN must be 4-6 digits");
  }
  const key = trimmedName.toLowerCase();

  assertNotLockedOut(key);

  const existing = await pool.query("SELECT * FROM users WHERE username = $1", [key]);
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const ok = await bcrypt.compare(trimmedPin, row.pin_hash);
    if (!ok) {
      notePinFailure(key);
      throw new Error("Wrong PIN for that username");
    }
    pinFailures.delete(key);
    return { token: issueToken(row), user: toPublicUser(row) };
  }

  const pinHash = await bcrypt.hash(trimmedPin, 10);
  const inserted = await pool.query(
    "INSERT INTO users (username, display_name, pin_hash) VALUES ($1, $2, $3) RETURNING *",
    [key, trimmedName, pinHash]
  );
  const row = inserted.rows[0];
  return { token: issueToken(row), user: toPublicUser(row) };
}

// Guest identities are signed but never inserted into the accounts database.
export function createGuest(username) {
  const name = typeof username === "string" ? username.trim() : "";
  if (!USERNAME_RE.test(name)) throw new Error("Name must be 2-20 characters (letters, numbers, spaces, - or _)");
  const user = { userId: null, username: name, isGuest: true, guestId: randomUUID() };
  return { token: jwt.sign(user, JWT_SECRET, { expiresIn: "12h" }), ...user };
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // throws if invalid/expired
}

export async function getUserById(userId) {
  const res = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  if (res.rows.length === 0) throw new Error("Account no longer exists");
  return toPublicUser(res.rows[0]);
}

export async function getLeaderboard(limit = 50) {
  const res = await pool.query(
    `SELECT display_name, wins, games_played, current_streak, best_streak
     FROM users
     WHERE games_played > 0
     ORDER BY wins DESC, (wins::float / GREATEST(games_played, 1)) DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows.map((r) => ({
    username: r.display_name,
    wins: r.wins,
    gamesPlayed: r.games_played,
    winRate: r.games_played > 0 ? r.wins / r.games_played : 0,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
  }));
}

// Whoever currently holds the most all-time wrong accusations — a moving
// "crown" rather than a per-game unlock, since a player can only go wrong
// once per game before being eliminated.
export async function getMenace() {
  const res = await pool.query(
    `SELECT display_name, wrong_accusations FROM users WHERE wrong_accusations > 0
     ORDER BY wrong_accusations DESC LIMIT 1`
  );
  if (res.rows.length === 0) return null;
  return { username: res.rows[0].display_name, wrongAccusations: res.rows[0].wrong_accusations };
}

// Called once per finished game.
// - participantUserIds: everyone who played (games_played += 1 for all).
// - wrongUserIds: subset who made a wrong accusation this game.
// - winnerUserId: nullable — null means nobody solved it.
// - winnerAchievements: { sherlock, untouchable, comeback } booleans, only
//   meaningful when there's a winner.
export async function recordGameResult(participantUserIds, wrongUserIds, winnerUserId, winnerAchievements = {}) {
  if (participantUserIds.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const userId of participantUserIds) {
      if (userId === winnerUserId) {
        await client.query(
          `UPDATE users SET
             wins = wins + 1,
             games_played = games_played + 1,
             current_streak = current_streak + 1,
             best_streak = GREATEST(best_streak, current_streak + 1),
             sherlock_count = sherlock_count + $2,
             untouchable_count = untouchable_count + $3,
             comeback_count = comeback_count + $4
           WHERE id = $1`,
          [userId, winnerAchievements.sherlock ? 1 : 0, winnerAchievements.untouchable ? 1 : 0, winnerAchievements.comeback ? 1 : 0]
        );
      } else {
        await client.query(
          "UPDATE users SET games_played = games_played + 1, current_streak = 0 WHERE id = $1",
          [userId]
        );
      }
    }
    for (const userId of wrongUserIds) {
      await client.query("UPDATE users SET wrong_accusations = wrong_accusations + 1 WHERE id = $1", [userId]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
