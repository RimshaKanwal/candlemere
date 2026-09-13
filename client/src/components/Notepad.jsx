import { gameStorage } from "../auth";
import { useEffect, useRef, useState } from "react";

// Scoped per room code so a new game starts with a blank sheet instead of
// carrying over the previous game's markings — it was a single fixed key
// before, so every game shared (and polluted) the same notes forever.
export function notepadStorageKey(code) {
  return `cluedo-notepad-${code}`;
}
export const NOTEPAD_GLYPH = { x: "✕", check: "✓", "?": "?" };
const MARKS = [undefined, "x", "check", "?"]; // click cycles through these

const SECTIONS = [
  ["suspects", "Suspects"],
  ["weapons", "Weapons"],
  ["rooms", "Rooms"],
];

// The sheet runs to 31 rows at 8 players but the drawer is short, so size the
// card rows to whatever is left after the column header and the section bands.
// Scrolling a deduction grid is the one thing it must not do — you read it by
// comparing rows against each other, which only works if they're all in view.
function useFitRows(scrollRef, cardRowCount) {
  const [rowH, setRowH] = useState(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !cardRowCount) return;
    const measure = () => {
      const table = el.querySelector(".notepad-table");
      if (!table) return;
      // Neither the header nor the bands scale with the card rows, so this
      // measures once and settles — no feedback loop through the observer.
      const head = table.tHead?.offsetHeight || 0;
      const bands = [...table.querySelectorAll(".notepad-section-row")].reduce((sum, r) => sum + r.offsetHeight, 0);
      const avail = el.clientHeight - head - bands;
      setRowH(Math.max(12, Math.min(26, Math.floor(avail / cardRowCount) - 1)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef, cardRowCount]);
  return rowH;
}

// Detective sheet: rows are the cards (suspects, weapons, rooms), columns are
// the players. Mark each cell as you deduce who holds a card, and click a card
// name to cross the whole card off (ruled out) or star it (in the envelope).
export default function Notepad({ cardSets, players, selfId, code }) {
  const scrollRef = useRef(null);
  const storageKey = notepadStorageKey(code);
  const [marks, setMarks] = useState(() => {
    try {
      return JSON.parse(gameStorage().getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      setMarks(JSON.parse(gameStorage().getItem(storageKey) || "{}"));
    } catch {
      setMarks({});
    }
  }, [storageKey]);

  useEffect(() => {
    gameStorage().setItem(storageKey, JSON.stringify(marks));
  }, [marks, storageKey]);

  function cycle(key) {
    setMarks((prev) => {
      const next = MARKS[(MARKS.indexOf(prev[key]) + 1) % MARKS.length];
      const copy = { ...prev };
      if (next === undefined) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  }

  const cardRowCount = SECTIONS.reduce((n, [key]) => n + (cardSets[key]?.length || 0), 0);
  const rowH = useFitRows(scrollRef, cardRowCount);

  return (
    <div className="notepad" style={rowH ? { "--np-row": `${rowH}px` } : undefined}>
      <p className="notepad-legend">Tap names to rule out ✕ / star ✓ · cells = per-player</p>
      <div className="notepad-scroll" ref={scrollRef}>
        <table className="notepad-table">
          <thead>
            <tr>
              <th className="notepad-rowhead" />
              {players.map((p) => (
                <th key={p.id} className="notepad-colhead" title={p.name}>
                  {p.name}
                  {p.id === selfId && <span className="you-tag">YOU</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(([key, label]) => (
              <FragmentSection
                key={key}
                label={label}
                items={cardSets[key]}
                players={players}
                marks={marks}
                onCycle={cycle}
                sectionKey={key}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentSection({ label, items, players, marks, onCycle, sectionKey }) {
  return (
    <>
      <tr className="notepad-section-row">
        <td className="notepad-section-label" colSpan={players.length + 1}>{label}</td>
      </tr>
      {items.map((item) => {
        const nameKey = `name:${sectionKey}:${item}`;
        const nameMark = marks[nameKey];
        return (
          <tr key={item} className={nameMark === "x" ? "row-ruledout" : ""}>
            <td className="notepad-rowhead">
              <button
                className={`rowname-btn rowname-${nameMark || "none"}`}
                onClick={() => onCycle(nameKey)}
                title="Rule out / star this card"
              >
                {item}
                {nameMark === "check" && " ⭐"}
              </button>
            </td>
            {players.map((p) => {
              const cellKey = `${sectionKey}:${item}:${p.id}`;
              const mark = marks[cellKey];
              return (
                <td key={p.id} className="notepad-td">
                  <button className={`notepad-cell mark-${mark || "none"}`} onClick={() => onCycle(cellKey)}>
                    {mark ? NOTEPAD_GLYPH[mark] : ""}
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
