import test from 'node:test';
import assert from 'node:assert/strict';
import {installPetControls,canvasPoint} from '../src/pet-controls.js';
import {Renderer} from '../src/renderer.js';

class Element extends EventTarget {
 constructor(){super();this.classes=new Set();this.classList={toggle:(key,value)=>value?this.classes.add(key):this.classes.delete(key)}}
 setAttribute(){} after(node){this.hint=node} focus(){} setPointerCapture(id){this.capture=id}
 getBoundingClientRect(){return{left:0,top:0,width:300,height:240}}
 hasPointerCapture(id){return this.capture===id} releasePointerCapture(){this.capture=null}
}
const send=(el,type,props={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,props);el.dispatchEvent(event);return event};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('botão direito, arraste, modo mover e cliques nas áreas transparentes',async()=>{
 const originalWindow=globalThis.window,originalDocument=globalThis.document;
 const canvas=new Element(),doc=new Element(),win=new Element();
 let poll,move,drags=0,menus=0,clicks=0,hit=true,ignored,head=false,pets=0;
 win.setInterval=fn=>{poll=fn;return 1};win.clearInterval=()=>{};doc.createElement=()=>new Element();
 globalThis.window=win;globalThis.document=doc;
 try{
  const native={window:{getCurrentWindow:()=>({setIgnoreCursorEvents:async value=>{ignored=value},startDragging:async()=>{drags++}}),cursorPosition:async()=>({x:150,y:120})},core:{invoke:async name=>{assert.equal(name,'show_pet_menu');menus++}},event:{listen:async(name,fn)=>{assert.equal(name,'move-pet');move=fn}}};
  await installPetControls(canvas,{hitTest:()=>hit},{held:[],isHead:()=>head,petHead:()=>{pets++;return true},input:()=>{clicks++}},native,()=>({through:true}),()=>({x:0,y:0,w:300,h:240}));
  assert.equal(ignored,false);
  send(canvas,'pointerdown',{button:2});assert.equal(drags,0);
  assert.equal(send(canvas,'contextmenu').defaultPrevented,true);await flush();assert.equal(menus,1);assert.equal(drags,0);
  send(canvas,'pointerdown',{button:0,clientX:10,clientY:10,pointerId:1});
  send(canvas,'pointermove',{buttons:1,clientX:12,clientY:11});assert.equal(drags,0);
  send(canvas,'pointerup',{button:0});assert.equal(clicks,1);
  send(canvas,'pointerdown',{button:0,clientX:10,clientY:10,pointerId:2});
  send(canvas,'pointermove',{buttons:1,clientX:20,clientY:10});await flush();assert.equal(drags,1);
  hit=false;await poll();assert.equal(ignored,true);
  move();await flush();assert.equal(canvas.hint.hidden,false);assert.equal(ignored,false);
  await poll();assert.equal(ignored,false);
  send(doc,'keydown',{key:'Escape'});await poll();assert.equal(canvas.hint.hidden,true);assert.equal(ignored,true);
  move();await flush();send(canvas,'pointerdown',{button:0});await flush();assert.equal(drags,2);assert.equal(canvas.hint.hidden,true);
  move();await flush();send(win,'blur');await poll();assert.equal(canvas.hint.hidden,true);
  head=true;
  send(canvas,'pointerdown',{button:0,clientX:150,clientY:80,pointerId:3});
  send(canvas,'pointerup',{button:0,clientX:150,clientY:80});assert.equal(pets,1);assert.equal(clicks,1);
  send(canvas,'pointerdown',{button:0,clientX:150,clientY:80,pointerId:4});
  send(canvas,'pointermove',{buttons:1,clientX:170,clientY:80});await flush();
  send(canvas,'pointerup',{button:0,clientX:170,clientY:80});assert.equal(pets,1);assert.equal(drags,3);
  send(canvas,'pointerdown',{button:2,clientX:150,clientY:80});assert.equal(pets,1);
  send(win,'unload');
 }finally{globalThis.window=originalWindow;globalThis.document=originalDocument}
});

test('coordenadas de carinho respeitam escala do canvas e espelhamento',()=>{
 const canvas={getBoundingClientRect:()=>({left:100,top:50,width:600,height:480})};
 assert.deepEqual(canvasPoint(canvas,{clientX:280,clientY:206}),{x:150,y:130});
 assert.deepEqual(canvasPoint(canvas,{clientX:280,clientY:206},true),{x:350,y:130});
 assert.equal(canvasPoint(canvas,{clientX:NaN,clientY:206}),null);
});

test('hit test respeita pixels transparentes e limites da janela',()=>{
 let alpha=0;
 const renderer=Object.create(Renderer.prototype);renderer.canvas={width:750,height:600,getContext:()=>({getImageData:(x,y)=>{assert.equal(x,375);assert.equal(y,300);return{data:[0,0,0,alpha]}}})};
 assert.equal(renderer.hitTest(-.1,.5),false);assert.equal(renderer.hitTest(1,.5),false);
 assert.equal(renderer.hitTest(.5,.5),false);alpha=255;assert.equal(renderer.hitTest(.5,.5),true);
});
