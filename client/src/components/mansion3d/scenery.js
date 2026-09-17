import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterials } from './materials';

export const ROOM_STORIES = {
  Kitchen: ['Below stairs', 'Copper pans, a cooling stove, and a supper interrupted.', '#b99160'],
  "Music Room": ['The last song', 'An open grand piano, a half-played song, and a night nobody will forget.', '#b39859'],
  Greenhouse: ['Under glass', 'Moonlit windows and quiet corners hidden among the palms.', '#6e967b'],
  'Dining Room': ['A table for trouble', 'Dinner is served. One chair will remain empty.', '#994f4b'],
  'Game Room': ['A dangerous game', 'An unfinished game, and a very convenient alibi.', '#438572'],
  "Library": ['Between the lines', 'Every book has a story. So does every guest.', '#a48150'],
  "Sitting Room": ['After dark', 'Velvet seats, whispered secrets, and the glow of a dying fire.', '#985664'],
  "Entrance Hall": ['An unwelcome arrival', 'Every guest passed through here. Who came back?', '#9bad9f'],
  Office: ['Strictly confidential', 'An open letter. A locked drawer. A motive?', '#788895'],
  "Wine Cellar": ['Down in the dark', 'The finest vintage. The worst place to be alone.', '#88728b'],
  'Trophy Room': ['For the collection', 'A room full of victories. And one terrible loss.', '#b09457'],
};
const NAMES = ['Miss Ruby','Captain Gold','Lady Pearl','Mr Jade','Mrs Blue','Professor Violet','Doctor Rose','Baron Bronze'];
const COLORS = ['#b33249','#c39a35','#d1c8ac','#36735f','#416c9d','#7e4d94','#d2759b','#79513c'];
export const characterColor = name => COLORS[Math.max(0, NAMES.indexOf(name))];

export function buildScenery(scene, board) {
  const kit = createMaterials();
  const geometries = new Map(), extraMaterials = new Set(), textures = new Set();
  const roomGroups = new Map(), roomFloors = new Map(), tiles = new Map(), floorTargets = [], anchors = [], interactions = [], doors = [], details = [];
  const estate = new THREE.Group(); scene.add(estate);
  const gold = '#c6a160', wood = '#85613f', darkWood = '#554030';
  function shape(parent, kind, size, mat, x, y, z) {
    const key = `${kind}:${size.join(',')}`;
    if (!geometries.has(key)) {
      geometries.set(key, kind === 'box' ? new THREE.BoxGeometry(...size)
        : kind === 'soft' ? new RoundedBoxGeometry(...size, 2, Math.min(...size) * .18)
        : kind === 'sphere' ? new THREE.SphereGeometry(size[0], 18, 12)
        : kind === 'torus' ? new THREE.TorusGeometry(...size, 8, 32)
        : new THREE.CylinderGeometry(...size, 20));
    }
    const mesh = new THREE.Mesh(geometries.get(key), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  const box = (g,x,y,z,w,h,d,c,kind='plain',soft=false) => shape(g,soft?'soft':'box',[w,h,d],kit.material(c,kind),x,y,z);
  const cyl = (g,x,y,z,rt,rb,h,c,kind='plain') => shape(g,'cylinder',[rt,rb,h],kit.material(c,kind),x,y,z);
  const orb = (g,x,y,z,r,c,kind='plain') => shape(g,'sphere',[r],kit.material(c,kind),x,y,z);
  const ring = (g,x,y,z,r,t,c) => shape(g,'torus',[r,t],kit.material(c,'metal'),x,y,z);
  function tabletop(g,x,z,w,d,color=wood) {
    box(g,x,.91,z,w,.15,d,color,'wood',true);
    box(g,x,.8,z,w-.08,.12,d-.08,gold,'metal');
    for (const a of [-1,1]) for (const b of [-1,1]) {
      cyl(g,x+a*(w/2-.17),.44,z+b*(d/2-.17),.07,.045,.8,darkWood,'wood');
      orb(g,x+a*(w/2-.17),.7,z+b*(d/2-.17),.085,gold,'metal');
    }
  }
  function chair(g,x,z,color,rotation=0) {
    const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=rotation;g.add(root);
    box(root,0,.46,0,.62,.17,.62,color,'plain',true);
    box(root,0,.91,-.25,.6,.83,.14,darkWood,'wood',true);
    box(root,0,.95,-.15,.48,.55,.11,color,'plain',true);
    for(const a of [-.23,.23])for(const b of [-.23,.23])cyl(root,a,.22,b,.045,.03,.44,darkWood,'wood');
    return root;
  }
  function candle(g,x,y,z) {
    cyl(g,x,y,z,.1,.15,.07,gold,'metal');cyl(g,x,y+.2,z,.035,.06,.4,gold,'metal');
    cyl(g,x,y+.47,z,.062,.062,.18,'#eee0b5');
    const flame=orb(g,x,y+.61,z,.058,'#ffd495','glow');flame.scale.y=1.65;
  }
  function plant(g,x,z,size=1) {
    cyl(g,x,.23,z,.26,.18,.43,'#a07953','wood');ring(g,x,.42,z,.255,.035,gold).rotation.x=Math.PI/2;
    for(let i=0;i<9;i++){
      const angle=i*Math.PI*2/9;
      const leaf=orb(g,x+Math.cos(angle)*.2,.65+(i%3)*.19,z+Math.sin(angle)*.2,.24,i%2?'#4f7750':'#70894d');
      leaf.scale.set(.65,2.3*size,.38);leaf.rotation.z=Math.sin(angle)*.6;leaf.rotation.x=Math.cos(angle)*.6;
    }
  }
  function shelf(g,x,z,w=1.4,height=2.05) {
    box(g,x,height/2,z,w,height,.34,darkWood,'wood');
    for(const side of [-1,1])box(g,x+side*(w/2-.06),height/2,z+.15,.12,height,.48,wood,'wood');
    for(let row=0;row<4;row++){
      for(let i=0;i<9;i++){
        const h=.25+(i*7%4)*.04;
        box(g,x-w/2+.17+i*(w-.25)/9,.28+row*.45+h/2,z+.23,.095,h,.23,['#8e5448','#b49762','#55786d','#626d82'][i%4],'plain');
        box(g,x-w/2+.17+i*(w-.25)/9,.37+row*.45,z+.351,.075,.018,.008,gold,'metal');
      }
      box(g,x,.19+row*.45,z+.1,w,.07,.6,wood,'wood');
    }
    box(g,x,height+.025,z+.08,w+.15,.12,.65,gold,'metal');
  }
  const artLoader = new THREE.TextureLoader();
  const nightTexture=artLoader.load('/art/mansion-night.jpg');nightTexture.colorSpace=THREE.SRGBColorSpace;
  nightTexture.repeat.set(.35,.8);nightTexture.offset.set(.04,.1);textures.add(nightTexture);
  const windowMaterial=new THREE.MeshStandardMaterial({map:nightTexture,color:'#8baeb4',emissive:'#64898b',emissiveMap:nightTexture,emissiveIntensity:.3,roughness:.45});extraMaterials.add(windowMaterial);
  function painting(g,x,y,z,index,w=.85,h=1.08) {
    box(g,x,y,z,w+.14,h+.14,.085,gold,'metal');
    box(g,x,y,z+.055,w+.04,h+.04,.05,darkWood,'wood');
    const texture=artLoader.load('/art/detective-portraits.jpg');texture.colorSpace=THREE.SRGBColorSpace;
    texture.repeat.set(.25,.5);texture.offset.set((index%4)/4,index<4?.5:0);textures.add(texture);
    const mat=new THREE.MeshStandardMaterial({map:texture,roughness:1});extraMaterials.add(mat);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);plane.position.set(x,y,z+.09);g.add(plane);
    plane.userData.target={interaction:'portrait'};
    interactions.push({kind:'portrait',room:g.userData.room,mesh:plane,label:'Inspect portrait',text:'The varnish is cracked around the eyes. On the frame: “Appearances are an excellent alibi.” An old family joke, perhaps.'});
  }
  function windowFrame(g,x,z,w=1.1,h=1.45) {
    const y=1.82;
    box(g,x,y,z,w+.17,h+.16,.08,'#d2c09a','wood');
    const glass=box(g,x,y,z+.051,w,h,.02,'#385a68','glow');glass.material=windowMaterial;
    for(const dx of [-w/2,0,w/2])box(g,x+dx,y,z+.08,.04,h,.06,gold,'metal');
    box(g,x,y,z+.08,w,.05,.07,gold,'metal');
    box(g,x,y-h/2-.06,z+.13,w+.28,.11,.29,'#ccb68e','marble');
    if(g.userData.room==='Greenhouse') {
      const positions=new Float32Array(24*6);
      for(let i=0;i<24;i++) {const px=x+(((i*17)%24)/24-.5)*w, py=y-h/2+(i*7%24)/24*h;positions.set([px,py,z+.075,px-.012,py+.09,z+.075],i*6);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      const material=new THREE.LineBasicMaterial({color:'#bfd7e5',transparent:true,opacity:.48});extraMaterials.add(material);
      const streaks=new THREE.LineSegments(geometry,material);g.add(streaks);details.push({kind:'rain',mesh:streaks,min:y-h/2,max:y+h/2-.1});
    }
    // A pair of pleated velvet curtains, with brass tiebacks.
    for(const side of [-1,1])for(let i=0;i<3;i++) {
      const curtain=cyl(g,x+side*(w/2+.12)+i*.065,1.8,z+.13,.07,.09,h+.25,'#594b45');curtain.scale.z=.62;
    }
  }
  function fireplace(g,x,z) {
    box(g,x,.6,z,1.5,1.2,.5,'#786d58','marble');
    box(g,x,.51,z+.26,.98,.76,.04,'#191c18');
    box(g,x,1.24,z+.08,1.75,.15,.68,'#bdaf89','marble');
    box(g,x,.15,z+.25,1.65,.12,.7,darkWood,'marble');
    for(const dx of [-.25,.1,.3]){const log=cyl(g,x+dx,.28,z+.36,.065,.065,.42,darkWood,'wood');log.rotation.z=1.2;const fire=orb(g,x+dx,.4,z+.36,.12,'#d69548','glow');fire.scale.set(.7,1.6,.5);fire.userData.target={decoration:true};details.push({kind:'fire',mesh:fire,phase:dx*9});}
    candle(g,x-.55,1.35,z+.06);candle(g,x+.55,1.35,z+.06);
  }
  function chandelier(g,x,z,r=.7) {
    cyl(g,x,2.62,z,.024,.024,.65,gold,'metal');
    ring(g,x,2.3,z,r,.035,gold).rotation.x=Math.PI/2;
    orb(g,x,2.45,z,.13,gold,'metal');
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,dx=Math.cos(a)*r,dz=Math.sin(a)*r;
      const arm=cyl(g,x+dx/2,2.3,z+dz/2,.025,.025,r,gold,'metal');arm.rotation.z=Math.PI/2;arm.rotation.y=-a;
      cyl(g,x+dx,2.4,z+dz,.055,.075,.22,'#f0dfac');orb(g,x+dx,2.56,z+dz,.065,'#ffdb9b','glow');
      const crystal=orb(g,x+dx,2.13,z+dz,.07,'#b5cac6','metal');crystal.scale.y=1.9;
    }
  }
  function sofa(g,x,z,color,width=2.35,rotation=0) {
    const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=rotation;g.add(root);
    box(root,0,.45,0,width,.5,.83,color,'plain',true);
    box(root,0,.9,-.34,width,.74,.23,color,'plain',true);
    for(const side of [-1,1]){box(root,side*(width/2-.1),.7,0,.26,.55,.91,color,'plain',true);cyl(root,side*(width/2-.2),.14,.25,.05,.035,.24,gold,'metal');}
    for(let i=0;i<3;i++){box(root,(i-1)*(width-.5)/3,.75,0,(width-.5)/3-.02,.12,.61,color,'plain',true);const button=orb(root,(i-1)*.5,.95,-.207,.034,gold,'metal');button.scale.z=.4;}
    for(const side of [-1,1]){const cushion=box(root,side*(width/2-.5),.98,-.14,.34,.37,.12,'#b39761','plain',true);cushion.rotation.z=side*.17;}
  }
  function rug(g,w,d,color) {
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(w,d),kit.rug(color));
    floor.rotation.x=-Math.PI/2;floor.position.set(0,.161,.05);floor.receiveShadow=true;g.add(floor);
  }

  box(estate,0,-.46,0,board.cols+1,.7,board.rows+1,'#21332d','wood',true);
  box(estate,0,-.12,0,board.cols+.4,.06,board.rows+.4,gold,'metal');
  box(estate,0,-.09,0,board.cols,.08,board.rows,'#243c33');
  board.cells.forEach((row,r)=>row.forEach((cell,c)=>{
    if(cell.type!=='corridor'&&cell.type!=='door')return;
    const color=cell.type==='door'?gold:(r+c)%2?'#667868':'#adbaa4';
    const tile=box(estate,c+.5-board.cols/2,0,r+.5-board.rows/2,.98,.1,.98,color,'marble');
    tile.castShadow=false;tile.userData.target={cell:{r,c}};tile.userData.baseMaterial=tile.material;
    floorTargets.push(tile);tiles.set(`${r},${c}`,tile);
  }));

  for(const [index,[name,room]] of Object.entries(board.rooms).entries()) {
    const {r0,r1,c0,c1}=room.rect,w=c1-c0+1,d=r1-r0+1;
    const x=(c0+c1+1)/2-board.cols/2,z=(r0+r1+1)/2-board.rows/2;
    const group=new THREE.Group();group.position.set(x,0,z);group.userData.room=name;scene.add(group);
    const color=ROOM_STORIES[name][2];
    const floor=box(group,0,.045,0,w,.2,d,name==='Entrance Hall'||name==='Kitchen'?'#c0c5af':'#c0a378',name==='Entrance Hall'||name==='Kitchen'?'marble':'parquet');
    floor.material=floor.material.clone();extraMaterials.add(floor.material);floor.userData.target={room:name};floorTargets.push(floor);roomFloors.set(name,floor);
    box(group,0,-.17,0,w+.14,.28,d+.14,'#283c30','wood',true);
    rug(group,w*.62,d*.58,name==='Music Room'?'#5b6246':name==='Library'?'#7f5542':color);
    const doorSet=new Set(room.doorCells.map(p=>`${p.r},${p.c}`));
    // Tall decorated north/west walls; low south/east walls keep the view open.
    function wall(px,pz,length,rotation,tall,hasDoor=false) {
      const root=new THREE.Group();root.position.set(px,0,pz);root.rotation.y=rotation;group.add(root);
      if(!hasDoor){
        box(root,0,tall?1.51:.25,0,length,tall?2.72:.3,.16,tall?color:darkWood,tall?'wallpaper':'wood');
        if(tall){
          box(root,0,.56,.02,length,.84,.2,darkWood,'wood');
          box(root,0,1,.025,length,.08,.24,gold,'metal');
          box(root,0,2.91,0,length+.04,.12,.28,'#d7c7a2','wood');
          box(root,0,2.78,.08,length,.06,.12,gold,'metal');
          box(root,0,.16,.09,length,.1,.18,gold,'metal');
          box(root,0,.59,.135,length-.12,.6,.025,wood,'wood');
          box(root,0,.59,.154,length-.22,.48,.025,darkWood,'wood');
        }else box(root,0,.43,0,length,.065,.24,gold,'metal');
      }else{
        for(const side of [-1,1])box(root,side*.43,1.02,0,.13,1.83,.24,darkWood,'wood');
        box(root,0,1.97,0,1,.15,.27,gold,'metal');
        if(tall)box(root,0,2.48,0,1,.82,.16,color,'wallpaper');
        const hinge=new THREE.Group();hinge.position.set(-.35,.16,0);root.add(hinge);
        const leaf=box(hinge,.35,.81,0,.7,1.62,.07,darkWood,'wood');leaf.userData.target={door:true};
        const knob=orb(hinge,.6,.8,.075,.045,gold,'metal');knob.userData.target={door:true};
        hinge.rotation.y=-1.45;doors.push({room:name,hinge,openUntil:0});
      }
    }
    for(let c=c0;c<=c1;c++){
      wall(c+.5-(c0+c1+1)/2,-d/2,1,0,true,doorSet.has(`${r0},${c}`));
      wall(c+.5-(c0+c1+1)/2,d/2,1,Math.PI,false,doorSet.has(`${r1},${c}`));
    }
    for(let r=r0;r<=r1;r++){
      wall(-w/2,r+.5-(r0+r1+1)/2,1,Math.PI/2,true,doorSet.has(`${r},${c0}`));
      wall(w/2,r+.5-(r0+r1+1)/2,1,-Math.PI/2,false,doorSet.has(`${r},${c1}`));
    }
    const back=-d/2+.62;
    if(name==='Greenhouse'){
      for(const dx of [-w/2+1,w/2-1])windowFrame(group,dx,-d/2+.14,1.35,1.7);
      for(const dx of [-w/2+.7,w/2-.7])for(const dz of [back+.2,.15])plant(group,dx,dz,1.1);
      tabletop(group,0,-.4,1,.85,'#b4b69a');chair(group,-.8,-.4,'#a9ad83',Math.PI/2);chair(group,.8,-.4,'#a9ad83',-Math.PI/2);
      const arch=ring(group,0,2.2,back,1.45,.04,gold);arch.scale.set(1,.7,1);
    }else if(name==='Kitchen'){
      windowFrame(group,.3,-d/2+.15,1.25,1.25);
      box(group,0,.64,back,w-1.05,1.04,.85,'#a6ada0','plain',true);
      box(group,0,1.2,back,w-.95,.13,.98,'#ccc9ae','marble',true);
      for(const dx of [-1.2,-.4,.4,1.2]){box(group,dx,.7,back+.44,.66,.69,.04,'#737f70','wood');box(group,dx,.8,back+.48,.22,.035,.035,gold,'metal');}
      for(const dx of [-1.15,-.65])cyl(group,dx,1.3,back,.18,.18,.025,'#242b26');
      cyl(group,-1.15,1.4,back,.17,.17,.25,'#bb8452','metal');ring(group,-.9,1.43,back,.12,.025,gold);
      box(group,.8,1.275,back,.65,.025,.43,'#748b85','metal');
      const tap=ring(group,.8,1.52,back-.15,.16,.025,gold);tap.rotation.y=Math.PI/2;
      tabletop(group,-.3,-.05,1.8,1.05);box(group,-.35,1.01,-.05,.75,.035,.55,'#c7a66e','wood');
      for(let i=0;i<3;i++)orb(group,-.55+i*.18,1.1,-.05,.09,i%2?'#ae6e37':'#69824b');
      for(let i=0;i<3;i++){const pan=cyl(group,-w/2+.2,1.8,back+.65+i*.55,.18,.18,.06,'#b0824c','metal');pan.rotation.z=Math.PI/2;}
    }else if(name==='Library'||name==='Office'){
      for(const dx of [-w/2+.9,w/2-.9])shelf(group,dx,back,1.35);
      painting(group,0,1.88,-d/2+.15,index%8,.9,1.1);
      tabletop(group,0,-.2,1.95,1.03);chair(group,0,.67,name==='Office'?'#4c6964':'#8c514b');
      box(group,-.15,1.005,-.15,.55,.02,.45,'#e5dcc0');box(group,.14,1.017,-.19,.055,.025,.37,'#283b31');candle(group,.66,1.01,-.35);
      for(let i=0;i<3;i++)box(group,-.67,1.04+i*.06,-.35,.4,.05,.3,['#965648','#6b8168','#b79b62'][i]);
      if(name==='Office') {
        const cx=-w/2+.52, cz=.2;
        box(group,cx,.95,cz,.65,1.8,.36,darkWood,'wood');
        box(group,cx,.9,cz+.19,.43,1.1,.025,'#182820');
        const face=cyl(group,cx,1.63,cz+.23,.23,.23,.04,'#e4d9b7');face.rotation.x=Math.PI/2;
        for(let tick=0;tick<12;tick++){const angle=tick*Math.PI/6;orb(group,cx+Math.sin(angle)*.19,1.63+Math.cos(angle)*.19,cz+.26,.013,gold,'metal');}
        box(group,cx,1.69,cz+.27,.018,.14,.014,'#26342a');box(group,cx+.06,1.63,cz+.27,.14,.018,.014,'#26342a');
        const pendulum=new THREE.Group();pendulum.position.set(cx,1.35,cz+.25);group.add(pendulum);
        const rod=box(pendulum,0,-.3,0,.025,.6,.025,gold,'metal');rod.userData.target={decoration:true};
        const bob=orb(pendulum,0,-.63,0,.105,gold,'metal');bob.scale.z=.25;bob.userData.target={decoration:true};
        details.push({kind:'clock',mesh:pendulum});
      }
      if(name==='Library'){const reading=new THREE.Group();reading.position.set(-w/2+.65,0,.35);reading.rotation.y=Math.PI/2;group.add(reading);shelf(reading,0,0,1.5);}
    }else if(name==='Sitting Room'){
      fireplace(group,-1.25,back);painting(group,-1.25,2.08,-d/2+.16,4,.86,.8);windowFrame(group,1.2,-d/2+.14,.85,1.35);
      sofa(group,.6,-.55,'#814451',2.5);sofa(group,-1.8,.4,'#814451',1.25,Math.PI/2);
      tabletop(group,.2,.52,1.6,.75);candle(group,.55,1,.5);cyl(group,-.2,1.04,.45,.13,.13,.05,'#e3d7b1');plant(group,w/2-.65,.4);
    }else if(name==='Game Room'){
      painting(group,-1.3,1.93,-d/2+.16,1,.85,1.05);windowFrame(group,.7,-d/2+.14,1.1,1.35);
      tabletop(group,0,-.4,2.8,1.6,darkWood);box(group,0,1.035,-.4,2.63,.065,1.42,'#34755e','plain',true);
      for(const dx of [-1.2,0,1.2])for(const dz of [-.57,.57])cyl(group,dx,1.075,-.4+dz,.085,.085,.015,'#14251c');
      for(let i=0;i<6;i++)orb(group,-.4+i*.16,1.14,-.45+(i%3)*.13,.067,['#d7bc59','#e0d8b8','#a0483f'][i%3]);
      const cue=box(group,.4,1.12,-.73,1.8,.028,.028,'#d4b882','wood');cue.rotation.y=.22;
      for(let i=0;i<4;i++){const stick=cyl(group,-w/2+.2,1.5,back+.6+i*.19,.018,.026,1.6,wood,'wood');stick.rotation.z=-.12;}
      chandelier(group,0,-.5,.55);
    }else if(name==='Dining Room'){
      fireplace(group,0,back);painting(group,0,2.13,-d/2+.16,1,1,.75);
      tabletop(group,0,-.05,2.25,1.35);
      for(const dx of [-.72,.72]){
        chair(group,dx,-1.1,'#804638');chair(group,dx,1.02,'#804638',Math.PI);
        for(const dz of [-.35,.35]){cyl(group,dx,1.01,dz,.18,.18,.018,'#e8dbb3');cyl(group,dx+.24,1.05,dz,.036,.04,.11,gold,'metal');}
      }
      candle(group,0,1.01,0);chandelier(group,0,-.05,.6);plant(group,w/2-.65,back+.3);
    }else if(name==='Entrance Hall'){
      for(let i=0;i<5;i++)box(group,-.5,.12+i*.12,back+i*.28,1.8,.24+i*.24,.3,'#c6c5ae','marble');
      for(const dx of [-1.45,.45]){cyl(group,dx,.9,back+.55,.065,.065,1.3,gold,'metal');box(group,dx,1.6,back+.55,.08,.08,1.5,darkWood,'wood');}
      for(const dx of [-w/2+.45,w/2-.45]){cyl(group,dx,1.45,back,.13,.18,2.6,'#d6c7a2','marble');cyl(group,dx,2.78,back,.25,.25,.14,gold,'metal');}
      painting(group,.85,1.9,-d/2+.15,0,.7,1.2);plant(group,w/2-.65,.35);chandelier(group,0,0,.55);
    }else if(name==='Wine Cellar'){
      for(const dx of [-w/2+.7,w/2-.7])for(let i=0;i<3;i++){
        const dz=back+i*1.1;cyl(group,dx,.65,dz,.36,.43,1.05,wood,'wood');
        for(const y of [.28,.9])cyl(group,dx,y,dz,.418,.418,.06,'#343d32','metal');
      }
      shelf(group,0,back,1.6,2);tabletop(group,0,0,1.4,.8);candle(group,0,1,0);
      for(let i=0;i<3;i++){cyl(group,-.4+i*.3,1.15,0,.07,.08,.25,'#395747','metal');cyl(group,-.4+i*.3,1.32,0,.028,.04,.1,'#395747');}
    }else if(name==='Trophy Room'){
      box(group,0,.55,back,w-1.1,.8,.65,darkWood,'wood',true);
      for(const dx of [-1,0,1]){box(group,dx,1.01,back,.28,.12,.28,'#242e28');cyl(group,dx,1.25,back,.06,.15,.35,gold,'metal');const cup=cyl(group,dx,1.49,back,.18,.06,.2,gold,'metal');cup.castShadow=true;for(const side of [-1,1])ring(group,dx+side*.17,1.47,back,.105,.018,gold);}
      painting(group,0,2.2,-d/2+.15,7,1,.7);
    }else{
      windowFrame(group,-1.7,-d/2+.13,1.1,1.65);windowFrame(group,1.7,-d/2+.13,1.1,1.65);
      painting(group,0,2,-d/2+.13,0,.85,1.15);
      // Curved grand piano body, polished lid, individual keys and brass pedals.
      const piano=new THREE.Group();piano.position.set(-w/2+1.5,0,back+.75);piano.rotation.y=-.2;group.add(piano);
      const outline=new THREE.Shape();outline.moveTo(-.65,.6);outline.lineTo(.65,.6);outline.lineTo(.65,-.2);outline.bezierCurveTo(.65,-1.35,-.65,-1.1,-.65,-.25);outline.closePath();
      const geometry=new THREE.ExtrudeGeometry(outline,{depth:.25,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,steps:1});
      const body=new THREE.Mesh(geometry,kit.material('#252c26'));body.rotation.x=Math.PI/2;body.position.y=1.05;body.castShadow=true;piano.add(body);
      for(const dx of [-.5,.5])cyl(piano,dx,.48,.35,.055,.035,.86,'#222b25');cyl(piano,0,.48,-.7,.055,.035,.86,'#222b25');
      box(piano,0,1,.66,1.25,.07,.25,'#ddd2b5');for(let i=0;i<15;i++)box(piano,-.55+i*.075,1.05,.6,.037,.045,.13,'#222921');
      const lid=box(piano,0,1.17,-.13,1.3,.06,1.4,'#242d26','plain',true);lid.rotation.z=-.16;
      lid.userData.target={interaction:'piano'};
      interactions.push({room:name,kind:'piano',mesh:lid,label:'Play the piano',text:'A minor melody drifts through the music room. For a moment, the house feels as though it is listening.',playingUntil:0});
      chair(group,-w/2+1.5,back+1.85,'#303a2f');chandelier(group,.55,-.15,.85);
      sofa(group,w/2-.52,-.6,'#7c6548',1.8,-Math.PI/2);
    }
    // Finishing touches: sconce, floor lamp, skirting and secret-passage medallion.
    cyl(group,w/2-.48,1.05,back+.18,.026,.055,1.85,gold,'metal');
    cyl(group,w/2-.48,2.03,back+.18,.19,.34,.39,'#d9c397');
    orb(group,w/2-.48,1.91,back+.18,.09,'#ffdb9a','glow');
    if(room.secretPassage){const passage=ring(group,-w/2+.57,.19,d/2-.58,.25,.035,'#80a797');passage.rotation.x=-Math.PI/2;}
    roomGroups.set(name,{group,box:new THREE.Box3(new THREE.Vector3(x-w/2-.12,-.35,z-d/2-.12),new THREE.Vector3(x+w/2+.12,3.08,z+d/2+.12)),lamp:new THREE.Vector3(x+w/2-.48,2.15,z+back+.18)});
    anchors.push({name,point:new THREE.Vector3(x,.6,z+d/2-.3)});
  }
  if(!board.rooms["Wine Cellar"]){
    box(estate,0,.15,0,4.7,.4,4.7,darkWood,'wood',true);box(estate,0,.38,0,4.5,.06,4.5,gold,'metal');
    box(estate,0,.45,0,4.3,.08,4.3,'#344f3c');
    const envelope=box(estate,0,.58,0,1.7,.12,1.15,'#d8caaa','plain',true);envelope.rotation.y=-.22;cyl(estate,0,.68,0,.18,.18,.05,'#923f41');
  }
  // Batch within each room so a focused room can hide the rest of the estate.
  function batch(root){
    root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),batches=new Map(),originals=[];
    root.traverse(object=>{if(!object.isMesh||object.userData.target)return;const geometry=(object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()).applyMatrix4(inverse.clone().multiply(object.matrixWorld));if(!batches.has(object.material))batches.set(object.material,[]);batches.get(object.material).push(geometry);originals.push(object);});
    for(const [mat,parts] of batches){const mesh=new THREE.Mesh(mergeGeometries(parts,false),mat);parts.forEach(g=>g.dispose());mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
    originals.forEach(object=>{object.removeFromParent();if(![...geometries.values()].includes(object.geometry))object.geometry.dispose();});
  }
  batch(estate);for(const {group} of roomGroups.values())batch(group);
  // Keep moving props out of static geometry batches.
  for(const [name,{group}] of roomGroups) {
    const room=board.rooms[name], w=room.rect.c1-room.rect.c0+1, d=room.rect.r1-room.rect.r0+1;
    const px=w/2-.8,pz=d/2-1.1;
    box(group,px,.45,pz,1,.6,.65,darkWood,'wood');
    const drawer=box(group,px,.58,pz+.35,.84,.2,.12,wood,'wood');
    const handle=box(drawer,0,0,.09,.2,.035,.04,gold,'metal');
    const letter=box(group,px,.69,pz+.35,.45,.01,.3,'#eadbb1');letter.visible=false;
    drawer.userData.target={interaction:'drawer'};handle.userData.target={interaction:'drawer'};
    interactions.push({room:name,kind:'drawer',mesh:drawer,letter,baseZ:drawer.position.z,open:false,label:'Open drawer',text:ROOM_STORIES[name][1]+' Inside: an old dinner invitation, dated long before this case. The house keeps its memories.'});
  }
  function avatar(player){
    const group=new THREE.Group(),body=new THREE.Group();scene.add(group);group.add(body);
    const index=Math.max(0,NAMES.indexOf(player.character)),color=characterColor(player.character),limbs=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.115,.52,0);body.add(leg);cyl(leg,0,-.16,0,.07,.062,.35,'#28342e');box(leg,0,-.36,.04,.16,.13,.26,'#212b26','plain',true);limbs.push(leg);
    }
    cyl(body,0,.77,0,.19,.24,.53,color);box(body,0,.85,.185,.12,.35,.045,'#e2d7b5','plain',true);
    box(body,0,.88,.215,.04,.2,.018,color);
    const head=orb(body,0,1.21,0,.205,index===6?'#d2a780':'#dfba92');head.scale.set(.86,1.12,.9);
    for(const side of [-1,1]){
      orb(body,side*.073,1.24,.167,.016,'#24332e');orb(body,side*.18,1.21,0,.044,'#d3ac83');
      const arm=new THREE.Group();arm.position.set(side*.25,.98,0);body.add(arm);cyl(arm,0,-.17,0,.06,.055,.32,color);orb(arm,0,-.35,0,.06,'#dfba92');limbs.push(arm);
    }
    orb(body,0,1.18,.185,.035,'#d1a87e');
    if([0,2,6].includes(index)){
      const hair=orb(body,0,1.34,-.035,.2,index===2?'#a3a598':index===0?'#6d3824':'#2b2c25');hair.scale.set(.95,.65,.9);
      orb(body,0,1.26,-.18,.12,index===2?'#a3a598':'#3c3027');
    }else{
      cyl(body,0,1.4,0,index===4?.31:.24,.26,.055,color);cyl(body,0,1.49,0,.175,.19,.15,color);cyl(body,0,1.43,0,.183,.193,.04,gold,'metal');
    }
    if(index===5)for(const side of [-1,1])ring(body,side*.075,1.24,.182,.045,.012,gold);
    const halo=ring(group,0,.2,0,.36,.027,gold);halo.rotation.x=-Math.PI/2;
    return {group,body,legs:limbs,ring:halo,route:[],lastPosition:null};
  }
  return {estate,roomGroups,roomFloors,tiles,floorTargets,anchors,interactions,doors,avatar,material:kit.material,
    animate(dt,time,reduced) {
      for(const detail of details) {
        if(detail.kind==='fire')detail.mesh.scale.y=reduced?1.6:1.6+Math.sin(time*9+detail.phase)*.22;
        if(detail.kind==='clock')detail.mesh.rotation.z=reduced?0:Math.sin(time*Math.PI*2)*.18;
        if(detail.kind==='rain'&&!reduced){const attribute=detail.mesh.geometry.attributes.position;for(let i=0;i<attribute.array.length;i+=6){let y=attribute.array[i+1]-dt*.7;if(y<detail.min)y=detail.max;attribute.array[i+1]=y;attribute.array[i+4]=y+.09;}attribute.needsUpdate=true;}
      }
    },
    dispose(){geometries.forEach(g=>g.dispose());extraMaterials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());kit.dispose();}};
}
