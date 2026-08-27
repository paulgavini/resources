(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const canvas = $('#simCanvas'), ctx = canvas.getContext('2d');
  const graph = $('#graphCanvas'), gtx = graph.getContext('2d');
  const stage = $('#canvasStage'), mats = window.QUAKE_MATERIALS;
  const PX_PER_M = 100, MM_PER_PX = 1000 / PX_PER_M, GRID = 40, G = 9.81;
  const SURVIVAL_LIMITS = { roofSway: 160, storeyDrift: 80, failureRatio: .25, heightRetention: .65 };
  const SENSOR_COLORS = ['#8d45b5','#168bc4','#d97728','#bf3d67'];
  const state = {
    nodes: [], members: [], masses: [], tool: 'select', material: 'timber', nextId: 1,
    running: false, paused: false, elapsed: 0, last: 0, baseX: 0, zoom: 1, panX: 0, panY: 0,
    pointer: null, startNode: null, hovered: null, selected: null, history: [], future: [],
    maxSway: 0, maxDrift: 0, failed: 0, samples: [], trail: [], initial: null, physics: null, sensors: [], selectedMassId: null,
    view: { grid: true, stress: true, trail: false }
  };

  function snapshot() { const nodes=state.nodes.map(({body,fx,fy,...n})=>n),members=state.members.map(({constraint,...m})=>m);return JSON.stringify({ nodes, members, masses: state.masses, sensors:state.sensors, nextId: state.nextId }); }
  function restore(raw) {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    state.nodes = (d.nodes || []).map(n => ({ ...n, vx: 0, vy: 0, load: 0 }));
    state.members = (d.members || []).map(m => ({ ...m, load: 0, failed: false }));
    state.masses = d.masses || [];state.sensors=(d.sensors||[]).map(normaliseSensor).filter(a=>a&&(a.type==='node'?state.nodes.some(n=>n.id===a.id):state.members.some(m=>m.id===a.id))).slice(0,4);state.selectedMassId=null;state.nextId = d.nextId || 1; updateDesignStats();updateSensorUI();updateMassEditor();draw();
  }
  function commit() { state.history.push(snapshot()); if (state.history.length > 60) state.history.shift(); state.future = []; updateHistory(); }
  function undo() { if (!state.history.length || state.running) return; state.future.push(snapshot()); restore(state.history.pop()); updateHistory(); }
  function redo() { if (!state.future.length || state.running) return; state.history.push(snapshot()); restore(state.future.pop()); updateHistory(); }
  function updateHistory() { $('#undoBtn').disabled = !state.history.length || state.running; $('#redoBtn').disabled = !state.future.length || state.running; }

  function resize() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    graph.width = Math.round(graph.clientWidth * dpr); graph.height = Math.round(graph.clientHeight * dpr); gtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(); drawGraph();
  }
  const groundY = () => stage.clientHeight - 28;
  function worldToScreen(n) { return { x: stage.clientWidth / 2 + state.panX + (n.x + state.baseX) * state.zoom, y: groundY() + state.panY - n.y * state.zoom }; }
  function screenToWorld(x, y) { return { x: (x - stage.clientWidth / 2 - state.panX) / state.zoom - state.baseX, y: (groundY() + state.panY - y) / state.zoom }; }
  function snap(v) { return state.view.grid ? Math.round(v / GRID) * GRID : v; }
  function nodeById(id) { return state.nodes.find(n => n.id === id); }
  function memberById(id) { return state.members.find(m => m.id === id); }
  function normaliseSensor(s){return typeof s==='number'?{type:'node',id:s}:s}
  function attachmentPosition(a,initial=false){if(!a)return null;if(a.type==='node'){const n=nodeById(a.id);return n?{x:initial?n.x0:n.x,y:initial?n.y0:n.y}:null}const m=memberById(a.id);if(!m)return null;const n1=nodeById(m.a),n2=nodeById(m.b),t=Math.max(0,Math.min(1,a.t??.5));if(!n1||!n2)return null;return{x:(initial?n1.x0:n1.x)*(1-t)+(initial?n2.x0:n2.x)*t,y:(initial?n1.y0:n1.y)*(1-t)+(initial?n2.y0:n2.y)*t}}
  function attachmentLabel(a){if(!a)return 'unassigned';return a.type==='node'?'Joint '+a.id:'Member '+a.id+' @ '+Math.round((a.t??.5)*100)+'%'}
  function projectionT(p,m){const a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)return .5;const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy||1;return Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l))}
  function sensorMovementMm(a){const now=attachmentPosition(a),initial=attachmentPosition(a,true);return now&&initial?(now.x-initial.x)*MM_PER_PX:0}
  function effectivePayloadAtNode(nodeId){return state.masses.reduce((sum,m)=>{if(m.node===nodeId)return sum+m.kg;if(m.member){const member=memberById(m.member),t=m.t??.5;if(member?.a===nodeId)return sum+m.kg*(1-t);if(member?.b===nodeId)return sum+m.kg*t}return sum},0)}
  function nearestNode(p, radius = 15) {
    let best = null, dist = radius / state.zoom;
    state.nodes.forEach(n => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < dist) { best = n; dist = d; } }); return best;
  }
  function nearestMember(p, radius = 12) {
    let best = null, bestD = radius / state.zoom;
    state.members.forEach(m => { const a = nodeById(m.a), b = nodeById(m.b); if (!a || !b) return; const d = pointLine(p, a, b); if (d < bestD) { bestD = d; best = m; } }); return best;
  }
  function pointLine(p, a, b) { const dx = b.x-a.x, dy=b.y-a.y, l=dx*dx+dy*dy||1; const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)); return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy)); }
  function addNode(x, y, fixed = false) {
    const close = nearestNode({x,y}, 10); if (close) return close;
    const n = { id: state.nextId++, x: snap(x), y: Math.max(0, snap(y)), x0: snap(x), y0: Math.max(0, snap(y)), vx: 0, vy: 0, fixed, load: 0 };
    if (n.y < GRID / 2) { n.y = n.y0 = 0; n.fixed = true; } state.nodes.push(n); return n;
  }
  function addMember(a, b, type) {
    if (!a || !b || a.id === b.id || state.members.some(m => (m.a===a.id&&m.b===b.id)||(m.a===b.id&&m.b===a.id))) return;
    const length = Math.hypot(b.x-a.x,b.y-a.y); if (length < 10) return;
    state.members.push({ id:state.nextId++, a:a.id,b:b.id,type,material:state.material,rest:length,load:0,failed:false });
  }
  function draw() {
    const w=stage.clientWidth,h=stage.clientHeight; ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#17383d';ctx.fillRect(0,groundY()-2,w,6);ctx.fillStyle='#d8ef78';for(let x=18;x<w;x+=44)ctx.fillRect(x,groundY()+4,20,2);
    if(state.view.trail&&state.trail.length>1){ctx.beginPath();state.trail.forEach((p,i)=>{const s=worldToScreen(p);i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y)});ctx.strokeStyle='rgba(8,127,120,.25)';ctx.lineWidth=2;ctx.stroke()}
    ctx.save(); ctx.lineCap='round';
    state.members.forEach(m=>{
      const a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)return;const A=worldToScreen(a),B=worldToScreen(b),mat=mats[m.material];
      let color=mat.color;if(m.failed)color='#c84e4e';else if(state.view.stress&&m.load>.75)color='#e05b42';else if(state.view.stress&&m.load>.45)color='#e6a43e';
      ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.strokeStyle='rgba(10,39,42,.14)';ctx.lineWidth=(m.type==='floor'?13:m.type==='brace'?7:10)*state.zoom+3;ctx.stroke();
      ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.setLineDash(m.type==='brace'?[7,4]:[]);ctx.strokeStyle=color;ctx.lineWidth=(m.type==='floor'?9:m.type==='brace'?4:6)*state.zoom;ctx.stroke();ctx.setLineDash([]);
      if(m.failed){const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;ctx.fillStyle='#fff';ctx.strokeStyle='#c84e4e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(mx,my,8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#c84e4e';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText('!',mx,my+4)}
    });
    state.nodes.forEach(n=>{const p=worldToScreen(n);ctx.beginPath();ctx.arc(p.x,p.y,n===state.selected?7:5,0,Math.PI*2);ctx.fillStyle=n.fixed?'#d8ef78':'#fff';ctx.fill();ctx.strokeStyle=n.load>.8?'#c84e4e':'#163b40';ctx.lineWidth=2.5;ctx.stroke();if(n.fixed){ctx.beginPath();ctx.moveTo(p.x-8,p.y+8);ctx.lineTo(p.x+8,p.y+8);ctx.strokeStyle='#17373b';ctx.lineWidth=2;ctx.stroke()}});
    state.masses.forEach(m=>{const pos=m.member?attachmentPosition({type:'member',id:m.member,t:m.t}):attachmentPosition({type:'node',id:m.node});if(!pos)return;const p=worldToScreen(pos);if(m.id===state.selectedMassId){ctx.strokeStyle='#d8ef78';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(p.x-20,p.y-29,40,23,6);ctx.stroke()}ctx.fillStyle='#102f34';ctx.beginPath();ctx.roundRect(p.x-17,p.y-26,34,17,4);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 8px sans-serif';ctx.fillText(m.kg+' kg',p.x,p.y-15)});
    state.sensors.forEach((sensor,i)=>{const pos=attachmentPosition(sensor);if(!pos)return;const p=worldToScreen(pos),color=SENSOR_COLORS[i];ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillText('S'+(i+1),p.x,p.y+3)});
    if(state.pointer&&state.startNode&&['beam','brace'].includes(state.tool)){const a=worldToScreen(state.startNode),b=state.pointer;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=mats[state.material].color;ctx.lineWidth=4;ctx.setLineDash([7,5]);ctx.stroke();ctx.setLineDash([])}
    ctx.restore();
  }

  function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
  canvas.addEventListener('pointerdown',e=>{
    if(state.running)return;canvas.setPointerCapture(e.pointerId);const s=pointerPos(e),p=screenToWorld(s.x,s.y);state.pointer={...s,id:e.pointerId,origin:s};
    const node=nearestNode(p),member=nearestMember(p);
    if(['beam','brace'].includes(state.tool)){commit();state.startNode=node||addNode(p.x,p.y);draw();return}
    if(state.tool==='joint'){commit();state.selected=addNode(p.x,p.y);afterEdit();return}
    if(state.tool==='floorJoint'){commit();state.selected=addNode(p.x,0,true);state.selected.y=state.selected.y0=0;state.selected.fixed=true;afterEdit();toast('Fixed floor joint added to the shake table.');return}
    if(state.tool==='mass'){if(node||member){let selected;if(node){selected=state.masses.find(x=>x.node===node.id);if(!selected){commit();selected={id:state.nextId++,node:node.id,kg:500};state.masses.push(selected)}}else{const t=projectionT(p,member);selected=state.masses.find(x=>x.member===member.id&&Math.abs((x.t??.5)-t)<.08);if(!selected){commit();selected={id:state.nextId++,member:member.id,t,kg:500};state.masses.push(selected)}}state.selectedMassId=selected.id;afterEdit();updateMassEditor();toast(selected.member?'Beam mass selected; its load is distributed to the endpoints.':'Joint mass selected.')}else toast('Tap a joint or structural member to add or select a mass.');return}
    if(state.tool==='sensor'){if(node||member){const attachment=node?{type:'node',id:node.id}:{type:'member',id:member.id,t:projectionT(p,member)},existing=state.sensors.findIndex(a=>a.type===attachment.type&&a.id===attachment.id&&(a.type==='node'||Math.abs((a.t??.5)-attachment.t)<.06));if(existing>-1){$('#graphMetric').value='sensor'+(existing+1);updateSensorUI();toast('Sensor '+(existing+1)+' selected.')}else if(state.sensors.length<4){state.sensors.push(attachment);state.selected=node||member;$('#graphMetric').value='sensor'+state.sensors.length;updateSensorUI();toast('Sensor '+state.sensors.length+' attached to '+attachmentLabel(attachment)+'.')}else toast('Four sensors are already placed. Delete a sensor from the live panel first.');draw()}else toast('Tap a joint or structural member to attach the sensor.');return}
    if(state.tool==='delete'){if(node||member){commit();if(node){const removedMembers=state.members.filter(m=>m.a===node.id||m.b===node.id).map(m=>m.id);state.nodes=state.nodes.filter(n=>n.id!==node.id);state.members=state.members.filter(m=>!removedMembers.includes(m.id));state.masses=state.masses.filter(m=>m.node!==node.id&&!removedMembers.includes(m.member));state.sensors=state.sensors.filter(a=>!(a.type==='node'&&a.id===node.id)&&!(a.type==='member'&&removedMembers.includes(a.id)))}else{state.members=state.members.filter(m=>m.id!==member.id);state.masses=state.masses.filter(m=>m.member!==member.id);state.sensors=state.sensors.filter(a=>!(a.type==='member'&&a.id===member.id))}if(!state.masses.some(m=>m.id===state.selectedMassId))state.selectedMassId=null;updateMassEditor();updateSensorUI();afterEdit()}return}
    if(state.tool==='select'&&node){commit();state.selected=node;state.pointer.dragNode=node;return}
    if(state.tool==='pan')state.pointer.panStart={x:state.panX,y:state.panY};
    else state.selected=node||member;draw();
  });
  canvas.addEventListener('pointermove',e=>{if(!state.pointer)return;const s=pointerPos(e),p=screenToWorld(s.x,s.y);if(state.pointer.dragNode){state.pointer.dragNode.x=snap(p.x);state.pointer.dragNode.y=Math.max(0,snap(p.y));state.pointer.dragNode.fixed=state.pointer.dragNode.y===0;draw()}else if(state.pointer.panStart){state.panX=state.pointer.panStart.x+s.x-state.pointer.origin.x;state.panY=state.pointer.panStart.y+s.y-state.pointer.origin.y;draw()}else{state.pointer.x=s.x;state.pointer.y=s.y;draw()}});
  canvas.addEventListener('pointerup',e=>{
    if(!state.pointer)return;const s=pointerPos(e),p=screenToWorld(s.x,s.y);
    if(state.startNode){let end=nearestNode(p);if(!end)end=addNode(p.x,p.y);addMember(state.startNode,end,state.tool);state.startNode=null;afterEdit()}
    else if(state.pointer.dragNode)afterEdit();state.pointer=null;draw();
  });
  canvas.addEventListener('pointercancel',()=>{state.pointer=null;state.startNode=null;draw()});
  function afterEdit(){state.nodes.forEach(n=>{n.x0=n.x;n.y0=n.y});$('#canvasTip').hidden=state.nodes.length>0;updateDesignStats();draw();}

  function setTool(tool){if(state.running)return;state.tool=tool;$$('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));const labels={select:['SELECT / MOVE','Drag joints to adjust your structure'],joint:['ADD JOINT','Tap the grid to place a movable joint'],floorJoint:['ADD FLOOR JOINT','Tap anywhere to anchor a joint to the shake table'],beam:['DRAW BEAM','Drag between two joints'],brace:['DRAW BRACE','Add diagonal stability'],mass:['ADD PAYLOAD','Tap a joint or any position along a member'],sensor:['PLACE SENSOR','Tap joints or members to place up to four sensors'],delete:['DELETE','Tap a joint or member'],pan:['PAN VIEW','Drag the workspace']};$('#modeLabel').textContent=labels[tool][0];$('#modeHint').textContent=labels[tool][1];}
  $$('.tool').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  document.addEventListener('keydown',e=>{if(/input|select/i.test(e.target.tagName))return;const map={v:'select',j:'joint',g:'floorJoint',b:'beam',r:'brace',m:'mass',s:'sensor',d:'delete',h:'pan'};if(map[e.key.toLowerCase()])setTool(map[e.key.toLowerCase()]);if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();e.shiftKey?redo():undo()}});

  function initMaterials(){
    $('#materials').innerHTML=Object.entries(mats).map(([k,m])=>`<button class="material ${k===state.material?'active':''}" data-material="${k}"><i style="background:${m.color}"></i>${m.name}</button>`).join('');
    $$('.material').forEach(b=>b.onclick=()=>{state.material=b.dataset.material;$$('.material').forEach(x=>x.classList.toggle('active',x===b));renderProperties()});renderProperties();
  }
  function renderProperties(){const m=mats[state.material], rows=[['Strength',m.strength],['Stiffness',m.stiffness],['Weight',m.weight],['Damping',m.damping]];$('#propertyBars').innerHTML=rows.map(([n,v])=>`<span>${n}</span><span class="bar"><i style="width:${v*100}%"></i></span><strong>${v>.75?'High':v>.45?'Medium':'Low'}</strong>`).join('')+`<span>Cost</span><span class="bar"><i style="width:${m.cost/30*100}%"></i></span><strong>$${m.cost}/m</strong>`;$('#materialSummary').textContent=m.name.toLowerCase()+' · $'+m.cost+'/m';$('#materialCost').innerHTML='$'+m.cost+' <small>/ metre equivalent</small>'}
  function updateDesignStats(){let cost=0,mass=0;state.members.forEach(x=>{const m=mats[x.material],a=nodeById(x.a),b=nodeById(x.b);if(a&&b){const len=Math.hypot(a.x-b.x,a.y-b.y)/PX_PER_M;cost+=m.cost*Math.max(.5,len);mass+=m.density*len*10}});state.masses.forEach(x=>mass+=x.kg);$('#costOut').textContent='$'+Math.round(cost);$('#memberOut').textContent=state.members.length;$('#massOut').textContent=Math.round(mass)+' kg';const maxY=Math.max(0,...state.nodes.map(n=>n.y));$('#heightLabel').textContent=(maxY/PX_PER_M).toFixed(1)+' m';}
  function updateMassEditor(){const mass=state.masses.find(m=>m.id===state.selectedMassId),section=$('#massEditorSection');section.hidden=!mass;if(!mass)return;$('#massValue').value=mass.kg;$('#massLocation').textContent=mass.member?`Member ${mass.member} @ ${Math.round((mass.t??.5)*100)}%`:`Joint ${mass.node}`;$('#massMinus').disabled=state.running||mass.kg<=100;$('#massPlus').disabled=state.running||mass.kg>=5000;$('#massValue').disabled=state.running;$('#massRemove').disabled=state.running;}
  function changeSelectedMass(value){if(state.running)return;const mass=state.masses.find(m=>m.id===state.selectedMassId);if(!mass)return;const next=Math.max(100,Math.min(5000,Math.round(Number(value)/100)*100));commit();mass.kg=next;updateMassEditor();updateDesignStats();draw();toast('Mass updated to '+next+' kg.');}
  function removeSelectedMass(){if(state.running)return;const mass=state.masses.find(m=>m.id===state.selectedMassId);if(!mass)return;commit();state.masses=state.masses.filter(m=>m.id!==mass.id);state.selectedMassId=null;updateMassEditor();updateDesignStats();draw();toast('Mass removed.');}
  function updateSensorUI(){
    $('#sensorToolLabel').textContent='Sensors '+state.sensors.length+'/4';
    const metric=$('#graphMetric');[1,2,3,4].forEach(i=>{const option=metric.querySelector(`option[value="sensor${i}"]`);if(option)option.disabled=i>state.sensors.length});
    const box=$('#sensorMeasurements');
    if(!state.sensors.length){box.innerHTML='<p>Select <b>Sensor</b>, then tap up to four joints.</p>';if(metric.value.startsWith('sensor'))metric.value='roof';$('#graphKey').textContent='Roof displacement';return}
    if(metric.value.startsWith('sensor')&&+metric.value.slice(6)>state.sensors.length)metric.value='sensor'+state.sensors.length;
    box.innerHTML=state.sensors.map((sensor,i)=>`<div class="sensor-slot" style="--sensor-color:${SENSOR_COLORS[i]}"><button class="sensor-reading ${metric.value==='sensor'+(i+1)?'active':''}" data-sensor-index="${i}"><small>S${i+1} · ${attachmentLabel(sensor)} · relative Δx</small><b id="sensorValue${i+1}">0.0 <em>mm</em></b></button><button class="sensor-remove" data-remove-sensor="${i}" title="Remove sensor ${i+1}" aria-label="Remove sensor ${i+1}">×</button></div>`).join('');
    $$('[data-sensor-index]').forEach(b=>b.onclick=()=>{metric.value='sensor'+(+b.dataset.sensorIndex+1);updateSensorUI();drawGraph()});
    $$('[data-remove-sensor]').forEach(b=>b.onclick=()=>{if(state.running)return;commit();state.sensors.splice(+b.dataset.removeSensor,1);updateSensorUI();draw();drawGraph()});
    updateGraphLabel();
  }
  function updateGraphLabel(){const key=$('#graphMetric').value,names={roof:'Roof displacement',table:'Table displacement',accel:'Table acceleration'};const i=key.startsWith('sensor')?+key.slice(6)-1:-1;$('#graphKey').textContent=i>-1?`Sensor ${i+1}: ${attachmentLabel(state.sensors[i])} relative Δx (mm)`:names[key];$$('.sensor-reading').forEach((b,j)=>b.classList.toggle('active',j===i));}

  function resetPhysics(keepSamples=false){state.running=false;state.paused=false;state.elapsed=0;state.baseX=0;state.maxSway=0;state.maxDrift=0;state.failed=0;state.trail=[];state.physics=null;if(!keepSamples)state.samples=[];state.nodes.forEach(n=>{n.x=n.x0;n.y=n.y0;n.vx=n.vy=n.load=0;delete n.body});state.members.forEach(m=>{m.failed=false;m.load=0;delete m.constraint});$('#startBtn').innerHTML='<span>▶</span> Start test';$('#pauseBtn').textContent='Pause';$('#pauseBtn').disabled=true;setControlsDisabled(false);updateLive(0,0,0);updateHistory();draw();drawGraph();}
  function createMatterModel(){
    const M=window.Matter,engine=M.Engine.create({positionIterations:12,velocityIterations:10,constraintIterations:6});
    engine.gravity.x=0;engine.gravity.y=.72;engine.gravity.scale=.001;
    const group=M.Body.nextGroup(true),bodies=[];
    const ground=M.Bodies.rectangle(0,12,4000,24,{isStatic:true,friction:.9,restitution:.02,label:'Shake table ground'});
    state.nodes.forEach(n=>{const payload=effectivePayloadAtNode(n.id);const connected=state.members.filter(m=>m.a===n.id||m.b===n.id);const structural=connected.reduce((s,m)=>s+mats[m.material].density,0);const body=M.Bodies.circle(n.x,-n.y,5,{isStatic:n.fixed,frictionAir:.015,restitution:.05,collisionFilter:{group},label:'Joint '+n.id});if(!n.fixed)M.Body.setMass(body,Math.max(1,structural+payload/100));n.body=body;bodies.push(body)});
    const constraints=[];state.members.forEach(m=>{const mat=mats[m.material],a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)return;const stiffness=Math.min(.98,.18+mat.stiffness*.72)*(m.type==='brace'?.88:1);m.constraint=M.Constraint.create({bodyA:a.body,bodyB:b.body,length:m.rest,stiffness,damping:.025+mat.damping*.075,label:'Member '+m.id});constraints.push(m.constraint)});
    M.Composite.add(engine.world,[ground,...bodies,...constraints]);state.physics={engine,M,ground};
  }
  function startTest(){if(state.nodes.length<2||state.members.length<1){toast('Build a connected frame before starting the test.');return}resetPhysics();state.initial=snapshot();createMatterModel();state.running=true;state.last=performance.now();$('#startBtn').innerHTML='<span>■</span> Testing…';$('#startBtn').disabled=true;$('#pauseBtn').disabled=false;setControlsDisabled(true);$('#modeLabel').textContent='EARTHQUAKE TEST';$('#modeHint').textContent='Matter.js constraint simulation in progress';requestAnimationFrame(tick)}
  function tick(now){if(!state.running)return;const dt=Math.min(.025,(now-state.last)/1000||.016);state.last=now;if(!state.paused){simulate(dt);state.elapsed+=dt;const dur=+$('#duration').value;if(state.elapsed>=dur){state.elapsed=dur;finishTest();return}}draw();drawGraph();requestAnimationFrame(tick)}
  function simulate(dt){
    const amplitudeMm=+$('#amplitude').value,A=amplitudeMm/MM_PER_PX,f=+$('#frequency').value,w=2*Math.PI*f,t=state.elapsed;state.baseX=A*Math.sin(w*t);const tableAccel=-amplitudeMm*w*w*Math.sin(w*t)/1000/G;
    const {M,engine,ground}=state.physics,damping=+$('#damping').value/100;
    M.Body.setPosition(ground,{x:state.baseX,y:12},true);
    state.nodes.forEach(n=>{n.load=0;if(n.fixed)M.Body.setPosition(n.body,{x:n.x0+state.baseX,y:-n.y0},true);else n.body.frictionAir=.006+damping*.18});
    M.Engine.update(engine,dt*1000);
    state.nodes.forEach(n=>{if(n.fixed){n.x=n.x0;n.y=n.y0;n.vx=n.vy=0}else{n.x=n.body.position.x-state.baseX;n.y=-n.body.position.y;n.vx=n.body.velocity.x;n.vy=-n.body.velocity.y}});
    state.members.forEach(m=>{if(m.failed)return;const a=nodeById(m.a),b=nodeById(m.b),mat=mats[m.material];if(!a||!b)return;const ax=a.body.position.x,ay=a.body.position.y,bx=b.body.position.x,by=b.body.position.y,len=Math.hypot(bx-ax,by-ay);const deformation=Math.abs(len-m.rest)/m.rest;const threshold=.025+mat.strength*.055;m.load=deformation/threshold;a.load=Math.max(a.load,m.load);b.load=Math.max(b.load,m.load);if(m.load>1){m.failed=true;state.failed++;M.Composite.remove(engine.world,m.constraint);toast('Component failed at '+state.elapsed.toFixed(1)+' s')}});
    const roof=state.nodes.reduce((a,n)=>n.y0>a.y0?n:a,state.nodes[0]),roofMovementMm=roof?(roof.x-roof.x0)*MM_PER_PX:0,roofSway=Math.abs(roofMovementMm);let drift=0,previousLevelMovement=0;const levels=[...new Set(state.nodes.map(n=>n.y0).filter(y=>y>0))].sort((a,b)=>a-b);levels.forEach(y=>{const ns=state.nodes.filter(n=>Math.abs(n.y0-y)<10);if(ns.length){const movement=ns.reduce((s,n)=>s+(n.x-n.x0)*MM_PER_PX,0)/ns.length;drift=Math.max(drift,Math.abs(movement-previousLevelMovement));previousLevelMovement=movement}});state.maxSway=Math.max(state.maxSway,roofSway);state.maxDrift=Math.max(state.maxDrift,drift);const sensorMovements=[0,1,2,3].map(i=>sensorMovementMm(state.sensors[i]));if(roof&&state.view.trail&&Math.floor(t*30)%2===0){state.trail.push({x:roof.x,y:roof.y});if(state.trail.length>180)state.trail.shift()}if(!state.samples.length||t-state.samples.at(-1).t>.045)state.samples.push({t,roof:roofMovementMm,sensor1:sensorMovements[0],sensor2:sensorMovements[1],sensor3:sensorMovements[2],sensor4:sensorMovements[3],table:state.baseX*MM_PER_PX,accel:tableAccel});updateLive(roofSway,drift,Math.abs(tableAccel),sensorMovements);
  }
  function updateLive(sway,drift,accel,sensorMovements=[0,0,0,0]){$('#elapsed').textContent=state.elapsed.toFixed(1)+' / '+$('#duration').value+' s';$('#roofSway').innerHTML=Math.round(sway)+' <em>mm</em>';$('#storeyDrift').innerHTML=Math.round(drift)+' <em>mm</em>';$('#failures').textContent=state.failed;$('#liveAccel').innerHTML=accel.toFixed(2)+' <em>g</em>';$('#tableReadout').textContent='displacement '+Math.round(state.baseX*MM_PER_PX)+' mm';$('#swayBar').style.width=Math.min(100,sway/1.2)+'%';$('#driftBar').style.width=Math.min(100,drift/0.8)+'%';$('#failureBar').style.width=Math.min(100,state.failed*20)+'%';$('#accelBar').style.width=Math.min(100,accel*100)+'%';sensorMovements.forEach((v,i)=>{const out=$('#sensorValue'+(i+1));if(out)out.innerHTML=(v<0?'−':'')+Math.abs(v).toFixed(1)+' <em>mm</em>'})}
  function finishTest(){state.running=false;state.paused=false;setControlsDisabled(false);$('#startBtn').disabled=false;$('#pauseBtn').disabled=true;$('#startBtn').innerHTML='<span>▶</span> Retest';$('#modeLabel').textContent='TEST COMPLETE';$('#modeHint').textContent='Review results, then modify and retest';updateHistory();const initialHeight=Math.max(1,...state.nodes.map(n=>n.y0)),currentHeight=Math.max(0,...state.nodes.map(n=>n.y)),heightRetention=currentHeight/initialHeight,failureRatio=state.failed/Math.max(1,state.members.length),reasons=[];if(state.maxSway>SURVIVAL_LIMITS.roofSway)reasons.push('roof sway exceeded '+SURVIVAL_LIMITS.roofSway+' mm');if(state.maxDrift>SURVIVAL_LIMITS.storeyDrift)reasons.push('storey drift exceeded '+SURVIVAL_LIMITS.storeyDrift+' mm');if(failureRatio>SURVIVAL_LIMITS.failureRatio)reasons.push('more than 25% of members failed');if(heightRetention<SURVIVAL_LIMITS.heightRetention)reasons.push('structure lost more than 35% of its original height');const collapsed=reasons.length>0;$('#resultIcon').textContent=collapsed?'!':'✓';$('#resultIcon').style.background=collapsed?'#f8dfdc':'#dff3df';$('#resultIcon').style.color=collapsed?'#b84040':'#28834a';$('#resultTitle').textContent=collapsed?'Structure needs revision':'Structure survived';$('#resultText').textContent=collapsed?'The model exceeded one or more simplified classroom response limits.':'All four simplified classroom survival checks remained within their limits.';$('#resultReason').textContent=collapsed?'Reason: '+reasons.join('; ')+'.':'Passed: roof sway ≤ 160 mm, storey drift ≤ 80 mm, failed members ≤ 25%, and at least 65% of original height retained.';$('#rSway').textContent=Math.round(state.maxSway)+' mm';$('#rDrift').textContent=Math.round(state.maxDrift)+' mm';$('#rAccel').textContent=calcPeakG().toFixed(2)+' g';$('#rFailures').textContent=state.failed;$('#rCost').textContent=$('#costOut').textContent;$('#rDuration').textContent=state.elapsed.toFixed(1)+' s';$('#resultsDialog').showModal()}
  function setControlsDisabled(v){['amplitude','frequency','duration','damping'].forEach(id=>$('#'+id).disabled=v);$$('.tool,.material,.sensor-remove').forEach(x=>x.disabled=v);updateMassEditor();}
  function calcPeakG(){const A=+$('#amplitude').value/1000,f=+$('#frequency').value;return Math.pow(2*Math.PI*f,2)*A/G}
  function updateSettings(){const amp=+$('#amplitude').value,f=+$('#frequency').value,d=+$('#duration').value,dam=+$('#damping').value;$('#ampOut').textContent=amp+' mm';$('#freqOut').textContent=f.toFixed(2)+' Hz';$('#durationOut').textContent=d+' s';$('#dampingOut').textContent=dam+'%';$('#accelOut').textContent=calcPeakG().toFixed(2)+' g';if(!state.running)$('#elapsed').textContent='0.0 / '+d+' s'}

  function drawGraph(){const w=graph.clientWidth,h=graph.clientHeight;if(!w)return;gtx.clearRect(0,0,w,h);gtx.strokeStyle='#dce4e1';gtx.lineWidth=1;for(let i=1;i<4;i++){gtx.beginPath();gtx.moveTo(25,i*h/4);gtx.lineTo(w-5,i*h/4);gtx.stroke()}gtx.strokeStyle='#9ba9a6';gtx.beginPath();gtx.moveTo(25,5);gtx.lineTo(25,h-17);gtx.lineTo(w-5,h-17);gtx.stroke();if(!state.samples.length)return;const key=$('#graphMetric').value,dur=Math.max(+$('#duration').value,state.samples.at(-1).t),vals=state.samples.map(s=>s[key]),max=Math.max(1,...vals.map(Math.abs));gtx.beginPath();state.samples.forEach((s,i)=>{const x=25+s.t/dur*(w-34),y=(h-17)/2-s[key]/max*(h-27)/2;i?gtx.lineTo(x,y):gtx.moveTo(x,y)});gtx.strokeStyle='#087f78';gtx.lineWidth=2;gtx.stroke();gtx.fillStyle='#7a8986';gtx.font='8px sans-serif';gtx.fillText('0',14,h-13);gtx.fillText(dur.toFixed(0)+'s',w-20,h-5)}

  function fitView(){if(!state.nodes.length)return;const minX=Math.min(...state.nodes.map(n=>n.x)),maxX=Math.max(...state.nodes.map(n=>n.x)),maxY=Math.max(...state.nodes.map(n=>n.y));state.zoom=Math.min(1.5,(stage.clientWidth-100)/Math.max(240,maxX-minX),(stage.clientHeight-90)/Math.max(240,maxY));state.panX=-(minX+maxX)/2*state.zoom;state.panY=-10;$('#zoomLabel').textContent=Math.round(state.zoom*100)+'%';draw()}
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2400)}
  function download(name,type,data){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function save(){const cleanNodes=state.nodes.map(({vx,vy,fx,fy,load,body,...n})=>n),cleanMembers=state.members.map(({constraint,load,failed,...m})=>m);const data={version:1,nodes:cleanNodes,beams:cleanMembers,members:cleanMembers,masses:state.masses,metadata:{name:'QuakeLab design',saved:new Date().toISOString(),units:'canvas millimetre equivalents',sensors:state.sensors}};download('quakelab-design.json','application/json',JSON.stringify(data,null,2));toast('Design saved as JSON.')}
  function loadFile(file){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result),savedSensors=d.metadata?.sensors||(d.metadata?.sensorNodeId?[d.metadata.sensorNodeId]:[]);commit();restore({nodes:d.nodes,members:d.members||d.beams,masses:d.masses,sensors:savedSensors,nextId:Math.max(1,...[...(d.nodes||[]),...(d.members||d.beams||[]),...(d.masses||[])].map(x=>x.id||0))+1});state.nodes.forEach(n=>{n.x0=n.x;n.y0=n.y});fitView();toast('Design loaded.')}catch(e){toast('That file is not a valid QuakeLab design.')}};r.readAsText(file)}
  function exportCSV(){const lines=['time_s,sensor_1_mm,sensor_2_mm,sensor_3_mm,sensor_4_mm,roof_displacement_mm,table_displacement_mm,table_acceleration_g',...state.samples.map(s=>[s.t.toFixed(3),s.sensor1.toFixed(2),s.sensor2.toFixed(2),s.sensor3.toFixed(2),s.sensor4.toFixed(2),s.roof.toFixed(2),s.table.toFixed(2),s.accel.toFixed(4)].join(','))];download('quakelab-results.csv','text/csv',lines.join('\n'));}

  $('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;$('#clearBtn').onclick=()=>{if(state.running)return;commit();state.nodes=[];state.members=[];state.masses=[];state.selected=null;state.selectedMassId=null;state.sensors=[];updateMassEditor();updateSensorUI();$('#canvasTip').hidden=false;afterEdit()};
  $('#massMinus').onclick=()=>{const m=state.masses.find(m=>m.id===state.selectedMassId);if(m)changeSelectedMass(m.kg-100)};$('#massPlus').onclick=()=>{const m=state.masses.find(m=>m.id===state.selectedMassId);if(m)changeSelectedMass(m.kg+100)};$('#massValue').onchange=e=>changeSelectedMass(e.target.value);$('#massRemove').onclick=removeSelectedMass;
  $('#startBtn').onclick=startTest;$('#pauseBtn').onclick=()=>{state.paused=!state.paused;$('#pauseBtn').textContent=state.paused?'Resume':'Pause';state.last=performance.now()};$('#resetTestBtn').onclick=()=>{resetPhysics();$('#startBtn').disabled=false;setTool('select')};
  ['amplitude','frequency','duration','damping'].forEach(id=>$('#'+id).addEventListener('input',updateSettings));
  $('#graphMetric').onchange=()=>{updateGraphLabel();drawGraph()};
  $('#gridToggle').onchange=e=>{state.view.grid=e.target.checked;stage.classList.toggle('grid-off',!e.target.checked)};$('#stressToggle').onchange=e=>{state.view.stress=e.target.checked;draw()};$('#trailToggle').onchange=e=>{state.view.trail=e.target.checked;if(!e.target.checked)state.trail=[];draw()};
  $('#zoomIn').onclick=()=>{state.zoom=Math.min(2,state.zoom+.1);$('#zoomLabel').textContent=Math.round(state.zoom*100)+'%';draw()};$('#zoomOut').onclick=()=>{state.zoom=Math.max(.5,state.zoom-.1);$('#zoomLabel').textContent=Math.round(state.zoom*100)+'%';draw()};$('#fitBtn').onclick=fitView;
  $('#saveBtn').onclick=save;$('#loadBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=e=>e.target.files[0]&&loadFile(e.target.files[0]);$('#newBtn').onclick=()=>{$('#clearBtn').click()};$('#exportBtn').onclick=exportCSV;$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('#resultsDialog').addEventListener('close',()=>{resetPhysics(true);$('#startBtn').disabled=false;setTool('select');toast('Design mode restored — modify the structure and retest.');});
  window.addEventListener('resize',resize);initMaterials();updateSettings();updateDesignStats();updateMassEditor();updateSensorUI();resize();
})();
