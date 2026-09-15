// Lightweight sound effects synthesized with the Web Audio API — no asset
// files needed. Sounds only play after a user gesture (browser policy), which
// is fine since the first sounds follow clicks.

let ctx = null;
let enabled = localStorage.getItem("cluedo-sound") !== "off";

const levels = { effects: .8, ambience: .35, music: .4 };
try { const saved=JSON.parse(localStorage.getItem('cluedo-audio-levels')||'{}');for(const channel of Object.keys(levels))if(Number.isFinite(saved[channel]))levels[channel]=Math.max(0,Math.min(1,saved[channel])); } catch { /* Optional preferences. */ }
let channels = null;
const clips = new Map();
function updateClips() { for(const [audio,volume] of clips)audio.volume=enabled?volume*levels.effects:0; }
export function audioLevels() { return {...levels}; }
export function setAudioLevel(channel, value) {
  if(!(channel in levels)||!Number.isFinite(value))return;
  levels[channel]=Math.max(0,Math.min(1,value));
  updateClips();
  if(channels)channels[channel].gain.setTargetAtTime(enabled?levels[channel]:0,ctx.currentTime,.06);
  try {localStorage.setItem('cluedo-audio-levels',JSON.stringify(levels));}catch { /* Optional preferences. */ }
}

function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();channels={};
      for(const channel of Object.keys(levels)){const gain=ctx.createGain();gain.gain.value=enabled?levels[channel]:0;gain.connect(ctx.destination);channels[channel]=gain;}
    }
  }
  if (ctx && ctx.state === "suspended") ctx.resume().catch(()=>{});
  return ctx;
}

function beep(freq, start, dur, { type = "sine", gain = 0.08, channel = "effects" } = {}) {
  const ac = audioCtx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(channels[channel]);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start, dur, gain = 0.06, channel = "effects") {
  const ac = audioCtx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g).connect(channels[channel]);
  src.start(t0);
}

// Real audio clips (not synthesized) — one plays at random whenever
// someone's accusation turns out wrong.
const WRONG_ACCUSATION_CLIPS = ["/sounds/wrong-laugh-1.mp3", "/sounds/wrong-laugh-2.mp3", "/sounds/wrong-laugh-3.mp3"];
const WIN_CLIP = "/sounds/anime-wow.mp3";
const TURN_NAG_CLIP = "/sounds/turn-nag.mp3";

function playClip(src, volume = 0.6) {
  const audio = new Audio(src);
  audio.volume = enabled ? volume * levels.effects : 0;
  clips.set(audio,volume);
  const release=()=>clips.delete(audio);audio.addEventListener('ended',release,{once:true});audio.addEventListener('error',release,{once:true});
  audio.play().catch(release); // ignore autoplay-policy rejections
}

export const sfx = {
  footstep(room) {
    if (!enabled) return;
    const stone = ['Kitchen','Hall','Conservatory','Cellar'].includes(room);
    noise(0, stone ? .035 : .065, .012);
    beep(stone ? 180 : 85, 0, .07, { gain: .018 });
  },
  door() { if (enabled) { noise(0,.2,.016); beep(110,.1,.16,{gain:.025}); } },
  passage() { if (enabled) [180,135,90].forEach((f,i)=>beep(f,i*.15,.35,{gain:.025})); },
  piano(volume = 1) { if (enabled && volume > 0) [261.63,311.13,392,523.25,466.16,392].forEach((f,i)=>beep(f,i*.19,.65,{gain:.045*volume,type:'triangle',channel:'music'})); },
  discovery() { if (enabled) { beep(523,0,.25,{gain:.035});beep(784,.15,.45,{gain:.035}); } },
  dice() {
    if (!enabled) return;
    noise(0, 0.12, 0.05);
    noise(0.09, 0.08, 0.04);
    beep(180, 0.16, 0.08, { type: "square", gain: 0.05 });
  },
  move() {
    if (!enabled) return;
    [0, 0.16, 0.32].forEach((t) => {
      noise(t, 0.055, 0.018);
      beep(95, t, 0.08, { gain: 0.035 });
    });
  },
  show() {
    if (!enabled) return;
    beep(660, 0, 0.1);
    beep(990, 0.09, 0.12);
  },
  pass() {
    if (!enabled) return;
    beep(300, 0, 0.14, { type: "sawtooth", gain: 0.05 });
    beep(200, 0.1, 0.16, { type: "sawtooth", gain: 0.05 });
  },
  turn() {
    if (!enabled) return;
    beep(540, 0, 0.1);
    beep(760, 0.1, 0.12);
  },
  win() {
    if (!enabled) return;
    [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.12, 0.18, { gain: 0.09 }));
    setTimeout(() => playClip(WIN_CLIP, 0.7), 480); // right after the little fanfare
  },
  // Funny alarm clip for the "your turn" nag popup.
  siren() {
    if (!enabled) return;
    playClip(TURN_NAG_CLIP, 0.6);
  },
  wrongAccusation() {
    if (!enabled) return;
    const clip = WRONG_ACCUSATION_CLIPS[Math.floor(Math.random() * WRONG_ACCUSATION_CLIPS.length)];
    playClip(clip);
  },
  // Three rising ticks timed to a 3-2-1 "final answer" countdown, then a
  // sharper "locked in" click.
  suspense() {
    if (!enabled) return;
    [420, 500, 600].forEach((f, i) => beep(f, i * 0.9, 0.12, { type: "square", gain: 0.05 }));
    beep(900, 2.7, 0.12, { type: "square", gain: 0.07 });
  },
};

export function soundEnabled() {
  return enabled;
}

export function toggleSound() {
  enabled = !enabled;
  updateClips();
  localStorage.setItem("cluedo-sound", enabled ? "on" : "off");
  if(channels)for(const channel of Object.keys(levels))channels[channel].gain.setTargetAtTime(enabled?levels[channel]:0,ctx.currentTime,.04);
  if (enabled) sfx.turn();
  return enabled;
}

// One ambience controller per mansion. Short scheduled sounds and a looping,
// filtered noise bed fade between rooms, and stop when the view is disposed.
export function createRoomAmbience() {
  let room=null, bed=null, filter=null, source=null, lastTick=0, lastMusic=0, disposed=false;
  function stopBed() { if(source){source.stop();source.disconnect();source=null;}bed?.disconnect();filter?.disconnect();bed=null;filter=null; }
  function update() {
    if(disposed)return;
    const active=enabled&&!document.hidden&&room&&navigator.userActivation?.hasBeenActive!==false;
    if(!active){if(bed)bed.gain.setTargetAtTime(0,ctx.currentTime,.15);return;}
    const ac=audioCtx();if(!ac)return;
    if(!source){
      const buffer=ac.createBuffer(1,ac.sampleRate*3,ac.sampleRate);
      const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      source=ac.createBufferSource();source.buffer=buffer;source.loop=true;
      filter=ac.createBiquadFilter();filter.type='lowpass';bed=ac.createGain();bed.gain.value=0;
      source.connect(filter).connect(bed).connect(channels.ambience);source.start();
    }
    const rain=room==='Conservatory', fire=room==='Lounge', now=ac.currentTime;
    filter.frequency.setTargetAtTime(rain?1700:fire?450:170,now,.35);
    bed.gain.setTargetAtTime(rain?.11:fire?.055:.009,now,.4);
    if(now-lastTick>1){
      if(room==='Study')beep(1100,0,.025,{gain:.028,channel:'ambience'});
      if(fire)noise(0,.035,.025,'ambience');
      lastTick=now;
    }
    if(room==='Ballroom'&&now-lastMusic>12){
      [261.63,311.13,392,349.23].forEach((f,i)=>beep(f,i*.6,1.1,{gain:.009,channel:'music',type:'triangle'}));lastMusic=now;
    }
  }
  const timer=setInterval(update,200);
  return {
    setRoom(next){if(next!==room){room=next;lastMusic=ctx?.currentTime||0;}},
    dispose(){disposed=true;clearInterval(timer);stopBed();},
  };
}
