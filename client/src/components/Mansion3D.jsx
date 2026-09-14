import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildScenery, ROOM_STORIES } from './mansion3d/scenery';
import { playerPoint, walkingRoute } from './mansion3d/navigation';
import './mansion3d/mansion3d.css';

export default function Mansion3D(props) {
  const {board,players,playerId,currentPlayerId,canMove,reachableRoomSet,reachableCellSet,onMoveRoom,onMoveCell,onFallback} = props;
  const mount=useRef(null), runtime=useRef(null), latest=useRef(props);
  const [selected,setSelected]=useState(null),[hovered,setHovered]=useState(''),[failed,setFailed]=useState(false),[ready,setReady]=useState(false),[labels,setLabels]=useState(true);
  latest.current=props;
  // Broadcasts replace the board object; rebuild only when its geometry changes.
  const boardKey=JSON.stringify(board);
  useEffect(()=>{
    const host=mount.current;
    let renderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'}); }
    catch { setFailed(true);return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    renderer.setClearColor('#10231f');
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label','Interactive 3D mansion. Drag to orbit, scroll or pinch to zoom. Use room controls below for keyboard movement.');
    renderer.domElement.setAttribute('role','img');
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.fog=new THREE.Fog('#10231f',120,190);
    scene.add(new THREE.HemisphereLight('#d2e7e0','#423520',2.2));
    const sun=new THREE.DirectionalLight('#ffe1aa',3.1);sun.position.set(-12,25,10);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:70});sun.shadow.bias=-.001;scene.add(sun);
    const rim=new THREE.DirectionalLight('#9abedb',1.8);rim.position.set(12,12,-18);scene.add(rim);
    const camera=new THREE.PerspectiveCamera(40,1,.1,220);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.09;controls.enablePan=false;
    controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.43;controls.minDistance=7;controls.maxDistance=110;
    const scenery=buildScenery(scene,board), avatars=new Map();
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    controls.enableDamping=!motion.matches;
    let cameraGoal=null,initialized=false,disposed=false,cameraMode="overview";
    const overview=()=>{
      const aspect=host.clientWidth/Math.max(host.clientHeight,1);
      const halfFov=Math.min(THREE.MathUtils.degToRad(20),Math.atan(Math.tan(THREE.MathUtils.degToRad(20))*aspect));
      const distance=19.5/Math.sin(halfFov);
      return new THREE.Vector3(.62,.87,.75).normalize().multiplyScalar(distance);
    };
    function view(mode,point) {
      cameraMode=mode;
      const target=point?new THREE.Vector3(point.x,0,point.z):new THREE.Vector3();
      const position=mode==='top'?new THREE.Vector3(0,overview().length(),.1):point?target.clone().add(new THREE.Vector3(7,10,9)):overview();
      if(motion.matches){camera.position.copy(position);controls.target.copy(target);cameraGoal=null;}
      else cameraGoal={position,target};
    }
    function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(!initialized||cameraMode==='overview'){cameraGoal=null;camera.position.copy(overview());controls.target.set(0,0,0);initialized=true;}else if(cameraMode==='top'){view('top');}}
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null,multiGesture=false;const pointers=new Set();
    function hit(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(scenery.floorTargets,false)[0]?.object.userData.target;}
    function pointerDown(event){pointers.add(event.pointerId);if(pointers.size>1)multiGesture=true;down={x:event.clientX,y:event.clientY};cameraGoal=null;}
    function pointerMove(event){const target=hit(event),p=latest.current;const allowed=target&&(target.room?p.reachableRoomSet.has(target.room):p.reachableCellSet.has(`${target.cell.r},${target.cell.c}`));renderer.domElement.style.cursor=allowed&&p.canMove?'pointer':'grab';setHovered(target?.room || '');}
    function pointerUp(event){pointers.delete(event.pointerId);if(multiGesture){if(pointers.size===0)multiGesture=false;down=null;return;}if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6){down=null;return;}down=null;const target=hit(event),p=latest.current;if(!target)return;if(target.room){setSelected(target.room);if(p.canMove&&p.reachableRoomSet.has(target.room))p.onMoveRoom(target.room);}else if(p.canMove&&p.reachableCellSet.has(`${target.cell.r},${target.cell.c}`))p.onMoveCell(target.cell.r,target.cell.c);}
    function cancel(){down=null;pointers.clear();multiGesture=false;}
    function loseContext(event){event.preventDefault();setFailed(true);renderer.setAnimationLoop(null);}
    renderer.domElement.addEventListener('pointerdown',pointerDown);
    renderer.domElement.addEventListener('pointermove',pointerMove);
    renderer.domElement.addEventListener('pointerup',pointerUp);
    renderer.domElement.addEventListener('pointercancel',cancel);
    renderer.domElement.addEventListener('webglcontextlost',loseContext);
    controls.addEventListener('start',()=>{cameraGoal=null;});
    const clock=new THREE.Clock();
    let elapsed=0;
    function syncPlayers(p){
      for(const player of p.players){
        let avatar=avatars.get(player.id);if(!avatar){avatar=scenery.avatar(player);avatars.set(player.id,avatar);}
        const destination=playerPoint(board,player,p.players);
        const changed=JSON.stringify(avatar.lastPosition)!==JSON.stringify(player.position);
        if(!avatar.lastPosition){avatar.group.position.set(destination.x,.15,destination.z);}
        else if(changed){
          const path=walkingRoute(board,avatar.lastPosition,player.position,p.players,player.id);
          if(motion.matches||!path.length){avatar.group.position.set(destination.x,.15,destination.z);avatar.route=[];}
          else avatar.route=[...path,destination].map(point=>new THREE.Vector3(point.x,.15,point.z));
        } else if(!avatar.route.length){avatar.group.position.set(destination.x,.15,destination.z);}
        avatar.lastPosition=structuredClone(player.position);
        avatar.ring.visible=player.id===p.currentPlayerId;
        avatar.label.visible=player.id===p.playerId;
        avatar.group.scale.setScalar(player.eliminated ? .78 : 1);
      }
    }
    function highlights(p){
      for(const [name,floor] of scenery.roomFloors){const active=p.canMove&&p.reachableRoomSet.has(name);floor.material.emissive.set(active?'#e8bd54':'#000000');floor.material.emissiveIntensity=active ? .32 : 0;}
      for(const [key,tile] of scenery.tiles){const active=p.canMove&&p.reachableCellSet.has(key);tile.material=active?scenery.material('#d8ba6e',true):scenery.material(board.cells[Number(key.split(',')[0])][Number(key.split(',')[1])].type==='door'?'#c9a963':(Number(key.split(',')[0])+Number(key.split(',')[1]))%2?'#4b6055':'#637365');}
    }
    runtime.current={view,scene,camera,controls,avatars,scenery,syncPlayers,highlights,labels:true};
    syncPlayers(latest.current);highlights(latest.current);
    renderer.setAnimationLoop(()=>{
      if(disposed)return;
      const dt=Math.min(clock.getDelta(),.05);elapsed+=dt;
      if(document.hidden)return;
      if(cameraGoal){const a=1-Math.exp(-dt*6);camera.position.lerp(cameraGoal.position,a);controls.target.lerp(cameraGoal.target,a);if(camera.position.distanceTo(cameraGoal.position)<.025)cameraGoal=null;}
      for(const avatar of avatars.values()){
        if(avatar.route.length){const goal=avatar.route[0],delta=goal.clone().sub(avatar.group.position);delta.y=0;const distance=delta.length(),step=dt*7;if(distance<=step){avatar.group.position.copy(goal);avatar.route.shift();}else{avatar.group.position.addScaledVector(delta.normalize(),step);avatar.body.rotation.y=Math.atan2(delta.x,delta.z);}
          avatar.body.position.y=motion.matches?0:Math.abs(Math.sin(elapsed*17))*.07;
          avatar.legs.forEach((leg,i)=>{leg.rotation.x=motion.matches?0:Math.sin(elapsed*17+(i%2)*Math.PI)*.4;});
        }else{avatar.body.position.y=0;avatar.legs.forEach(leg=>{leg.rotation.x=0;});}
        avatar.label.position.copy(avatar.group.position).add(new THREE.Vector3(0,1.9,0));
      }
      controls.update();renderer.render(scene,camera);
    });
    setReady(true);
    return ()=>{
      disposed=true;runtime.current=null;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();
      renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',cancel);renderer.domElement.removeEventListener('webglcontextlost',loseContext);
      const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const m of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){materials.add(m);if(m.map)textures.add(m.map);}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());scenery.dispose();renderer.dispose();renderer.domElement.remove();
    };
    // boardKey deliberately represents geometry, independent of socket broadcasts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[boardKey]);
  useEffect(()=>{runtime.current?.syncPlayers(latest.current);runtime.current?.highlights(latest.current);},[players,currentPlayerId,playerId,canMove,reachableRoomSet,reachableCellSet]);
  function inspect(name){setSelected(name);const room=board.rooms[name];if(room){const {r0,r1,c0,c1}=room.rect;runtime.current?.view('room',{x:(c0+c1+1)/2-board.cols/2,z:(r0+r1+1)/2-board.rows/2});}}
  function findMe(){const player=players.find(p=>p.id===playerId);if(player)runtime.current?.view('room',playerPoint(board,player,players));}
  function toggleLabels(){const value=!labels;setLabels(value);runtime.current?.scenery.labels.forEach(label=>{if(![...runtime.current.avatars.values()].some(a=>a.label===label))label.visible=value;});}
  const story=ROOM_STORIES[selected];
  const destinations=canMove?[...reachableCellSet].filter(key=>board.cells[Number(key.split(',')[0])]?.[Number(key.split(',')[1])]?.type==='corridor'):[];
  return <div className="mansion-3d">
    <div className="mansion-3d-canvas" ref={mount} />
    {!ready&&!failed&&<div className="scene-loading">Lighting the candles…</div>}
    {failed&&<div className="scene-loading"><p>3D isn’t available in this browser.</p><button onClick={onFallback}>Continue with the illustrated board</button></div>}
    <div className="scene-badge"><span /> LIVE MANSION <small>3D</small></div>
    <div className="scene-camera" aria-label="Camera controls">
      <button onClick={()=>runtime.current?.view('overview')} title="Reset camera">Overview</button>
      <button onClick={()=>runtime.current?.view('top')} title="View directly from above">Top view</button>
      <button onClick={findMe}>Find me</button>
      <button onClick={toggleLabels} aria-pressed={labels}>Labels</button>
    </div>
    {hovered&&<div className="scene-hover">{hovered}{canMove&&reachableRoomSet.has(hovered)?' · Click to enter':' · Click to inspect'}</div>}
    <div className="scene-bottom">
      {selected&&story&&<div className="room-inspector"><button className="inspector-close" onClick={()=>setSelected(null)} aria-label="Close room details">×</button><span className="eyebrow">{story[0]}</span><h3>{selected}</h3><p>{story[1]}</p><div className="inspector-actions"><button onClick={()=>inspect(selected)}>Look closer ↗</button>{canMove&&reachableRoomSet.has(selected)&&<button onClick={()=>onMoveRoom(selected)}>Enter room →</button>}</div>{board.rooms[selected]?.secretPassage&&<small>Secret passage ↔ {board.rooms[selected].secretPassage}</small>}</div>}
      <div className="scene-nav"><label><span className="sr-only">Inspect a room</span><select aria-label="Inspect a room" value={selected||''} onChange={e=>inspect(e.target.value)}><option value="">Explore a room…</option>{Object.keys(board.rooms).map(name=><option key={name}>{name}</option>)}</select></label>
        {canMove&&<label><span className="sr-only">Choose a legal destination</span><select aria-label="Choose a legal destination" value="" onChange={e=>{const value=e.target.value;if(value.startsWith('room:'))onMoveRoom(value.slice(5));else if(value){const [r,c]=value.split(',').map(Number);onMoveCell(r,c);}}}><option value="">Move to…</option>{[...reachableRoomSet].map(name=><option key={name} value={`room:${name}`}>{name}</option>)}{destinations.map(key=><option key={key} value={key}>Corridor {key.split(',').map(Number).map(n=>n+1).join(', ')}</option>)}</select></label>}
        <span className="scene-gesture">Drag to orbit · Scroll / pinch to zoom</span>
      </div>
    </div>
  </div>;
}
