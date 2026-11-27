// Native menus can extend beyond the transparent pet window, including at screen edges.
export function canvasPoint(canvas,event,mirror=false){
 const r=canvas.getBoundingClientRect();
 if(!r.width||!r.height||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return null;
 const x=(event.clientX-r.left)*500/r.width;
 return{x:mirror?500-x:x,y:(event.clientY-r.top)*400/r.height};
}
export async function installPetControls(canvas, renderer, engine, native, getDesktop, getGeometry) {
 const w=native.window.getCurrentWindow();
 const hint=document.createElement('div');
 hint.className='move-hint';hint.hidden=true;hint.setAttribute('role','status');
 hint.textContent='Arraste o pet para mover · Esc cancela';canvas.after(hint);
 let moving=false,dragging=false,menuOpen=false,pending=null,ignored=null,polling=false,disposed=false;
 async function ignore(value){if(ignored===value)return;await w.setIgnoreCursorEvents(value);ignored=value}
 function moveMode(value){moving=value;hint.hidden=!value;canvas.classList.toggle('moving',value)}
 async function drag(){
  pending=null;dragging=true;
  try{await ignore(false);await w.startDragging()}
  catch(e){console.warn('Não foi possível mover o pet',e)}
  finally{dragging=false;moveMode(false)}
 }
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  canvas.focus({preventScroll:true});engine.mode='idle';
  if(moving){void drag();return}
  const point=canvasPoint(canvas,e,getDesktop().mirror);
  pending={x:e.clientX,y:e.clientY,id:e.pointerId,point,head:engine.isHead(point)};canvas.setPointerCapture(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pending||!(e.buttons&1)||Math.hypot(e.clientX-pending.x,e.clientY-pending.y)<4)return;
  if(canvas.hasPointerCapture(pending.id))canvas.releasePointerCapture(pending.id);
  void drag();
 });
 canvas.addEventListener('pointerup',e=>{
  if(e.button===0&&pending){
   const point=canvasPoint(canvas,e,getDesktop().mirror)||pending.point;
   if(!pending.head||!engine.petHead(point))engine.input({held:engine.held,clicked:true});
   pending=null;
  }
 });
 canvas.addEventListener('pointercancel',()=>{pending=null});
 canvas.addEventListener('contextmenu',async e=>{
  e.preventDefault();pending=null;moveMode(false);menuOpen=true;
  try{await ignore(false);await native.core.invoke('show_pet_menu')}
  catch(error){console.warn('Não foi possível abrir o menu do pet',error)}
  finally{menuOpen=false}
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){pending=null;moveMode(false)}});
 window.addEventListener('blur',()=>{pending=null;moveMode(false)});
 await native.event.listen('move-pet',()=>{
  moveMode(true);void ignore(false).catch(console.warn);canvas.focus({preventScroll:true});
 });
 async function updateHitTest(){
  if(polling||disposed)return;polling=true;
  try{
   if(moving||dragging||menuOpen||pending||!getDesktop().through){await ignore(false);return}
   const geom=getGeometry();if(!geom)return;
   const cursor=await native.window.cursorPosition();
   const hit=renderer.hitTest((cursor.x-geom.x)/geom.w,(cursor.y-geom.y)/geom.h);
   await ignore(!hit);
  }catch(e){
   // Keep the context menu reachable when a platform cannot report its cursor.
   await ignore(false).catch(console.warn);
  }finally{polling=false}
 }
 await updateHitTest();
 const timer=window.setInterval(updateHitTest,50);
 window.addEventListener('unload',()=>{disposed=true;window.clearInterval(timer)});
}
