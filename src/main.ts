import {normalize,defaults,presets,fields} from './config.js';
import {Engine,keymap} from './engine.js';
import {Renderer} from './renderer.js';
import {installPetControls,canvasPoint} from './pet-controls.js';
import {SettingsDraft} from './settings-draft.js';
// The bridge is optional so the same UI can run as a local browser preview.
const native=(window as any).__TAURI__;
const invoke=(name:string,args:any={})=>native.core.invoke(name,args);
const app=document.getElementById('app')!;
const id=new URLSearchParams(location.search).get('pet');
const petId=id==='cat'||id==='dog'?id:null;
let settings=normalize();
const load=async()=>{try{settings=normalize(native?await invoke('get_settings'):JSON.parse(localStorage.getItem('desktop-pets')||'{}'))}catch(e){console.warn('Não foi possível carregar preferências',e)}};
await load();
const el=(tag:string,cls='',text='')=>{const a=document.createElement(tag);if(cls)a.className=cls;if(text)a.textContent=text;return a};
const button=(text:string,fn:()=>void,cls='')=>{const b=el('button',cls,text);b.addEventListener('click',fn);return b};
function message(text:string,error=false){const s=document.getElementById('message');if(s){s.textContent=text;s.classList.toggle('error',error)}}
const panels:any[]=[];
function attach(canvas:HTMLCanvasElement,kind:'cat'|'dog',state:HTMLElement|null){const engine=new Engine(kind==='dog',settings.pets[kind].entrance),renderer=new Renderer(canvas);const entry={canvas,kind,engine,renderer,state,last:0};panels.push(entry);return entry}
const down=new Set<string>();
function localInput(canvas:HTMLCanvasElement,engine:Engine,kind:string){let prev:any=null;canvas.tabIndex=0;canvas.setAttribute('aria-label','Prévia interativa de '+kind);const point=(e:PointerEvent)=>canvasPoint(canvas,e,settings.desktop[kind].mirror)!;
canvas.addEventListener('keydown',e=>{if(!keymap.has(e.code)||e.metaKey||e.ctrlKey||e.code==='Tab')return;e.preventDefault();if(native&&settings.globalInput&&petId)return;engine.mode='idle';if(!down.has(e.code)){down.add(e.code);engine.input({held:[...down],recent:[e.code]})}});
canvas.addEventListener('keyup',e=>{down.delete(e.code);if(!native||!settings.globalInput||!petId)engine.input({held:[...down]})});canvas.addEventListener('blur',()=>{down.clear();if(!native||!settings.globalInput||!petId)engine.input({held:[]})});
canvas.addEventListener('pointermove',e=>{if(native&&settings.globalInput&&petId)return;const p=point(e);engine.mode='idle';engine.input({held:[...down],cursor:p,moved:!!prev,dx:prev?p.x-prev.x:0,dy:prev?p.y-prev.y:0});prev=p});canvas.addEventListener('pointerleave',()=>{prev=null;if(!native||!settings.globalInput||!petId)engine.input({held:[...down],cursor:null})});canvas.addEventListener('pointerdown',e=>{if(e.button!==0||petId&&native)return;canvas.focus();engine.mode='idle';if(!engine.petHead(point(e)))engine.input({held:[...down],clicked:true})})}
let monitors=['Monitor principal'];
if(petId){document.documentElement.classList.add('overlay');const canvas=el('canvas') as HTMLCanvasElement;canvas.width=750;canvas.height=600;app.append(canvas);const p=attach(canvas,petId,null);localInput(canvas,p.engine,petId);
 if(native){const w=native.window.getCurrentWindow();let geom:any=null;let updating=false;async function refresh(){if(updating)return;updating=true;try{const [pos,size]=await Promise.all([w.innerPosition(),w.innerSize()]);geom={x:pos.x,y:pos.y,w:size.width,h:size.height}}catch(e){console.warn(e)}finally{updating=false}}
 await refresh();await installPetControls(canvas,p.renderer,p.engine,native,()=>settings.desktop[petId],()=>geom);setInterval(refresh,1000);w.onMoved(refresh).catch(console.warn);w.onResized(refresh).catch(console.warn);
 await native.event.listen('settings-changed',(e:any)=>{settings=normalize(e.payload);if(!settings.globalInput){p.engine.input({held:[],cursor:null});p.engine.lastMouse=-1e6}refresh()});
 await native.event.listen('pet-input',(e:any)=>{if(!settings.globalInput)return;const s=e.payload;let cursor=null;if(geom&&s.located){let x=(s.x-geom.x)*500/geom.w;cursor={x:settings.desktop[petId].mirror?500-x:x,y:(s.y-geom.y)*400/geom.h}}p.engine.input({...s,dx:s.dx*(geom?500/geom.w:1)*(settings.desktop[petId].mirror?-1:1),dy:s.dy*(geom?400/geom.h:1),cursor})});}
}else{
 const editor=new SettingsDraft(settings);settings=editor.draft;
 if(native){try{monitors=await invoke('list_monitors')}catch(e){console.warn(e)}}
 let edit:'cat'|'dog'=settings.desktop.dog.enabled&&!settings.desktop.cat.enabled?'dog':'cat',tab='appearance';const open=new Set(['Pelagem','Rosto e olhos']);
 const header=el('header','header');const brand=el('div','brand');brand.append(el('span','logo','🐾'),el('div','brandname','Desktop Pets'));header.append(brand,el('span','sub',native?'Configurações · v0.1.0':'Prévia local · v0.1.0'));app.append(header);
 const shell=el('div','shell'),left=el('section','left'),right=el('section','right');shell.append(left,right);app.append(shell);
 left.append(el('h2','','Prévia ao vivo'),el('p','muted','Mova o ponteiro, clique na cabeça para fazer carinho ou clique na prévia e digite. Salve as alterações para aplicar a aparência ao desktop.'));
 const preview=el('div','previews');for(const kind of ['cat','dog'] as const){const card=el('div','preview-card'),canvas=el('canvas') as HTMLCanvasElement;canvas.width=750;canvas.height=600;const line=el('div','preview-line'),name=el('strong','',''),status=el('span','muted','Tranquilo');line.append(name,status);card.append(canvas,line);preview.append(card);const p=attach(canvas,kind,status);p.name=name;localInput(canvas,p.engine,kind)}left.append(preview);
 const meters=el('div','meters');for(const [label,key] of [['Estresse','stress'],['Concentração','focus']]){const line=el('div','meter-label',label),n=el('span','','0%');n.id=key+'-label';line.append(n);const track=el('div','track'),bar=el('div','bar');bar.id=key+'-bar';track.append(bar);meters.append(line,track)}left.append(meters);
 const demos=el('details','group');demos.open=true;demos.append(el('summary','','Testar animações'));const demoList=el('div','buttonlist');for(const [m,label] of Object.entries({intro:'✨ Entrada',idle:'Descansar',normal:'Digitar',fast:'Digitar rápido',two:'Segurar A + L',mouse:'Mouse',mixed:'Mouse + teclado',game:'🎮 Gamer',curious:'👀 Cursor próximo',dance:'🐶 Sambar com mouse',bird:'🐦 Passarinho',rainbow:'🌈 Arco-íris',pet:'💕 Carinho',sleep:'💤 Dormir',panic:'💥 Estresse máximo'}))demoList.append(button(label,()=>{const t=performance.now();panels.forEach(p=>p.engine.demo(m,t));demoList.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.textContent===label))}));demos.append(demoList);left.append(demos);
 const petSelector=el('section','pet-selector'),petButtons=el('div','tabs');
 petSelector.append(el('h3','','Pet na área de trabalho'),petButtons,el('p','muted','Escolha quem aparece no desktop e clique em Salvar alterações para aplicar.'));
 for(const [key,label] of [['cat','Usar gato'],['dog','Usar cachorro'],['both','Usar ambos']]){
  const b=button(label,()=>{settings.desktop.cat.enabled=key!=='dog';settings.desktop.dog.enabled=key!=='cat';if(key!=='both')edit=key as 'cat'|'dog';renderSettings();changed()});
  b.dataset.pet=key;petButtons.append(b);
 }
 const nav=el('nav','tabs'),editNav=el('div','tabs'),content=el('div','content');editNav.setAttribute('aria-label','Animal para personalizar');right.append(petSelector,nav,editNav,content);
 for(const [k,label] of [['appearance','Aparência'],['desktop','Área de trabalho'],['general','Geral'],['profiles','Perfis']])nav.append(button(label,()=>{tab=k;renderSettings()},'tab'));
 for(const k of ['cat','dog'] as const)editNav.append(button(k==='cat'?'🐱 Gato':'🐶 Cachorro',()=>{edit=k;renderSettings()}));
 const bottom=el('footer','footer'),actions=el('div','save-actions');
 const msg=el('span','muted');msg.id='message';msg.setAttribute('role','status');
 const saveButton=button('Salvar alterações',()=>{void saveChanges()},'primary') as HTMLButtonElement;
 const discardButton=button('Descartar alterações',()=>{editor.discard();settings=editor.draft;renderSettings();changed();message('Alterações descartadas.')}) as HTMLButtonElement;
 actions.append(discardButton,saveButton,button('Sair',()=>{if(native)invoke('quit').catch(e=>message(String(e),true));else message('Feche a aba para sair da prévia.')}));bottom.append(msg,actions);app.append(bottom);
 function updateSaveState(){
  saveButton.disabled=editor.saving||!editor.dirty;saveButton.textContent=editor.saving?'Salvando…':'Salvar alterações';discardButton.disabled=editor.saving||!editor.dirty;
  bottom.classList.toggle('has-changes',editor.dirty);
  const active=settings.desktop.cat.enabled?(settings.desktop.dog.enabled?'both':'cat'):(settings.desktop.dog.enabled?'dog':'none');
  petButtons.querySelectorAll('button').forEach(b=>{const selected=b.dataset.pet===active;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});
 }
 function changed(){updateSaveState();message(editor.dirty?'Alterações não salvas. Clique em Salvar alterações para aplicar.':'Nenhuma alteração pendente.')}
 async function saveChanges(){
  if(editor.saving||!editor.dirty)return;
  const saving=editor.save(async(snapshot:any,previous:any)=>{
   let autostartApplied=false;
   try{
    if(native&&snapshot.autostart!==previous.autostart){await invoke('set_autostart',{enabled:snapshot.autostart});autostartApplied=true}
    if(native)await invoke('save_settings',{settings:snapshot});else localStorage.setItem('desktop-pets',JSON.stringify(snapshot));
   }catch(error){
    if(autostartApplied)await invoke('set_autostart',{enabled:previous.autostart}).catch(console.warn);
    throw error;
   }
  });
  updateSaveState();message('Salvando alterações…');
  try{await saving;updateSaveState();message(editor.dirty?'Configurações salvas. Há novas alterações pendentes.':'Configurações salvas e aplicadas.')}
  catch(error){updateSaveState();message('Não foi possível salvar. Suas alterações continuam na prévia: '+error,true)}
 }
 if(native)native.event.listen('input-status',(e:any)=>message(String(e.payload),true));
 function field(obj:any,f:any[],change=changed){const [key,label,type,...args]=f;const labelEl=el('label','field '+(type==='check'?'toggle':type==='color'?'':'wide')),txt=el('span','',label);labelEl.append(txt);let input:any;
 if(type==='select'){input=el('select');for(const [v,t] of Object.entries(args[0])){const o=el('option','',String(t)) as HTMLOptionElement;o.value=v;input.append(o)}input.value=String(obj[key]);labelEl.append(input)}else{input=el('input');input.type=type==='check'?'checkbox':type;if(type==='check'){input.checked=obj[key];labelEl.append(input)}else if(type==='color'){input.value=obj[key];const r=el('div','colorrow'),hex=el('span','mono',obj[key]);r.append(input,hex);input.addEventListener('input',()=>hex.textContent=input.value);labelEl.append(r)}else{[input.min,input.max,input.step]=args;input.value=obj[key];const v=el('output','',String(obj[key]));txt.append(v);input.addEventListener('input',()=>v.textContent=input.value);labelEl.append(input)}}
 input.addEventListener('input',()=>{obj[key]=type==='check'?input.checked:type==='range'||(type==='select'&&typeof obj[key]==='number')?Number(input.value):input.value;change()});return labelEl}
 function group(title:string,obj:any,fs:any[],extra?:HTMLElement){const d=el('details','group') as HTMLDetailsElement;d.open=open.has(title)||tab!=='appearance';d.addEventListener('toggle',()=>d.open?open.add(title):open.delete(title));d.append(el('summary','',title));const wrap=el('div','fields');for(const f of fs)wrap.append(field(obj,f));if(extra){extra.classList.add('wide');wrap.append(extra)}d.append(wrap);return d}
 function renderSettings(){nav.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',['appearance','desktop','general','profiles'][i]===tab));editNav.style.display=tab==='general'?'none':'flex';editNav.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',['cat','dog'][i]===edit));content.replaceChildren();const c=settings.pets[edit],d=settings.desktop[edit];
 if(tab==='appearance'){const list=el('div','buttonlist presets');for(const [name,model] of Object.entries(presets[edit]))list.append(button(name,()=>{settings.pets[edit]=structuredClone(model);renderSettings();changed()},name===c.name?'active':''));content.append(el('h3','','Modelos predefinidos'),list);for(const [title,fs] of fields){const valid=(fs as any[]).filter(f=>edit==='cat'?!['muzzleOn','muzzle','browOn','brow','dance'].includes(f[0]):f[0]!=='whisker');content.append(group(title as string,c,valid,title==='Manchas'?button('Nova distribuição',()=>{c.seed=Math.floor(Math.random()*100000);changed()}):undefined))}content.append(button('Restaurar aparência original',()=>{settings.pets[edit]=structuredClone(defaults.pets[edit]);renderSettings();changed()}));}
 if(tab==='desktop'){content.append(el('h3','','Tamanho e posição independentes'));content.append(group('Exibição',d,[['enabled','Mostrar mascote no desktop','check'],['size','Tamanho (%)','range',40,200,5],['opacity','Opacidade (%)','range',20,100,5],['monitor','Monitor','select',Object.fromEntries(monitors.map((m,i)=>[i,m]))],['margin','Distância da borda (px)','range',0,100,1],['mirror','Espelhar horizontalmente','check'],['top','Sempre no topo','check'],['through','Permitir cliques nas áreas transparentes','check']]));const pos=el('div','positions');for(const [v,s] of Object.entries({tl:'↖',tc:'↑',tr:'↗',ml:'←',mc:'·',mr:'→',bl:'↙',bc:'↓',br:'↘'})){const b=button(s,()=>{d.position=v;renderSettings();changed()},d.position===v?'active':'');b.title=v;pos.append(b)}content.append(el('h3','','Posição na tela'),pos,el('p','muted','Clique com o botão direito no pet para mover, abrir as configurações ou fechar o aplicativo. Você também pode arrastá-lo com o botão esquerdo. O arraste é temporário; a posição acima volta ao salvar ou iniciar.'));}
 if(tab==='general'){content.append(group('Desempenho e privacidade',settings,[['fps','Limite de FPS','select',{15:'15 FPS',30:'30 FPS',60:'60 FPS'}],['economy','Modo econômico em repouso','check'],['globalInput','Capturar teclado e mouse globalmente','check']]));content.append(el('p','muted','A captura global é local. Somente códigos físicos, estado das teclas e posição do mouse são usados em memória; não há histórico, texto digitado nem envio de dados. No Linux, use X11.'));content.append(field(settings,['autostart','Iniciar com o sistema','check']));}
 if(tab==='profiles'){content.append(el('h3','','Exportar e importar aparência'),el('p','muted','Salve quantos perfis JSON quiser e importe em qualquer momento.'));content.append(button('Exportar perfil JSON',()=>{const a=el('a') as HTMLAnchorElement;a.href=URL.createObjectURL(new Blob([JSON.stringify({species:edit,appearance:c},null,2)],{type:'application/json'}));a.download=`desktop-pets-${edit}-${c.name}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}));const file=el('input') as HTMLInputElement;file.type='file';file.accept='.json,application/json';file.onchange=async()=>{try{const p=JSON.parse(await file.files![0].text());if(p.species!==edit||!p.appearance||typeof p.appearance!=='object')throw Error('Perfil incompatível');const base=defaults.pets[edit],out:any={...base};for(const [k,v] of Object.entries(base)){const x=p.appearance[k];if(typeof x!==typeof v)continue;if(typeof v==='string'&&v.startsWith('#')&&!/^#[\da-f]{6}$/i.test(x))continue;if(typeof v==='number'&&!Number.isFinite(x))continue;out[k]=x}settings.pets[edit]=normalize({pets:{[edit]:out}}).pets[edit];renderSettings();changed()}catch(e){message('Perfil inválido: '+e,true)}};content.append(file)}
 }
 renderSettings();changed();
}
function frame(t:number){requestAnimationFrame(frame);if(document.hidden)return;for(const p of panels){const c=settings.pets[p.kind],d=settings.desktop[p.kind];if(!petId&&!p.canvas.isConnected)continue;const e=p.engine;const idle=e.mode==='idle'&&!e.event&&!e.near&&!e.held.length&&!e.keyParticles.length&&e.pet<.01&&e.sleep<.01&&t-e.lastPet>2000&&t-e.lastMouse>3000&&t-e.lastKey>3000&&e.stress<.05;const fps=settings.economy&&idle?Math.min(15,settings.fps):settings.fps;if(t-p.last<1000/fps-2)continue;p.last=t;e.step(t,c);p.renderer.draw(e,c,t,d.mirror);p.canvas.style.opacity=String(d.opacity/100);if(p.state)p.state.textContent=e.status;if(p.name)p.name.textContent=c.name}
 if(!petId){const e=panels[0].engine;for(const k of ['stress','focus']){const pct=Math.round(e[k]*100);document.getElementById(k+'-label')!.textContent=pct+'%';document.getElementById(k+'-bar')!.style.width=pct+'%'}}}
requestAnimationFrame(frame);
