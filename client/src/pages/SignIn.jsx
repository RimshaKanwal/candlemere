import { useState } from "react";
import { signIn, enterAsGuest } from "../auth";

export default function SignIn({ onSignedIn }) {
  const [guest, setGuest] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await (guest ? enterAsGuest(username) : signIn(username, pin));
      onSignedIn(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card home-card">
      <span className="eyebrow">The guest book</span>
      <h2>Make an entrance.</h2>
      <div className="tabs">
        <button className={`tab ${!guest ? "active" : ""}`} onClick={() => { setGuest(false); setError(null); }}>Sign in</button>
        <button className={`tab ${guest ? "active" : ""}`} onClick={() => { setGuest(true); setError(null); }}>Play as guest</button>
      </div>
      <p className="hint">
        {guest ? "Just a name. No account, saved stats, or leaderboard entry. Your session and notes disappear when you refresh or close this page." : "Pick a username and a PIN. First time using that name creates the account; after that, the same PIN signs you back in — on any device."}
      </p>
      <form onSubmit={handleSubmit} className="form">
        <label>
          {guest ? "Guest name" : "Username"}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your detective name"
            autoComplete="username"
            maxLength={20}
            required
          />
        </label>
        {!guest && <label>
          PIN (4-6 digits)
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Your secret PIN"
            type="password"
            minLength={4}
            autoComplete="current-password"
            inputMode="numeric"
            maxLength={6}
            required
          />
        </label>}
        {error && <p className="hint" style={{ color: "#ff8a80" }}>{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Signing in…" : guest ? "Continue as guest →" : "Enter the mansion →"}
        </button>
      </form>
    </div>
  );
}
