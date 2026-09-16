import pg from "pg";

const { Pool } = pg;

const CONNECTION_STRING = process.env.DATABASE_URL;
if (!CONNECTION_STRING) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(CONNECTION_STRING);

// Managed Postgres (Render, Heroku, Supabase) terminates TLS with a
// certificate the default trust store does not recognise, which is why
// `rejectUnauthorized: false` is the usual workaround — but it also disables
// the check that the server is who it claims to be. Set PGSSLROOTCERT to the
// provider's CA bundle to verify properly; the opt-out is explicit and warns.
function sslConfig() {
  if (isLocal) return false;
  if (process.env.PGSSLROOTCERT) return { rejectUnauthorized: true, ca: process.env.PGSSLROOTCERT };
  console.warn(
    "[db] Connecting over TLS without verifying the server certificate. " +
      "Set PGSSLROOTCERT to your provider's CA bundle to enable verification."
  );
  return { rejectUnauthorized: false };
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
