import { useEffect, useRef } from "react";

export default function CaseBriefing({ onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="case-briefing" onCancel={onClose} onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
      <div className="briefing-art"><span className="eyebrow">Confidential · Case file 001</span><button className="briefing-close" onClick={onClose} aria-label="Close case briefing">×</button></div>
      <div className="briefing-content">
        <span className="eyebrow">The mansion at midnight</span>
        <h2>Someone here<br /><em>knows too much.</em></h2>
        <p>A storm has cut off the estate. A murder has shattered the evening. Hidden in the case file: one suspect, one weapon, one room. Find all three before your friends do.</p>
        <ol className="briefing-steps"><li><b>Explore</b><span>Roll the dice and enter a room.</span></li><li><b>Investigate</b><span>Suggest a suspect and weapon. Watch who can disprove it.</span></li><li><b>Connect the clues</b><span>Mark your notes. Accuse when you’re certain—a wrong accusation eliminates you.</span></li></ol>
        <button className="primary" onClick={onClose} autoFocus>Let the investigation begin <span>→</span></button>
        <small>Your character is your playing piece. Anyone can be the culprit.</small>
      </div>
    </dialog>
  );
}
