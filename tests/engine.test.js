import test from 'node:test';import assert from 'node:assert/strict';import {Engine,targets,entrance,keymap,bp,KEY_FADE,KEY_FLOAT_LIFETIME,SLEEP_DELAY,PAW_REST_DELAY} from '../src/engine.js';import {normalize,cat,dog} from '../src/config.js';
test('mouse reserva uma pata mesmo com várias teclas; sem mouse as duas digitam',()=>{
 const mixed=targets(['KeyA','KeyL'],['KeyL'],true,true);
 assert.equal(mixed[0].mouse,true);assert.equal(mixed[1].code,'KeyL');
 const typing=targets(['KeyA','KeyL'],[],false,true);
 assert.deepEqual(typing.map(key=>key.code).sort(),['KeyA','KeyL']);assert.ok(typing[0].x<typing[1].x);
});
test('mouse permanece imóvel antes de alcançar e a pata não o abandona para digitar',()=>{
 const e=new Engine(false,false),t=e.last;
 e.input({held:[],moved:true,dx:35,dy:15},t);e.step(t+16,cat);
 assert.equal(e.mx,94);assert.equal(e.my,338);assert.equal(e.grip,false);
 for(let i=2;i<26;i++)e.step(t+i*16,cat);
 assert.ok(e.grip);assert.ok(e.mx>94);
 e.input({held:['KeyA','KeyL'],recent:['KeyA','KeyL']},t+450);e.step(t+466,cat);
 assert.equal(e.grip,true);assert.equal(e.paws[0].x,e.mx);assert.equal(e.paws[0].y,e.my-3);
 e.step(t+1600,cat);assert.equal(e.grip,false);
});
test('samba exige proximidade e não interrompe a pata',()=>{const e=new Engine(true,false),t=e.last;const cfg={...dog,random:false};e.input({held:[],cursor:{x:252,y:130},moved:true},t);for(let i=1;i<36;i++)e.step(t+i*16,cfg);assert.ok(e.dance>.5);assert.ok(e.grip);e.input({held:[],cursor:{x:5,y:5},moved:true},t+600);for(let i=1;i<90;i++)e.step(t+600+i*16,cfg);assert.ok(e.dance<.05)});
test('entrada opaca ao aterrissar',()=>{assert.equal(entrance(-.1).opacity,0);assert.ok(entrance(.4).opacity>0&&entrance(.4).opacity<1);assert.equal(entrance(.72).opacity,1)});
test('configurações independentes e preenchimento de padrões',()=>{const s=normalize({pets:{cat:{coat:'#111111'}}});assert.equal(s.pets.cat.coat,'#111111');assert.equal(s.pets.dog.coat,dog.coat);assert.equal(s.desktop.dog.enabled,false);assert.ok(keymap.has('Semicolon'))});

test('mouse volta ao repouso sem perder contato com a pata durante pausas curtas',()=>{
 const e=new Engine(false,false),t=e.last,cfg={...cat,random:false};
 e.input({moved:true,dx:100,dy:60},t);
 let furthest=94;
 for(let i=1;i<=65;i++){e.step(t+i*16,cfg);furthest=Math.max(furthest,e.mx);if(i>25){assert.equal(e.grip,true);assert.equal(e.paws[0].x,e.mx);assert.equal(e.paws[0].y,e.my-3)}}
 assert.ok(furthest>95);assert.ok(Math.abs(e.mx-94)<.5);assert.ok(Math.abs(e.my-338)<.5);
});

test('movimento do mouse independe da quantidade de eventos recebidos no frame',()=>{
 const a=new Engine(false,false),b=new Engine(false,false),t=a.last;b.last=t;
 a.input({moved:true,dx:40,dy:-20},t);
 for(let i=0;i<8;i++)b.input({moved:true,dx:5,dy:-2.5},t);
 a.step(t+16,cat);b.step(t+16,cat);
 assert.equal(a.tx,b.tx);assert.equal(a.ty,b.ty);
 a.input({moved:true,dx:-80,dy:40},t+16);a.step(t+32,cat);
 assert.ok(a.tx<0);assert.ok(a.ty>0);
});

const advance=(engine,from,until,cfg={...cat,random:false},input=null)=>{for(let t=from+16;t<=until;t+=16){if(input)engine.input(input,t);engine.step(t,cfg)}};

test('olhar acompanha o ponteiro mesmo longe do pet e em direção oposta ao mouse desenhado',()=>{
 for(const isDog of [false,true]){
  const e=new Engine(isDog,false),t=e.last,cfg={...(isDog?dog:cat),random:false};
  e.input({cursor:{x:1000,y:20},moved:true,dx:-100,dy:0},t);
  advance(e,t,t+500,cfg,{cursor:{x:1000,y:20},moved:true,dx:-2});assert.ok(e.mx<94);assert.ok(e.ex>8);assert.ok(e.ey<0);assert.ok(e.hx>0);
  advance(e,t+510,t+1000,cfg,{cursor:{x:-300,y:300},moved:true,dx:2});assert.ok(e.ex<-8);assert.ok(e.hx<0);assert.ok(e.ey>0);
 }
});

test('digitação e mouse juntos centralizam o olhar para baixo; parar cada entrada retoma a outra',()=>{
 for(const isDog of [false,true]){
  const e=new Engine(isDog,false),t=e.last,cfg={...(isDog?dog:cat),random:false};
  advance(e,t,t+400,cfg,{cursor:{x:1000,y:20},moved:true,dx:1});assert.ok(e.ex>8);assert.ok(e.ey<0);
  e.input({held:['KeyP'],recent:['KeyP']},t+410);advance(e,t+410,t+900,cfg);
  assert.ok(e.ex<0);assert.ok(e.hx<0);assert.ok(e.ey>0);
  advance(e,t+910,t+1400,cfg,{cursor:{x:1200,y:0},moved:true,dx:1});
  assert.ok(Math.abs(e.ex)<.1);assert.ok(Math.abs(e.hx)<.1);assert.ok(Math.abs(e.tilt)<.01);assert.ok(e.ey>7);
  e.input({held:['KeyP','KeyQ'],recent:['KeyQ']},t+1410);advance(e,t+1410,t+1900,cfg);
  assert.ok(Math.abs(e.hx-(keymap.get('KeyQ').x-bp(e,252,132).x)*.08)<.3);assert.ok(e.ey>0);
  e.input({held:[]},t+1910);advance(e,t+1910,t+2400,cfg,{cursor:{x:1200,y:0},moved:true,dx:1});
  assert.ok(e.ex>8);assert.ok(e.ey<0);
 }
});

test('toque rápido divide atenção durante a pausa curta e depois volta ao ponteiro',()=>{
 for(const isDog of [false,true]){
  const e=new Engine(isDog,false),t=e.last,cfg={...(isDog?dog:cat),random:false};
  e.input({recent:['KeyP'],cursor:{x:1000,y:0}},t);
  advance(e,t,t+320,cfg,{cursor:{x:1000,y:0},moved:true,dx:1});
  assert.equal(e.recent.length,0);assert.ok(Math.abs(e.ex)<.1);assert.ok(Math.abs(e.hx)<.1);assert.ok(e.ey>7);
  advance(e,t+320,t+850,cfg,{cursor:{x:1000,y:0},moved:true,dx:1});assert.ok(e.ex>8);assert.ok(e.ey<0);
 }
});

test('atenção dividida independe da posição do cursor e funciona sem coordenadas',()=>{
 for(const isDog of [false,true]){
  for(const cursor of [{x:-1000,y:0},{x:1200,y:900},null]){
   const e=new Engine(isDog,false),t=e.last,cfg={...(isDog?dog:cat),random:false};
   e.input({held:['KeyP'],recent:['KeyP']},t);
   advance(e,t,t+800,cfg,{cursor,moved:true,dx:1});
   assert.ok(Math.abs(e.ex)<.1);assert.ok(Math.abs(e.hx)<.1);assert.ok(Math.abs(e.tilt)<.01);assert.ok(e.ey>7);
   // Clicking a stationary mouse must let typing regain the gaze.
   advance(e,t+800,t+1500,cfg,{cursor,clicked:true});
   assert.ok(e.ex<0);assert.ok(e.hx<0);assert.ok(e.ey>0);
  }
 }
});

test('mouse e várias teclas mantêm uma pata em cada dispositivo e escolhem a última tecla digitada',()=>{
 for(const isDog of [false,true]){
  const e=new Engine(isDog,false),t=e.last,cfg={...(isDog?dog:cat),random:false};
  e.input({held:['KeyL','KeyA'],recent:['KeyA','KeyL']},t);
  advance(e,t,t+1200,cfg,{moved:true,dx:1,cursor:{x:450,y:60}});
  assert.equal(e.grip,true);assert.equal(e.paws[0].x,e.mx);assert.equal(e.paws[0].y,e.my-3);
  assert.ok(Math.abs(e.paws[1].x-keymap.get('KeyL').x)<.1);
  assert.ok(Math.abs(e.paws[1].y-keymap.get('KeyL').y+3)<.1);
  e.input({recent:['KeyA']},t+1210);
  advance(e,t+1210,t+2200,cfg,{moved:true,dx:-1,cursor:{x:450,y:60}});
  assert.equal(e.grip,true);assert.equal(e.paws[0].x,e.mx);assert.ok(Math.abs(e.paws[1].x-keymap.get('KeyA').x)<.1);
  advance(e,t+2200,t+4100,cfg);assert.equal(e.grip,false);
  const keys=targets(e.held,[],false,false);
  for(let i=0;i<2;i++){assert.ok(Math.abs(e.paws[i].x-keys[i].x)<.1);assert.ok(Math.abs(e.paws[i].y-keys[i].y)<.1)}
 }
});

test('ponteiro parado e cliques não prendem o olhar; parar o movimento devolve o olhar ao repouso',()=>{
 for(const isDog of [false,true]){
  const e=new Engine(isDog,false),t=e.last,cfg={...(isDog?dog:cat),random:false};
  e.input({cursor:{x:900,y:0}},t);advance(e,t,t+400,cfg);
  assert.equal(e.ex,0);assert.equal(e.ey,0);
  advance(e,t+400,t+1000,cfg,{moved:true,dx:1,cursor:{x:900,y:0}});
  assert.ok(e.ex>8);assert.ok(e.ey<0);
  e.input({clicked:true,cursor:{x:900,y:0}},t+1050);
  advance(e,t+1050,t+1800,cfg,{cursor:{x:900,y:0}});
  assert.ok(Math.abs(e.ex)<.01);assert.ok(Math.abs(e.ey)<.01);assert.ok(Math.abs(e.hx)<.1);
 }
});

test('coluna inclina suavemente para alcançar mouse e teclado e retorna quando ambos param',()=>{
 for(const isDog of [false,true]){
  const e=new Engine(isDog,false),t=e.last,cfg={...(isDog?dog:cat),random:false};
  e.input({held:['KeyL'],recent:['KeyL'],moved:true,dx:1},t);e.step(t+16,cfg);
  assert.ok(e.spine<0&&e.spine>-2);
  advance(e,t+16,t+1000,cfg,{moved:true,dx:-1,cursor:{x:450,y:60}});
  assert.ok(e.spine<-5&&e.spine>-20);assert.equal(e.grip,true);
  assert.ok(bp(e,252,132).x-bp(e,252,303).x<-8);
  e.input({held:[]},t+1010);advance(e,t+1010,t+4000,cfg);
  assert.ok(Math.abs(e.spine)<.01);assert.ok(Math.abs(e.lean)<.01);assert.equal(e.grip,false);
 }
});

test('letras correspondem à tecla, não se acumulam e somem após a animação',()=>{
 const e=new Engine(false,false),t=e.last;
 e.input({recent:['KeyW','Digit2','Enter','Unknown']},t);
 assert.deepEqual(e.keyParticles.map(p=>p.label),['W','2','↵']);
 assert.equal(e.keyParticles[0].x,keymap.get('KeyW').x);
 for(let i=0;i<40;i++)e.input({recent:['KeyA']},t+i);
 assert.equal(e.keyParticles.length,24);
 advance(e,t,t+KEY_FLOAT_LIFETIME+100);assert.equal(e.keyParticles.length,0);
});

test('cor da tecla fica acesa enquanto segurada e desaparece suavemente depois de soltar',()=>{
 const e=new Engine(false,false),t=e.last;
 e.input({held:['KeyW'],recent:['KeyW']},t);advance(e,t,t+2200);
 const released=e.last;e.input({held:[]},released);assert.equal(e.keyGlow('KeyW',released),1);
 assert.ok(e.keyGlow('KeyW',released+KEY_FADE/2)>.1);assert.ok(e.keyGlow('KeyW',released+KEY_FADE/2)<.9);
 assert.equal(e.keyGlow('KeyW',released+KEY_FADE+1),0);
});

test('patas ficam recolhidas na pausa e descem após dois segundos; digitar interrompe o repouso',()=>{
 const e=new Engine(false,false),t=e.last;
 e.input({held:['KeyW'],recent:['KeyW']},t);advance(e,t,t+200);e.input({held:[]},t+210);
 advance(e,t+210,t+1700);assert.equal(e.pawRest,0);assert.ok(e.paws[0].y<280);assert.ok(e.paws[1].y<280);
 advance(e,t+1700,t+PAW_REST_DELAY+1700);assert.equal(e.pawRest,1);assert.ok(e.paws[0].y>290);assert.ok(e.paws[1].y>290);
 e.input({held:['KeyA','KeyL'],recent:['KeyA','KeyL']},e.last+16);advance(e,e.last,e.last+400);
 assert.equal(e.pawRest,0);assert.ok(e.paws[0].y>320);assert.ok(e.paws[1].y>320);
});

test('carinho só reage na cabeça, fecha olhos, levanta a cabeça e relaxa as orelhas',()=>{
 for(const isDog of [false,true]){
  const e=new Engine(isDog,false),t=e.last,cfg={...(isDog?dog:cat),random:false};
  assert.equal(e.petHead({x:252,y:260},t),false);assert.equal(e.petUntil,-1e6);
  assert.equal(e.petHead({x:252,y:130},t),true);advance(e,t,t+500,cfg);
  assert.ok(e.pet>.95);assert.ok(e.eyeOpen<.1);assert.ok(e.hy<-9);assert.ok(e.eL<-.65);assert.ok(e.eR>.65);assert.ok(e.tilt<0);
  advance(e,t+500,t+2800,cfg);assert.ok(e.pet<.01);
 }
});

test('hit test da cabeça acompanha posição e rotação da animação',()=>{
 const e=new Engine(false,false);e.lean=25;e.spine=-12;e.jump=20;e.tilt=.2;e.hx=10;e.hy=-8;
 const pivot=bp(e,252,155),a=e.rock+e.tilt;
 const point={x:pivot.x+e.hx+24*Math.sin(a),y:pivot.y+e.hy-24*Math.cos(a)};
 assert.equal(e.isHead(point),true);assert.equal(e.isHead({x:50,y:350}),false);
});

test('sono chega por inatividade, mesmo com eventos aleatórios, e acorda com mouse, tecla ou carinho',()=>{
 for(const wake of ['mouse','key','pet']){
  const e=new Engine(false,false),t=e.last;
  advance(e,t,t+SLEEP_DELAY-1000,cat);assert.ok(e.sleep<.01);
  advance(e,t+SLEEP_DELAY-1000,t+SLEEP_DELAY+3000,cat);
  assert.ok(e.sleep>.95);assert.ok(e.eyeOpen<.05);assert.equal(e.status,'Dormindo…');assert.equal(e.event,null);
  const at=e.last;
  if(wake==='mouse')e.input({moved:true,cursor:{x:450,y:70}},at);
  if(wake==='key')e.input({held:['KeyW'],recent:['KeyW']},at);
  if(wake==='pet'){const head=bp(e,252,155);assert.equal(e.petHead({x:head.x+e.hx,y:head.y+e.hy-20},at),true)}
  advance(e,at,at+700,cat);assert.ok(e.sleep<.01);
 }
});

test('segurar uma tecla impede o sono e amostras de cursor parado não o adiam',()=>{
 const e=new Engine(false,false),t=e.last;e.input({held:['KeyW'],recent:['KeyW']},t);
 advance(e,t,t+SLEEP_DELAY+2000);assert.ok(e.sleep<.01);
 e.input({held:[]},e.last);const release=e.last;
 for(let time=release+16;time<release+SLEEP_DELAY+2000;time+=16){e.input({cursor:{x:400,y:40}},time);e.step(time,{...cat,random:false})}
 assert.ok(e.sleep>.95);
});
