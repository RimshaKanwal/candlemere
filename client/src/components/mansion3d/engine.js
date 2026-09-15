import { sfx } from '../../sound';
import * as THREE from 'three';
import { buildScenery } from './scenery';
import { createCamera } from './camera';
import { cellPoint, playerPoint, walkingRoute } from './navigation';

export function createMansionEngine(host, labelLayer, board, initial, events) {
  const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
  try {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#14221f');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '3D mansion. Choose a room using its label or the room browser. Camera controls are below the view.');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.ShadowMaterial({opacity:.23}));
  contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=-.34;contactShadow.receiveShadow=true;scene.add(contactShadow);
  const ambient = new THREE.HemisphereLight('#d2ddd6', '#645340', 1.65); scene.add(ambient);
  const key = new THREE.DirectionalLight('#ffdfac', 2.6);
  key.position.set(2, 18, 12); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .035;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#a1becb', 1.4);fill.position.set(4, 8, -12);scene.add(fill);
  const lamplight = new THREE.PointLight('#ffcf83', 10, 9, 2);scene.add(lamplight);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 200);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cameraRig = createCamera(camera, renderer.domElement, motion);
  const scenery = buildScenery(scene, board);
  const avatars = new Map(), roomLabels = [];
  let props = initial, selected = null, disposed = false, elapsed = 0, visibleLabels = true, visiblePlayerNames = true;
  const mapBox = new THREE.Box3(new THREE.Vector3(-board.cols/2-.7,-.7,-board.rows/2-.7),new THREE.Vector3(board.cols/2+.7,3.1,board.rows/2+.7));
  const marker = new THREE.Mesh(new THREE.TorusGeometry(.38,.035,8,32),new THREE.MeshBasicMaterial({color:'#f4d78d',depthTest:false}));
  marker.rotation.x=-Math.PI/2;marker.visible=false;marker.renderOrder=3;scene.add(marker);
  let routeLine = null, pending = null, view = 'orbit', lastWalkSend = 0, lastStep = 0;
  let lastSentPoint = null;
  const held = new Set();
  host.tabIndex = 0;
  host.setAttribute('aria-label', 'Mansion controls. Arrow keys or WASD to walk in character view.');
  function createLabel(text, className, onClick) {
    const element = document.createElement(onClick ? 'button' : 'span');
    element.className = className; element.textContent = text;
    if (onClick) { element.type='button'; element.addEventListener('click', onClick); }
    labelLayer.appendChild(element);return element;
  }
  for (const anchor of scenery.anchors) {
    const element = createLabel(anchor.name, 'world-room-label', () => events.inspect(anchor.name));
    element.setAttribute('aria-label', `Inspect ${anchor.name}`);
    roomLabels.push({...anchor,element});
  }
  function removeRoute() {
    if(routeLine){scene.remove(routeLine);routeLine.geometry.dispose();routeLine.material.dispose();routeLine=null;}
  }
  function preview(target) {
    pending=target;removeRoute();marker.visible=false;
    if (!target || selected) return;
    const self=props.players.find(p=>p.id===props.playerId);
    if(!self)return;
    const endpoint=target.cell?cellPoint(board,target.cell):playerPoint(board,{...self,position:{room:target.room}},props.players);
    marker.position.set(endpoint.x,.2,endpoint.z);marker.visible=true;
    const route=walkingRoute(board,self.position,target,props.players,self.id);
    const start=playerPoint(board,self,props.players);
    const points=[start,...route,endpoint].map(p=>new THREE.Vector3(p.x,.21,p.z));
    routeLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:'#edd29a',dashSize:.2,gapSize:.12,transparent:true,opacity:.9}));
    routeLine.computeLineDistances();scene.add(routeLine);
  }
  function lighting(room) {
    const center=room ? room.box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    key.position.copy(center).add(new THREE.Vector3(4,12,8));key.target.position.copy(center);
    const size=room ? 6 : 21;
    Object.assign(key.shadow.camera,{left:-size,right:size,top:size,bottom:-size,near:.1,far:60});
    key.shadow.camera.updateProjectionMatrix();key.shadow.needsUpdate=true;
    lamplight.intensity=room?9:0;
    if(room)lamplight.position.copy(room.lamp);
    ambient.intensity=room?1.45:1.8;
  }
  function inspect(name, immediate=false) {
    selected=name&&scenery.roomGroups.has(name)?name:null;
    scenery.estate.visible=!selected;contactShadow.visible=!!selected;
    for(const [room,{group}] of scenery.roomGroups)group.visible=!selected||room===selected;
    for(const [id,avatar] of avatars){const player=props.players.find(p=>p.id===id);avatar.group.visible=!selected||player?.position.room===selected;}
    marker.visible=false;removeRoute();
    const room=scenery.roomGroups.get(selected);lighting(room);
    cameraRig.frame(room?.box||mapBox,selected?'room':'map',immediate||!!selected);
    if(selected&&!motion.matches)host.animate([{opacity:.35},{opacity:1}],{duration:320,easing:'ease-out'});
    refreshObjects();
    preview(pending);
    if (view !== 'orbit') cameraRig.setView(view, avatars.get(props.playerId)?.group.position);
  }
  function refreshObjects() {
    events.objects?.(scenery.interactions.map((item,id)=>({id,room:item.room,label:item.kind==='drawer'&&item.open?'Close drawer':item.label})).filter(item=>item.room===selected));
  }
  function interact(id) {
    const item=scenery.interactions[id];if(!item||item.room!==selected)return;
    if(item.kind==='drawer'){item.open=!item.open;sfx.door();}
    else if(item.kind==='piano'){if(item.playingUntil>elapsed)return;item.playingUntil=elapsed+1.8;sfx.piano();}
    else sfx.discovery();
    refreshObjects();
    events.discovery?.({title:item.kind==='drawer'?(item.open?'An old invitation':'Drawer closed'):item.kind==='piano'?'The last waltz':'Behind the portrait',text:item.kind==='drawer'&&!item.open?'You slide the drawer gently shut.':item.text});
  }
  function receiveWalk(pose) {
    const avatar=avatars.get(pose?.playerId), player=props.players.find(p=>p.id===pose?.playerId);
    if(!avatar || player?.position.room!==pose.room || ![pose.x,pose.z,pose.yaw].every(Number.isFinite) || pose.time <= (avatar.poseTime||0))return;
    avatar.poseTime=pose.time;
    if(pose.playerId===props.playerId) {
      if(!avatar.localWalked)avatar.group.position.set(pose.x,.15,pose.z);
    }else avatar.remotePose=pose;
  }
  function turn(avatar, yaw, dt) {
    avatar.body.rotation.y += Math.atan2(Math.sin(yaw-avatar.body.rotation.y),Math.cos(yaw-avatar.body.rotation.y)) * (motion.matches ? 1 : 1-Math.exp(-dt*15));
  }
  function sync(next) {
    props=next;
    for (const player of props.players) {
      let avatar=avatars.get(player.id);
      if(!avatar){avatar=scenery.avatar(player);avatar.element=createLabel(player.name+(player.id===props.playerId?' · You':''),'world-player-label');avatars.set(player.id,avatar);}
      const destination=playerPoint(board,player,props.players);
      const changed=JSON.stringify(avatar.lastPosition)!==JSON.stringify(player.position);
      if(!avatar.lastPosition)avatar.group.position.set(destination.x,.15,destination.z);
      else if(changed){
        avatar.remotePose=null;avatar.poseTime=0;avatar.localWalked=false;
        if(player.id===props.playerId && avatar.lastPosition.room && board.rooms[avatar.lastPosition.room]?.secretPassage===player.position.room){sfx.passage();events.passage?.(player.position.room);}
        const path=walkingRoute(board,avatar.lastPosition,player.position,props.players,player.id);
        if(motion.matches||!path.length){
          avatar.group.position.set(destination.x,.15,destination.z);avatar.route=[];
          if(player.id===props.playerId&&player.position.room)queueMicrotask(()=>{if(!disposed)events.arrived(player.position.room);});
        }else avatar.route=[...path,destination].map(p=>new THREE.Vector3(p.x,.15,p.z));
        if(player.id===props.playerId){removeRoute();marker.visible=false;pending=null;}
      }
      avatar.lastPosition=structuredClone(player.position);
      avatar.ring.visible=player.id===props.currentPlayerId;
      avatar.group.visible=!selected||player.position.room===selected;
      avatar.group.scale.setScalar(player.eliminated ? .8 : 1);
    }
    for(const pose of props.roomWalks || [])receiveWalk(pose);
    for(const [name,floor] of scenery.roomFloors){
      const reachable=props.canMove&&props.reachableRoomSet.has(name);
      floor.material.emissive.set(reachable?'#b18d3b':'#000000');floor.material.emissiveIntensity=reachable ? .16 : 0;
    }
    for(const [cell,tile] of scenery.tiles){
      tile.material=props.canMove&&props.reachableCellSet.has(cell)?scenery.material('#c2aa6c','marble'):tile.userData.baseMaterial;
    }
    for(const label of roomLabels){
      const reachable=props.canMove&&props.reachableRoomSet.has(label.name);
      label.element.classList.toggle('is-reachable',reachable);
      label.element.title=reachable?`${label.name} — reachable this turn`:`Inspect ${label.name}`;
    }
  }
  const resize=()=>{
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height)return;
    renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
    cameraRig.frame(scenery.roomGroups.get(selected)?.box||mapBox,selected?'room':'map',true);
    if (view !== 'orbit') cameraRig.setView(view, avatars.get(props.playerId)?.group.position);
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();sync(initial);inspect(initial.players.find(p=>p.id===initial.playerId)?.position.room||null,true);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let down=null,multi=false;const pointers=new Set();
  function hit(event){
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const targets=selected?[scenery.roomFloors.get(selected)]:scenery.floorTargets;
    const objectHit=selected?raycaster.intersectObjects(scenery.interactions.filter(item=>item.room===selected).map(item=>item.mesh),true)[0]:null;
    if(objectHit){const id=scenery.interactions.findIndex(item=>item.mesh===objectHit.object||item.mesh===objectHit.object.parent);if(id>=0)return {interaction:id};}
    return raycaster.intersectObjects(targets,false)[0]?.object.userData.target;
  }
  function pointerDown(event){pointers.add(event.pointerId);if(pointers.size>1)multi=true;down={x:event.clientX,y:event.clientY};}
  function pointerUp(event){
    pointers.delete(event.pointerId);
    if(multi){if(!pointers.size)multi=false;down=null;return;}
    if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6){down=null;return;}
    down=null;const target=hit(event);if(!target)return;
    // Inspection is never a movement command. Movement requires the action button.
    if(target.interaction!=null)interact(target.interaction);
    else if(target.room&&!selected)events.inspect(target.room);
    else if(!selected&&target.cell&&props.canMove&&props.reachableCellSet.has(`${target.cell.r},${target.cell.c}`)){preview(target);events.chooseCell(target.cell);}
  }
  const cancel=()=>{down=null;multi=false;pointers.clear();};
  const lost=event=>{event.preventDefault();renderer.setAnimationLoop(null);events.failed();};
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointerup',pointerUp);
  renderer.domElement.addEventListener('pointercancel',cancel);
  renderer.domElement.addEventListener('webglcontextlost',lost);
  const keyVectors = { ArrowUp:[0,-1], w:[0,-1], ArrowDown:[0,1], s:[0,1], ArrowLeft:[-1,0], a:[-1,0], ArrowRight:[1,0], d:[1,0] };
  function keyDown(event) {
    if (event.target.closest('input,textarea,select,dialog') || document.querySelector('dialog[open]')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (view !== 'walk') return;
    if(key==='e') {
      const own=avatars.get(props.playerId);if(!own)return;
      const nearby=scenery.interactions.map((item,id)=>({item,id,distance:item.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(own.group.position)})).filter(({item,distance})=>item.room===selected&&distance<2.7).sort((a,b)=>a.distance-b.distance)[0];
      if(nearby&&!event.repeat){event.preventDefault();interact(nearby.id);}return;
    }
    if (key === 'Enter' && pending?.cell && props.canMove && props.reachableCellSet.has(`${pending.cell.r},${pending.cell.c}`)) {
      event.preventDefault(); props.onMoveCell(pending.cell.r,pending.cell.c); preview(null); return;
    }
    if (!keyVectors[key]) return;
    const self=props.players.find(p=>p.id===props.playerId);
    if(self?.position.cell) {
      event.preventDefault();
      if(event.repeat || !props.canMove)return;
      const from=pending?.cell || self.position.cell, [dc,dr]=keyVectors[key];
      const next={r:from.r+dr,c:from.c+dc};
      if(props.reachableCellSet.has(`${next.r},${next.c}`)){preview({cell:next});events.chooseCell(next);}
      return;
    }
    event.preventDefault(); held.add(key);
  }
  function keyUp(event) { held.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key); }
  const clearKeys = () => held.clear();
  host.addEventListener('keydown', keyDown); host.addEventListener('keyup', keyUp);
  host.addEventListener('blur', clearKeys); window.addEventListener('blur', clearKeys);
  renderer.domElement.addEventListener('pointerdown', () => host.focus({preventScroll:true}));
  const collisionRay = new THREE.Raycaster();
  function walk(dt) {
    const avatar = avatars.get(props.playerId), self = props.players.find(p=>p.id===props.playerId);
    if (view !== 'walk' || !avatar || avatar.route.length || !self?.position.room || selected !== self.position.room || document.querySelector('dialog[open]')) return false;
    const movement = new THREE.Vector3();
    for (const key of held) { const vector=keyVectors[key]; if(vector) { movement.x+=vector[0]; movement.z+=vector[1]; } }
    if (!movement.lengthSq()) return false;
    // Directions follow the camera so Up always means away from the viewer.
    const forward = camera.position.clone().sub(cameraRig.controls.target); forward.y=0; forward.normalize();
    const right = new THREE.Vector3(forward.z,0,-forward.x);
    const delta = right.multiplyScalar(movement.x).addScaledVector(forward,movement.z).normalize().multiplyScalar(dt*2.6);
    const room=board.rooms[self.position.room], group=scenery.roomGroups.get(self.position.room).group;
    for(const axis of ['x','z']) {
      const step=new THREE.Vector3(); step[axis]=delta[axis];
      if(!step.lengthSq())continue;
      const next=avatar.group.position.clone().add(step);
      if(next.x<room.rect.c0-board.cols/2+.3 || next.x>room.rect.c1+1-board.cols/2-.3 || next.z<room.rect.r0-board.rows/2+.3 || next.z>room.rect.r1+1-board.rows/2-.3)continue;
      let blocked=false;
      for(const height of [.4,.85]) {
        collisionRay.set(avatar.group.position.clone().add(new THREE.Vector3(0,height,0)),step.clone().normalize());
        collisionRay.far=step.length()+.22;
        if(collisionRay.intersectObject(group,true).length){blocked=true;break;}
      }
      if(!blocked)avatar.group.position.copy(next);
    }
    turn(avatar,Math.atan2(delta.x,delta.z),dt);
    avatar.localWalked=true;
    avatar.legs.forEach((leg,i)=>{leg.rotation.x=motion.matches?0:Math.sin(elapsed*14+i*Math.PI)*.35;});
    return true;
  }
  const clock=new THREE.Clock();
  function project(element,point,visible,rectangles,stack=false){
    if(!visible){element.hidden=true;return;}
    const p=point.clone().project(camera),w=host.clientWidth,h=host.clientHeight;
    const x=(p.x*.5+.5)*w; let y=(-p.y*.5+.5)*h;
    const width=element.offsetWidth||120,height=element.offsetHeight||34;
    const rect={left:x-width/2,right:x+width/2,top:y-height,bottom:y};
    const collides=()=>rectangles.some(r=>rect.left<r.right+5&&rect.right>r.left-5&&rect.top<r.bottom+4&&rect.bottom>r.top-4);
    if(stack)for(let attempt=0;attempt<8&&collides();attempt++) { y-=height+5;rect.top-=height+5;rect.bottom-=height+5; }
    const onScreen=p.z>-1&&p.z<1&&rect.left>4&&rect.right<w-4&&rect.top>6&&rect.bottom<h-58;
    const overlaps=collides();
    element.hidden=!onScreen||overlaps;
    if(!element.hidden){element.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;rectangles.push(rect);}
  }
  renderer.setAnimationLoop(()=>{
    if(disposed)return;
    const dt=Math.min(clock.getDelta(),.05);elapsed+=dt;
    if(document.hidden)return;
    for(const [id,avatar] of avatars){
      if(avatar.route.length){
        const goal=avatar.route[0],delta=goal.clone().sub(avatar.group.position);delta.y=0;
        if(delta.length()<dt*5){avatar.group.position.copy(goal);avatar.route.shift();if(!avatar.route.length&&id===props.playerId){const room=props.players.find(p=>p.id===id)?.position.room;if(room)events.arrived(room);}}
        else{avatar.group.position.addScaledVector(delta.normalize(),dt*5);turn(avatar,Math.atan2(delta.x,delta.z),dt);}
        avatar.body.position.y=motion.matches?0:Math.abs(Math.sin(elapsed*14))*.035;
        avatar.legs.forEach((leg,i)=>{leg.rotation.x=motion.matches?0:Math.sin(elapsed*14+(i%2)*Math.PI)*.3;});
      }else if(avatar.remotePose && id!==props.playerId){
        const pose=avatar.remotePose, target=new THREE.Vector3(pose.x,.15,pose.z), distance=avatar.group.position.distanceTo(target);
        avatar.group.position.lerp(target,motion.matches?1:1-Math.exp(-dt*18));turn(avatar,pose.yaw,dt);
        avatar.legs.forEach((leg,i)=>{leg.rotation.x=distance>.025&&!motion.matches?Math.sin(elapsed*14+i*Math.PI)*.3:0;});
      }else{avatar.body.position.y=0;avatar.legs.forEach(leg=>{leg.rotation.x=0;});}
    }
    walk(dt);
    const ownAvatar=avatars.get(props.playerId);
    if(ownAvatar) {
      cameraRig.follow(ownAvatar.group.position);
      const position=ownAvatar.group.position, self=props.players.find(p=>p.id===props.playerId);
      if(self?.position.room && !ownAvatar.route.length && ownAvatar.localWalked && elapsed-lastWalkSend>.08 && (elapsed-lastWalkSend>1||!lastSentPoint||lastSentPoint.distanceTo(position)>.008)) {
        events.walk?.({room:self.position.room,x:position.x,z:position.z,yaw:ownAvatar.body.rotation.y});
        lastWalkSend=elapsed;lastSentPoint=position.clone();
      }
      const moved=ownAvatar.previousFrame && position.distanceTo(ownAvatar.previousFrame)>.003;
      if(moved && elapsed-lastStep>.32) {sfx.footstep(self?.position.room);lastStep=elapsed;}
      ownAvatar.previousFrame=position.clone();
    }
    for(const door of scenery.doors) {
      const point=door.hinge.getWorldPosition(new THREE.Vector3());
      const nearby=[...avatars.values()].some(avatar=>avatar.group.position.distanceTo(point)<2.4);
      if(nearby && !door.wasNear && selected===door.room)sfx.door();door.wasNear=nearby;
      door.hinge.rotation.y=THREE.MathUtils.lerp(door.hinge.rotation.y,nearby?-1.65:0,motion.matches?1:1-Math.exp(-dt*6));
    }
    for(const item of scenery.interactions) {
      if(item.kind==='drawer'){item.mesh.position.z=THREE.MathUtils.lerp(item.mesh.position.z,item.baseZ+(item.open?.38:0),motion.matches?1:1-Math.exp(-dt*9));item.letter.visible=item.open;}
      if(item.kind==='piano')item.mesh.rotation.z=-.16+(item.playingUntil>elapsed&&!motion.matches?Math.sin(elapsed*16)*.015:0);
    }
    cameraRig.update(dt);renderer.render(scene,camera);
    const occupied=[];
    for(const avatar of avatars.values())project(avatar.element,avatar.group.position.clone().add(new THREE.Vector3(0,1.8,0)),avatar.group.visible&&visiblePlayerNames,occupied,true);
    for(const label of roomLabels)project(label.element,label.point,visibleLabels&&!selected,occupied);
  });
  return {
    sync,receiveWalk,inspect,interact,preview,zoom:cameraRig.zoom,rotate:cameraRig.rotate,reset:cameraRig.reset,
    setView(next) { view=next; held.clear(); cameraRig.setView(next, avatars.get(props.playerId)?.group.position); host.focus({preventScroll:true}); },
    input(key, pressed) { if(pressed)held.add(key);else held.delete(key); },
    labels(value){visibleLabels=value;},
    playerNames(value){visiblePlayerNames=value;},
    dispose(){
      host.removeEventListener('keydown',keyDown);host.removeEventListener('keyup',keyUp);host.removeEventListener('blur',clearKeys);window.removeEventListener('blur',clearKeys);
      disposed=true;renderer.setAnimationLoop(null);observer.disconnect();cameraRig.dispose();
      renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',cancel);renderer.domElement.removeEventListener('webglcontextlost',lost);
      removeRoute();const geometries=new Set(),materials=new Set();
      scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scenery.dispose();renderer.dispose();renderer.domElement.remove();labelLayer.replaceChildren();
    },
  };
  } catch (error) {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }
}
