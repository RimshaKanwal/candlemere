import { useEffect, useRef, useState } from 'react';
import { createMansionEngine } from './mansion3d/engine';
import { ROOM_STORIES } from './mansion3d/scenery';
import './mansion3d/mansion3d.css';

const ART_ORDER = ['Kitchen','Ballroom','Conservatory','Dining Room','Billiard Room','Library','Lounge','Hall','Study','Cellar','Trophy Room'];

export default function Mansion3D(props) {
  const { board, players, playerId, currentPlayerId, canMove, reachableRoomSet, reachableCellSet, onMoveRoom, onMoveCell, onFallback } = props;
  const self = players.find(p => p.id === playerId);
  const [selected, setSelected] = useState(self?.position.room || null);
  const [cell, setCell] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState('orbit');
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [labels, setLabels] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [travelling, setTravelling] = useState(false);
  const host = useRef(null), labelLayer = useRef(null), engine = useRef(null), latest = useRef(props);
  const actions = useRef(null), section = useRef(null);
  latest.current = props;
  const roomNames = Object.keys(board.rooms);
  const story = ROOM_STORIES[selected];
  const here = selected && self?.position.room === selected;
  const canEnter = !!selected && canMove && reachableRoomSet.has(selected);
  const canWalk = !!cell && canMove && reachableCellSet.has(`${cell.r},${cell.c}`);
  const boardKey = JSON.stringify(board);

  function inspect(name) {
    if (view === 'walk' && name !== self?.position.room) { setView('orbit'); engine.current?.setView('orbit'); }
    setSelected(name); setCell(null);
    engine.current?.inspect(name);
    engine.current?.preview(null);
  }
  actions.current = {
    inspect,
    arrived(name) { setTravelling(false); inspect(name); },
    chooseCell(next) { setCell(next); setSelected(null); },
    failed() { setFailed(true); },
  };
  useEffect(() => {
    try {
      engine.current = createMansionEngine(host.current, labelLayer.current, board, latest.current, {
        inspect: name => actions.current.inspect(name),
        arrived: name => actions.current.arrived(name),
        chooseCell: next => actions.current.chooseCell(next),
        failed: () => actions.current.failed(),
      });
      setReady(true);
    } catch (error) {
      console.error('Unable to initialize mansion:', error);
      setFailed(true);
    }
    return () => { engine.current?.dispose(); engine.current = null; };
    // Geometry is stable across server broadcasts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardKey]);
  useEffect(() => {
    engine.current?.sync(latest.current);
    if (!canMove) { setCell(null); engine.current?.preview(null); }
  }, [players, playerId, currentPlayerId, canMove, reachableCellSet, reachableRoomSet]);
  useEffect(() => {
    if (!expanded) return;
    const previousFocus = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    section.current?.querySelector('button')?.focus({ preventScroll: true });
    const escape = event => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') setExpanded(false);
      if (event.key === 'Tab') {
        const buttons = [...section.current.querySelectorAll('button:not(:disabled)')].filter(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden');
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape); previousFocus?.focus({ preventScroll: true }); };
  }, [expanded]);
  useEffect(() => {
    const browser = section.current?.querySelector('.room-browser');
    const choice = browser?.querySelector('.selected');
    if (!choice) return;
    browser.scrollTo({ top: choice.offsetTop - browser.offsetTop - (browser.clientHeight - choice.clientHeight) / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [selected, expanded, roomsOpen]);
  useEffect(() => {
    if (!travelling) return;
    const timer = setTimeout(() => setTravelling(false), 4500);
    return () => clearTimeout(timer);
  }, [travelling]);

  function move() {
    if (canEnter) {
      const destination = selected;
      setTravelling(true); inspect(null); onMoveRoom(destination);
    } else if (canWalk) {
      onMoveCell(cell.r, cell.c); setCell(null); engine.current?.preview(null);
    }
  }
  function switchView(next) {
    if (next === 'walk') inspect(self?.position.room || null);
    setView(next); engine.current?.setView(next);
  }
  function myLocation() {
    const player = latest.current.players.find(p => p.id === latest.current.playerId);
    inspect(player?.position.room || null);
  }
  function changeRoom(direction) {
    const index = roomNames.indexOf(selected);
    inspect(roomNames[(index + direction + roomNames.length) % roomNames.length]);
  }
  const movementHint = travelling ? 'Walking to your destination…'
    : here ? 'You are here. Make a suggestion using the game controls.'
    : canEnter ? 'Reachable this turn. Enter to investigate.'
    : canWalk ? 'Route selected. Confirm to move your detective.'
    : canMove ? 'Choose a reachable room or a highlighted corridor square.'
    : self?.eliminated ? 'You can explore the mansion and still answer suggestions.'
    : currentPlayerId !== playerId ? 'Explore while the other detective takes their turn.'
    : 'Roll the dice to discover where you can move.';
  return (
    <section ref={section} className={`mansion-3d ${expanded ? 'is-expanded' : ''}`} aria-label="Mansion explorer">
      <header className="explorer-header">
        <div className="explorer-location">
          <span className="explorer-kicker">{selected ? story?.[0] : 'Choose your next lead'}</span>
          <h3>{selected || 'The mansion'}{here && <span className="location-pill">You are here</span>}</h3>
        </div>
        <div className="explorer-header-actions">
          <button aria-pressed={view === 'top'} onClick={() => switchView('top')}>Top view</button>
          <button aria-pressed={view === 'orbit'} onClick={() => switchView('orbit')}>3D view</button>
          <button aria-pressed={view === 'walk'} onClick={() => switchView('walk')}>Walk</button>
          <button aria-expanded={roomsOpen} onClick={() => setRoomsOpen(!roomsOpen)}>Rooms</button>
          {selected && <button onClick={() => inspect(null)} className="map-return">↖ Mansion map</button>}
          <button onClick={myLocation} title="Return to your detective’s location">My location</button>
          <button onClick={() => setExpanded(value => !value)} aria-label={expanded ? 'Exit expanded view' : 'Expand mansion view'} aria-pressed={expanded}>{expanded ? '↙' : '⛶'}</button>
        </div>
      </header>

      <div className="explorer-viewport">
        <div className="mansion-3d-canvas" ref={host} />
        <div ref={labelLayer} className="world-labels" aria-label="Rooms and detectives" />
        {!ready && !failed && <div className="scene-loading">Preparing the mansion…</div>}
        {failed && <div className="scene-loading"><p>The 3D view is unavailable.</p><button onClick={onFallback}>Continue with the illustrated board</button></div>}
        <div className="explorer-view-caption">{view === 'walk' ? 'CHARACTER VIEW' : view === 'top' ? 'TOP VIEW' : selected ? 'ROOM VIEW' : 'MANSION MAP'}<span>{view === 'walk' ? self?.position.room ? 'Arrow keys / WASD to walk · Drag to look' : 'Arrows to plan a route · Enter to move' : 'Scroll to zoom · Drag to orbit · Right-drag to pan'}</span></div>
        {selected && <div className="room-stepper"><button aria-label="Previous room" onClick={() => changeRoom(-1)}>←</button><span>{String(roomNames.indexOf(selected)+1).padStart(2,'0')} / {roomNames.length}</span><button aria-label="Next room" onClick={() => changeRoom(1)}>→</button></div>}
        <div className="explorer-camera" aria-label="Camera controls">
          <button aria-label="Rotate view left" onClick={() => engine.current?.rotate(-1)}>↶</button>
          <button aria-label="Zoom out" onClick={() => engine.current?.zoom(false)}>−</button>
          <button onClick={() => engine.current?.reset()} className="camera-reset">Reset view</button>
          <button aria-label="Zoom in" onClick={() => engine.current?.zoom(true)}>+</button>
          <button aria-label="Rotate view right" onClick={() => engine.current?.rotate(1)}>↷</button>
          {!selected && <button aria-pressed={labels} onClick={() => { setLabels(!labels); engine.current?.labels(!labels); }}>Names</button>}
        </div>
      </div>

      <nav hidden={!roomsOpen} className="room-browser" aria-label="Explore rooms">
        {roomNames.map(name => {
          const index = ART_ORDER.indexOf(name);
          const reachable = canMove && reachableRoomSet.has(name);
          const isHere = self?.position.room === name;
          return <button key={name} className={`room-choice ${selected === name ? 'selected' : ''}`} aria-pressed={selected === name} aria-label={`Explore ${name}`} onClick={() => inspect(name)}>
            <span className="room-choice-art" aria-hidden="true" style={{backgroundPosition:`${index%4*100/3}% ${Math.floor(index/4)*50}%`}} />
            <span className="room-choice-text"><b>{name}</b><small className={reachable ? 'reachable-text' : ''}>{isHere ? 'Your location' : reachable ? 'Reachable' : 'Look inside'}</small></span>
          </button>;
        })}
      </nav>
      {view === 'walk' && self?.position.room && <div className="walk-pad" aria-label="Walking controls">
        {[['ArrowUp','↑'],['ArrowLeft','←'],['ArrowDown','↓'],['ArrowRight','→']].map(([key,label]) => <button key={key} aria-label={`Walk ${key.slice(5).toLowerCase()}`} onPointerDown={event => {event.currentTarget.setPointerCapture(event.pointerId);engine.current?.input(key,true);}} onPointerUp={() => engine.current?.input(key,false)} onPointerCancel={() => engine.current?.input(key,false)} onLostPointerCapture={() => engine.current?.input(key,false)}>{label}</button>)}
      </div>}
      <footer className="explorer-actionbar" aria-live="polite">
        <div><strong>{travelling ? 'On your way' : selected || (cell ? 'A new direction' : 'Follow the evidence')}</strong><p>{movementHint}</p>
          {selected && board.rooms[selected]?.secretPassage && <small>Secret passage connects to {board.rooms[selected].secretPassage}</small>}
        </div>
        <button className="explorer-move" onClick={move} disabled={!(canEnter || canWalk) || travelling}>{canEnter ? `Enter ${selected} →` : canWalk ? 'Walk here →' : here ? 'You are here' : 'Choose a destination'}</button>
      </footer>
      {expanded && <div className="explorer-gamebar">
        <span aria-live="polite">{props.gameStatus}</span>
        <div className="cb-actions">{props.gameActions}<button className="cb-btn" onClick={() => setExpanded(false)}>Evidence & notes ↙</button></div>
      </div>}
    </section>
  );
}
