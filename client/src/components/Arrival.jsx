export default function Arrival({ children, lobby = false }) {
  return (
    <div className="arrival">
      <section className="arrival-story">
        <span className="eyebrow"><span className="live-spark" /> A very suspicious evening</span>
        <h2>Good company.<br />Terrible <em>secrets.</em></h2>
        <p>The doors are locked. The alibis are questionable.<br />Welcome to the mansion. Trust your instincts.<br />And absolutely none of your friends.</p>
        <div className="arrival-details"><span>3–8 detectives</span><i /> <span>One hidden truth</span><i /><span>Endless suspicion</span></div>
        <div className="invitation"><span className="invitation-seal">C</span><div><span className="eyebrow">Your invitation awaits</span><p>{lobby ? "The guests are arriving. Someone knows something." : "A classic mystery. A rather untrustworthy guest list."}</p></div></div>
      </section>
      <section className="arrival-panel">{children}</section>
      <div className="arrival-caption">THE MANSION AT MIDNIGHT <span>Est. 1949 · An evening of deduction</span></div>
    </div>
  );
}
