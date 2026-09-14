import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ROOM_STORIES = {
  Kitchen: ['Below stairs', 'Copper pans. A cooling stove. Someone left in a hurry.', '#ad7351'],
  Ballroom: ['The last dance', 'The music stopped. The chandelier is still swaying.', '#aa9063'],
  Conservatory: ['Under glass', 'Rain on the windows. Footprints among the ferns.', '#679879'],
  'Dining Room': ['A table for trouble', 'Dinner is served. One chair will remain empty.', '#b56f65'],
  'Billiard Room': ['A dangerous game', 'An unfinished game, and a very convenient alibi.', '#4d967e'],
  Library: ['Between the lines', 'Every book has a story. So does every guest.', '#a3815a'],
  Lounge: ['After dark', 'Velvet seats. Whispered secrets. A dying fire.', '#af626d'],
  Hall: ['An unwelcome arrival', 'Every guest passed through here. Who came back?', '#8b9fa2'],
  Study: ['Strictly confidential', 'An open letter. A locked drawer. A motive?', '#7587b5'],
  Cellar: ['Down in the dark', 'The finest vintage. The worst place to be alone.', '#92779c'],
  'Trophy Room': ['For the collection', 'A room full of victories. And one terrible loss.', '#b59a55'],
};
export const CHARACTER_COLORS = ['#cf5061','#dcb747','#c2d0d2','#509879','#537fc4','#9e6fbb','#e688b5','#a58061'];
const NAMES = ['Miss Scarlett','Colonel Mustard','Mrs. White','Reverend Green','Mrs. Peacock','Professor Plum','Dr. Orchid','Monsieur Brunette'];
export const characterColor = name => CHARACTER_COLORS[Math.max(0, NAMES.indexOf(name))];

export function buildScenery(scene, board) {
  const mats = new Map(), geometries = new Map();
  const material = (color, glow = false) => {
    const key = `${color}-${glow}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: .78, ...(glow ? { emissive: color, emissiveIntensity: 1.3 } : {}) }));
    return mats.get(key);
  };
  function mesh(parent, shape, size, color, x, y, z, glow = false) {
    const key = `${shape}-${size.join(',')}`;
    if (!geometries.has(key)) geometries.set(key, shape === 'box' ? new THREE.BoxGeometry(...size) : shape === 'sphere' ? new THREE.SphereGeometry(size[0], 10, 8) : new THREE.CylinderGeometry(...size, 12));
    const item = new THREE.Mesh(geometries.get(key), material(color, glow));
    item.position.set(x,y,z); item.castShadow = !glow; item.receiveShadow = true; parent.add(item); return item;
  }
  const box = (p,x,y,z,w,h,d,c) => mesh(p,'box',[w,h,d],c,x,y,z);
  const cylinder = (p,x,y,z,rt,rb,h,c) => mesh(p,'cylinder',[rt,rb,h],c,x,y,z);
  const orb = (p,x,y,z,r,c,glow=false) => mesh(p,'sphere',[r],c,x,y,z,glow);
  const floorTargets = [], roomFloors = new Map(), tiles = new Map(), labels = [];
  function label(text, x, y, z, color = '#eee2bd', scale = 3.7) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b1b19dd'; ctx.beginPath(); ctx.roundRect(4,4,504,88,22); ctx.fill();
    ctx.strokeStyle = '#c4a46877'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = color; ctx.font = '500 32px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text,256,49,480);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, depthTest:false, transparent:true }));
    sprite.position.set(x,y,z); sprite.scale.set(scale,scale*96/512,1); sprite.renderOrder=5; scene.add(sprite); labels.push(sprite); return sprite;
  }
  box(scene,0,-.7,0,board.cols+1.4,1,board.rows+1.4,'#263b39');
  box(scene,0,-.19,0,board.cols+.45,.12,board.rows+.45,'#b4955c');
  box(scene,0,-.09,0,board.cols,.1,board.rows,'#233c36');
  // Floating estate on a dark table with a brass rim.
  box(scene,0,-1.3,0,board.cols+3,.22,board.rows+3,'#10231f');
  const wood='#795139', gold='#c9a963', dark='#26312b';
  function table(group,x,z,w=1.8,d=1,color=wood) {
    box(group,x,.75,z,w,.16,d,color);
    for (const a of [-1,1]) for(const b of [-1,1]) box(group,x+a*(w/2-.16),.36,z+b*(d/2-.16),.13,.72,.13,dark);
  }
  function chair(group,x,z,color) { box(group,x,.38,z,.55,.16,.55,color);box(group,x,.8,z-.23,.55,.8,.12,color);for(const a of [-.2,.2]) box(group,x+a,.18,z,.09,.36,.4,wood); }
  function plant(group,x,z,size=1) {
    cylinder(group,x,.25,z,.25,.18,.5,'#aa7554');
    for(let i=0;i<5;i++){const angle=i*1.256; const leaf=orb(group,x+Math.cos(angle)*.18,.7+(i%2)*.2,z+Math.sin(angle)*.18,.3,'#57865a');leaf.scale.set(.7,size*1.7,.7);}
  }
  function shelf(group,x,z,w=1.5) {
    box(group,x,.95,z,w,1.9,.35,wood);
    for(let row=0;row<3;row++)for(let i=0;i<7;i++)box(group,x-w/2+.14+i*(w-.2)/7,.36+row*.53,z+.23,.1,.3+(i%3)*.055,.2,['#8c4345','#c1a668','#538079','#65738e'][i%4]);
    for(let row=0;row<4;row++)box(group,x,.14+row*.53,z+.12,w,.06,.6,gold);
  }
  function candle(group,x,z,y=.92) { cylinder(group,x,y,z,.08,.1,.3,gold);orb(group,x,y+.22,z,.07,'#ffd58a',true); }
  board.cells.forEach((row,r)=>row.forEach((cell,c)=>{
    if(cell.type!=='corridor' && cell.type!=='door')return;
    const tile=box(scene,c+.5-board.cols/2,0,r+.5-board.rows/2,.94,.12,.94,cell.type==='door'?gold:(r+c)%2?'#4b6055':'#637365');
    tile.castShadow=false; tile.userData.target = { cell:{r,c} }; floorTargets.push(tile); tiles.set(`${r},${c}`,tile);
  }));
  for(const [name,room] of Object.entries(board.rooms)) {
    const {r0,r1,c0,c1}=room.rect,w=c1-c0+1,d=r1-r0+1;
    const x=(c0+c1+1)/2-board.cols/2,z=(r0+r1+1)/2-board.rows/2;
    const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
    const color=ROOM_STORIES[name]?.[2] || '#75876b';
    const floor=box(group,0,.04,0,w-.08,.2,d-.08,color);floor.material=floor.material.clone();floor.userData.target={room:name};floorTargets.push(floor);roomFloors.set(name,floor);
    // Inlaid floorboards and a rug, kept beneath the avatar's walk plane.
    for(let n=0;n<d;n++)box(group,0,.145,n-d/2+.5,w-.25,.012,.025,'#372e2a');
    box(group,0,.16,.05,w*.57,.035,d*.5,'#283e38');
    box(group,0,.184,.05,w*.51,.015,d*.43,color);
    const doorSet=new Set(room.doorCells.map(p=>`${p.r},${p.c}`));
    // Low cutaway walls keep the room visible from every camera angle.
    for(let c=c0;c<=c1;c++)for(const r of [r0,r1]){
      if(doorSet.has(`${r},${c}`))continue;
      const wall=box(group,c+.5-(c0+c1+1)/2,.47,r===r0?-d/2+.08:d/2-.08,1,.68,.16,'#d4c4a0');
      box(group,wall.position.x,.84,wall.position.z,1,.08,.21,gold);
    }
    for(let r=r0;r<=r1;r++)for(const c of [c0,c1]){
      if(doorSet.has(`${r},${c}`))continue;
      box(group,c===c0?-w/2+.08:w/2-.08,.47,r+.5-(r0+r1+1)/2,.16,.68,1,'#d4c4a0');
      box(group,c===c0?-w/2+.08:w/2-.08,.84,r+.5-(r0+r1+1)/2,.21,.08,1,gold);
    }
    // Door jambs, without an overhead beam obstructing the miniature.
    for(const door of room.doorCells){const dx=door.c+.5-(c0+c1+1)/2,dz=door.r+.5-(r0+r1+1)/2;const horizontal=door.r===r0||door.r===r1;for(const side of [-1,1])box(group,dx+(horizontal?side*.43:0),.62,dz+(horizontal?0:side*.43),.14,1.15,.14,gold);}
    const back=-d/2+.75;
    if(name==='Kitchen') {
      box(group,0,.62,back,w-1.2,1.1,.85,'#d5c9ad');box(group,0,1.2,back,w-1.1,.12,.94,'#6b7770');
      for(const dx of [-1,0,1])cylinder(group,dx,1.28,back,.22,.22,.07,'#333c37');
      table(group,-.45,-.1,1.6,.9);cylinder(group,-.45,.96,-.1,.25,.2,.25,'#b87b49');
    } else if(name==='Library'||name==='Study') {
      for(const dx of [-w/2+1,w/2-1])shelf(group,dx,back,1.3);
      table(group,0,-.2,1.8,1);box(group,0,.86,-.2,.5,.03,.37,'#ecdfb9');chair(group,0,.65,'#754b44');candle(group,.6,-.2);
    } else if(name==='Billiard Room') {
      table(group,0,-.35,2.8,1.55);box(group,0,.86,-.35,2.6,.08,1.35,'#23755a');
      for(const dx of [-1.18,1.18])for(const dz of [-.52,.52])cylinder(group,dx,.92,-.35+dz,.09,.09,.03,'#131f1a');
      for(let i=0;i<5;i++)orb(group,-.5+i*.25,.98,-.25+(i%2)*.2,.08,['#fff3cf','#c55c4c','#e8c05f'][i%3]);
      const cue=box(group,.3,1,-.6,2.4,.04,.04,'#d8bd81');cue.rotation.y=.2;
    } else if(name==='Conservatory') {
      for(const dx of [-w/2+.65,w/2-.65])for(const dz of [back,0])plant(group,dx,dz,1.3);
      table(group,0,-.4,1,.8,'#adbeac');
      for(const dx of [-w/2+.18,w/2-.18])for(let i=0;i<3;i++)box(group,dx,1.45,-d/2+.5+i,.05,1.8,.05,'#89a69a');
      box(group,0,2.3,-d/2+.2,w,.08,.08,'#89a69a');
    } else if(name==='Lounge') {
      box(group,0,.55,back,2.7,.55,.9,'#9d5260');box(group,0,1,back-.35,2.7,.65,.23,'#9d5260');
      for(const dx of [-1.3,1.3])box(group,dx,.8,back,.25,.7,.95,'#9d5260');
      table(group,0,.05,1.6,.8);candle(group,0,.05);plant(group,-w/2+.75,0);
    } else if(name==='Dining Room') {
      table(group,0,-.7,2.5,1.35);for(const dx of [-.8,.8]){chair(group,dx,-1.75,'#8f5350');const ch=new THREE.Group();ch.position.set(dx,0,.4);ch.rotation.y=Math.PI;group.add(ch);chair(ch,0,0,'#8f5350');cylinder(group,dx,.86,-.7,.23,.23,.025,'#e6d9b7');}candle(group,0,-.7);
    } else if(name==='Cellar') {
      for(const dx of [-1.5,1.5])for(const dz of [back,back+1.2]){cylinder(group,dx,.62,dz,.4,.4,1.1,'#845537');for(const y of [.25,.95])cylinder(group,dx,y,dz,.42,.42,.07,'#363f39');}
      shelf(group,0,back,1.2);
    } else if(name==='Trophy Room') {
      box(group,0,.4,-.3,w-1.2,.8,.65,wood);for(const dx of [-1,0,1]){cylinder(group,dx,1,-.3,.13,.22,.45,gold);orb(group,dx,1.3,-.3,.2,gold);}
    } else if(name==='Hall') {
      for(let i=0;i<4;i++)box(group,0,.15+i*.15,back+i*.3,2.1,.3+i*.3,.3,'#c7c5b2');
      for(const dx of [-w/2+.7,w/2-.7]){cylinder(group,dx,1,back,.2,.24,1.8,'#e0d2b0');plant(group,dx,.25);}
    } else {
      // Ballroom: little grand piano and a suspended golden chandelier.
      box(group,-1.7,.85,back+.2,1.2,.6,1.35,'#27332c');box(group,-1.7,1.18,back+.65,1.1,.06,.28,'#efdfb7');
      cylinder(group,0,2.1,-.55,.7,.7,.1,gold);cylinder(group,0,2.65,-.55,.025,.025,1,gold);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;orb(group,Math.cos(a)*.65,2.28,-.55+Math.sin(a)*.65,.1,'#ffdd9c',true);}
    }
    // A brass lamp in each room provides a readable warm focal point.
    cylinder(group,w/2-.55,.65,back,.04,.09,1.2,gold);
    cylinder(group,w/2-.55,1.35,back,.2,.35,.35,'#e6c58a');
    orb(group,w/2-.55,1.21,back,.13,'#ffd494',true);
    label(name,x,.95,z+d/2-.45);
    if(room.secretPassage){const ring=new THREE.Mesh(new THREE.TorusGeometry(.27,.055,6,20),material('#7fdfcb',true));ring.rotation.x=-Math.PI/2;ring.position.set(-w/2+.55,.21,d/2-.6);group.add(ring);}
  }
  if(!board.rooms.Cellar){
    box(scene,0,.1,0,5,.3,5,'#183c32');box(scene,0,.33,0,3.6,.16,3.6,gold);box(scene,0,.46,0,3.4,.14,3.4,'#284d40');
    const envelope=box(scene,0,.63,0,1.8,.17,1.2,'#d8cba6');envelope.rotation.y=-.25;
    cylinder(scene,0,.76,0,.2,.2,.08,'#a34449');label('THE CASE FILE',0,1.4,1.3,'#ebce87',3.5);
  }
  // Batch furniture and architecture by material. Hundreds of decorative
  // pieces become a few draw calls; interactive floors stay individually pickable.
  scene.updateMatrixWorld(true);
  const batches=new Map(), originals=[];
  scene.traverse(object=>{
    if(!object.isMesh || object.userData.target)return;
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
    if(!batches.has(object.material))batches.set(object.material,[]);
    batches.get(object.material).push(geometry);originals.push(object);
  });
  for(const [mat,parts] of batches){const merged=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());const batch=new THREE.Mesh(merged,mat);batch.castShadow=true;batch.receiveShadow=true;scene.add(batch);}
  originals.forEach(object=>object.removeFromParent());
  function avatar(player) {
    const group=new THREE.Group(),body=new THREE.Group();group.add(body);scene.add(group);
    const color=characterColor(player.character);
    cylinder(body,0,.12,0,.27,.3,.16,'#202d28');
    const legs=[];
    for(const x of [-.12,.12]){const leg=box(body,x,.31,0,.16,.35,.18,'#283531');legs.push(leg);}
    cylinder(body,0,.66,0,.2,.29,.55,color);
    orb(body,0,1.12,0,.22,'#dfb38d');
    cylinder(body,0,1.29,0,.29,.29,.06,color);cylinder(body,0,1.37,0,.2,.2,.18,color);
    for(const x of [-.29,.29]){const arm=box(body,x,.73,0,.12,.4,.15,color);legs.push(arm);}
    box(body,0,.9,.2,.07,.22,.04,'#e8d4a5');
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.43,.045,6,24),material('#f8d47f',true));ring.rotation.x=-Math.PI/2;ring.position.y=.18;group.add(ring);
    const name=label(player.name,0,1.9,0,'#fff1cf',2.25);name.visible=false;
    return {group,body,legs,ring,label:name,route:[],lastPosition:null};
  }
  return {floorTargets,roomFloors,tiles,labels,avatar,material,dispose:()=>{geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
