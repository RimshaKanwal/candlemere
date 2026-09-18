import { audioLevels, setAudioLevel } from '../sound';
import { reachableDoorway } from './mansion3d/navigation';
import { socket } from '../socket';
import { useEffect, useRef, useState } from 'react';
import { createMansionEngine } from './mansion3d/engine';
import { ROOM_STORIES } from './mansion3d/scenery';
import { displayName } from '../displayNames';
import './mansion3d/mansion3d.css';

const ART_ORDER = ['Kitchen','Music Room','Greenhouse','Dining Room','Game Room','Library','Sitting Room','Entrance Hall','Office','Wine Cellar','Trophy Room'];

export default function Mansion3D(props) {
  const { board, players, playerId, currentPlayerId, canMove, reachableRoomSet, reachableCellSet, onMoveRoom, onMoveCell, onFallback } = props;
  const self = players.find(p => p.id === playerId);
  const [selected, setSelected] = useState(self?.position.room || null);
  const [cell, setCell] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState('orbit');
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [labels, setLabels] = useState(true);
  const [playerNames, setPlayerNames] = useState(true);
  const [objects, setObjects] = useState([]);
  const [discovery, setDiscovery] = useState(null);
  const [levels, setLevels] = useState(audioLevels);
  const [activity, setActivity] = useState(null);
  const [passage, setPassage] = useState(null);
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
  const doorway = view === 'walk' && canMove ? reachableDoorway(board, cell || self?.position.cell, reachableRoomSet) : null;
  const boardKey = JSON.stringify(board);

  function inspect(name) {
    if (view === 'walk' && name !== self?.position.room) { setView('orbit'); engine.current?.setView('orbit'); }
    setSelected(name); setCell(null);setDiscovery(null);
    engine.current?.inspect(name);
    engine.current?.preview(null);
  }
  actions.current = {
    inspect,
    arrived(name) { setTravelling(false); inspect(name);setView('walk');setRoomsOpen(false);engine.current?.setView('walk'); },
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
        objects: setObjects,
        discovery: setDiscovery,
        activity: setActivity,
        interact: object => socket.emit('roomInteraction', { ...object, code:latest.current.code, playerId:latest.current.playerId }),
        passage: setPassage,
        walk: pose => socket.volatile.emit('roomWalk', { ...pose, code: latest.current.code, playerId: latest.current.playerId }),
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
    if(!canMove || !ready)return;
    const room=latest.current.players.find(player=>player.id===latest.current.playerId)?.position.room || null;
    setSelected(room);setView('walk');setRoomsOpen(false);
    engine.current?.inspect(room);engine.current?.setView('walk');
  }, [canMove, ready]);
  useEffect(() => {
    const receive = pose => engine.current?.receiveWalk(pose);
    const interact = action => engine.current?.receiveInteraction(action);
    socket.on('roomWalk', receive);socket.on('roomInteraction', interact);
    return () => {socket.off('roomWalk', receive);socket.off('roomInteraction', interact);};
  }, []);
  useEffect(() => {
    engine.current?.sync(latest.current);
    if (!canMove) { setCell(null); engine.current?.preview(null); }
  }, [players, playerId, currentPlayerId, canMove, reachableCellSet, reachableRoomSet, props.roomWalks, props.roomInteractions]);
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

  useEffect(() => {
    if(!passage)return;
    const timer=setTimeout(()=>setPassage(null),1800);return()=>clearTimeout(timer);
  }, [passage]);
  useEffect(() => {
    if(!activity)return;
    const timer=setTimeout(()=>setActivity(null),3200);return()=>clearTimeout(timer);
  }, [activity]);
  function move() {
    if (doorway) { setTravelling(true); onMoveRoom(doorway); }
    else if (canEnter) {
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
    engine.current?.cancelWalking();
    const player = latest.current.players.find(p => p.id === latest.current.playerId);
    inspect(player?.position.room || null);
  }
  function changeRoom(direction) {
    const index = roomNames.indexOf(selected);
    inspect(roomNames[(index + direction + roomNames.length) % roomNames.length]);
  }
  const movementHint = travelling ? 'Walking to your destination…'
    : doorway ? `${doorway} doorway · Press Enter or walk through to enter.`
    : here ? 'Walk freely with arrows / WASD. You can also make a suggestion.'
    : canEnter ? 'Reachable this turn. Enter to investigate.'
    : canWalk ? 'Keep walking to a lit doorway, or confirm to finish in the corridor.'
    : canMove ? 'Choose a reachable room or a highlighted corridor square.'
    : self?.eliminated ? 'You can explore the mansion and still answer suggestions.'
    : currentPlayerId !== playerId ? 'Explore while the other detective takes their turn.'
    : 'Roll the dice to discover where you can move.';
  return (
    <section ref={section} className={`mansion-3d ${expanded ? 'is-expanded' : ''}`} aria-label="Mansion explorer">
      <header className="explorer-header">
        <div className="explorer-location">
          <span className="explorer-kicker">{selected ? story?.[0] : 'Choose your next lead'}</span>
          <h3>{displayName(selected) || 'The mansion'}{here && <span className="location-pill">You are here</span>}</h3>
        </div>
        <div className="explorer-header-actions">
          <details className="audio-settings"><summary>Sound mix</summary><div>{Object.entries(levels).map(([channel,value])=><label key={channel}>{channel}<input aria-label={`${channel} volume`} type="range" min="0" max="100" value={Math.round(value*100)} onChange={event=>{const next=Number(event.target.value)/100;setAudioLevel(channel,next);setLevels({...levels,[channel]:next});}}/><output>{Math.round(value*100)}%</output></label>)}<small>The speaker button mutes all sound.</small></div></details>
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
        {activity && <div className="shared-activity" role="status">{activity}</div>}
        {passage && <div className="passage-reveal" role="status"><span>A hidden door opens</span><strong>Through the shadows…</strong><p>Emerging in the {passage}</p></div>}
        {selected && objects.length>0 && <details className="room-interactions" key={selected}><summary>Explore details · {objects.length}</summary><div>{objects.map(object=><button key={object.id} onClick={()=>engine.current?.interact(object.id)}>{object.label}</button>)}</div><small>Or click an object · E when nearby</small></details>}
        {discovery && <aside className="discovery-card" role="status"><button aria-label="Close discovery" onClick={()=>setDiscovery(null)}>×</button><small>MANSION MEMORY · ATMOSPHERE</small><h4>{discovery.title}</h4><p>{discovery.text}</p></aside>}
        <div className="mansion-3d-canvas" ref={host} />
        <div ref={labelLayer} className="world-labels" aria-label="Rooms and detectives" />
        {!ready && !failed && <div className="scene-loading">Preparing the mansion…</div>}
        {failed && <div className="scene-loading"><p>The 3D view is unavailable.</p><button onClick={onFallback}>Continue with the illustrated board</button></div>}
        <div className="explorer-view-caption">{view === 'walk' ? 'CHARACTER VIEW' : view === 'top' ? 'TOP VIEW' : selected ? 'ROOM VIEW' : 'MANSION MAP'}<span>{view === 'walk' ? self?.position.room ? 'Arrow keys / WASD to walk · Drag to look' : 'Arrows / WASD to walk · Enter at a doorway' : 'Scroll to zoom · Drag to orbit · Right-drag to pan'}</span></div>
        {selected && <div className="room-stepper"><button aria-label="Previous room" onClick={() => changeRoom(-1)}>←</button><span>{String(roomNames.indexOf(selected)+1).padStart(2,'0')} / {roomNames.length}</span><button aria-label="Next room" onClick={() => changeRoom(1)}>→</button></div>}
        <div className="explorer-camera" aria-label="Camera controls">
          <button aria-label="Rotate view left" onClick={() => engine.current?.rotate(-1)}>↶</button>
          <button aria-label="Zoom out" onClick={() => engine.current?.zoom(false)}>−</button>
          <button onClick={() => engine.current?.reset()} className="camera-reset">Reset view</button>
          <button aria-label="Zoom in" onClick={() => engine.current?.zoom(true)}>+</button>
          <button aria-label="Rotate view right" onClick={() => engine.current?.rotate(1)}>↷</button>
          <button aria-pressed={playerNames} onClick={() => { setPlayerNames(!playerNames); engine.current?.playerNames(!playerNames); }}>Player names</button>
          {!selected && <button aria-pressed={labels} onClick={() => { setLabels(!labels); engine.current?.labels(!labels); }}>Room names</button>}
        </div>
      </div>

      <nav hidden={!roomsOpen} className="room-browser" aria-label="Explore rooms">
        {roomNames.map(name => {
          const index = ART_ORDER.indexOf(name);
          const reachable = canMove && reachableRoomSet.has(name);
          const isHere = self?.position.room === name;
          return <button key={name} className={`room-choice ${selected === name ? 'selected' : ''}`} aria-pressed={selected === name} aria-label={`Explore ${displayName(name)}`} onClick={() => inspect(name)}>
            <span className="room-choice-art" aria-hidden="true" style={{backgroundPosition:`${index%4*100/3}% ${Math.floor(index/4)*50}%`}} />
            <span className="room-choice-text"><b>{displayName(name)}</b><small className={reachable ? 'reachable-text' : ''}>{isHere ? 'Your location' : reachable ? 'Reachable' : 'Look inside'}</small></span>
          </button>;
        })}
      </nav>
      {view === 'walk' && <div className="walk-pad" aria-label="Walking controls">
        {[['ArrowUp','↑'],['ArrowLeft','←'],['ArrowDown','↓'],['ArrowRight','→']].map(([key,label]) => <button key={key} aria-label={`Walk ${key.slice(5).toLowerCase()}`} onPointerDown={event => {event.currentTarget.setPointerCapture(event.pointerId);engine.current?.input(key,true);}} onPointerUp={() => engine.current?.input(key,false)} onPointerCancel={() => engine.current?.input(key,false)} onLostPointerCapture={() => engine.current?.input(key,false)}>{label}</button>)}
      </div>}
      <footer className="explorer-actionbar" aria-live="polite">
        <div><strong>{travelling ? 'On your way' : selected || (cell ? 'A new direction' : 'Follow the evidence')}</strong><p>{movementHint}</p>
          {selected && board.rooms[selected]?.secretPassage && <small>Secret passage connects to {board.rooms[selected].secretPassage}</small>}
        </div>
        <button className="explorer-move" onClick={move} disabled={!(doorway || canEnter || canWalk) || travelling}>{doorway ? `Enter ${doorway} ↵` : canEnter ? `Enter ${selected} →` : canWalk ? view === 'walk' ? 'Finish in corridor' : 'Walk here →' : here ? 'You are here' : 'Choose a destination'}</button>
      </footer>
      {expanded && <div className="explorer-gamebar">
        <span aria-live="polite">{props.gameStatus}</span>
        <div className="cb-actions">{props.gameActions}<button className="cb-btn" onClick={() => setExpanded(false)}>Evidence & notes ↙</button></div>
      </div>}
    </section>
  );
}
