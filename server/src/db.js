import { readFileSync } from "node:fs";
import pg from "pg";

const { Pool } = pg;

const CONNECTION_STRING = process.env.DATABASE_URL;
if (!CONNECTION_STRING) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(CONNECTION_STRING);

// Remote Postgres is always reached over TLS, and the certificate is actually
// verified: Neon (like most managed providers now) presents a certificate from
// a public CA, which Node's own trust store already recognises. A provider that
// uses a private CA can supply its bundle via PGSSLROOTCERT — that is a *path*,
// as libpq defines it, so the file is read rather than passed through. If a
// certificate cannot be verified the connection fails rather than silently
// falling back to an unauthenticated one.
function sslConfig() {
  if (isLocal) return false;
  if (process.env.PGSSLROOTCERT) {
    return { rejectUnauthorized: true, ca: readFileSync(process.env.PGSSLROOTCERT, "utf8") };
  }
  return { rejectUnauthorized: true };
}

export const pool = new Pool({
  connectionString: CONNECTION_STRING,
  ssl: sslConfig(),
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      games_played INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Added for achievements/streaks — ALTER (not part of the CREATE above) so
  // this fills in the columns on databases that already had a users table
  // from before this feature existed.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS best_streak INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS wrong_accusations INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS sherlock_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS untouchable_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS comeback_count INTEGER NOT NULL DEFAULT 0;
  `);
}
