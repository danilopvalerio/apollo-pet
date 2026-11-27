#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde::Serialize;
use serde_json::{json, Value};
use std::{collections::HashSet, fs, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, thread, time::Duration};
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, WindowEvent, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use tauri_plugin_autostart::ManagerExt;

struct State { settings: Mutex<Value>, enabled: Arc<AtomicBool> }
#[derive(Default, Clone, Serialize)]
struct Input { held: HashSet<String>, recent: Vec<String>, x: f64, y: f64, dx: f64, dy: f64, moved: bool, clicked: bool, located: bool }
fn key_code(k: rdev::Key) -> Option<String> {
    let s = format!("{:?}", k);
    if (s.starts_with("Key") && s.len()==4) || (s.starts_with("Num") && s.len()==4) {
        return Some(if s.starts_with("Num") {format!("Digit{}", &s[3..])} else {s});
    }
    Some(match s.as_str() {"Return"=>"Enter","BackSpace"=>"Backspace","LeftArrow"=>"ArrowLeft","RightArrow"=>"ArrowRight","UpArrow"=>"ArrowUp","DownArrow"=>"ArrowDown","Alt"=>"AltLeft","AltGr"=>"AltRight","BackQuote"=>"Backquote","SemiColon"=>"Semicolon","Dot"=>"Period","LeftBracket"=>"BracketLeft","RightBracket"=>"BracketRight","Space"|"Tab"|"CapsLock"|"ShiftLeft"|"ShiftRight"|"ControlLeft"|"ControlRight"|"MetaLeft"|"MetaRight"|"Minus"|"Equal"|"Quote"|"BackSlash"|"Comma"|"Slash"=>s.as_str(),"IntlBackslash"=>"IntlBackslash",_=>return None}.replace("BackSlash","Backslash"))
}
fn input_worker(app: tauri::AppHandle, enabled: Arc<AtomicBool>) {
    let state=Arc::new(Mutex::new(Input::default()));
    let source=state.clone(); let flag=enabled.clone(); let report=app.clone();
    thread::spawn(move || {
        #[cfg(target_os="linux")]
        if std::env::var("XDG_SESSION_TYPE").unwrap_or_default().eq_ignore_ascii_case("wayland") { let _=report.emit("input-status", "Wayland: captura global indisponível. Use uma sessão X11."); return; }
        if let Err(e)=rdev::listen(move |ev| {
            if !flag.load(Ordering::Relaxed) { return; }
            if let Ok(mut s)=source.lock() { match ev.event_type {
                rdev::EventType::KeyPress(k)=> { if let Some(c)=key_code(k) { if s.held.insert(c.clone()) && s.recent.len()<64 {s.recent.push(c);} } },
                rdev::EventType::KeyRelease(k)=> {if let Some(c)=key_code(k) {s.held.remove(&c);}},
                rdev::EventType::MouseMove{x,y}=>{if s.located {s.dx+=x-s.x;s.dy+=y-s.y;} s.x=x;s.y=y;s.located=true;s.moved=true;},
                rdev::EventType::ButtonPress(_)=>{s.clicked=true;}, _=>{}
            }}
        }) { let _=report.emit("input-status",format!("Falha ao iniciar captura global: {:?}",e)); }
    });
    thread::spawn(move || {let mut previous_held=HashSet::new(); let mut ticks=0u32; loop {
        thread::sleep(Duration::from_millis(33));
        if let Ok(mut s)=state.lock() {
            if !enabled.load(Ordering::Relaxed) {*s=Input::default();continue;}
            ticks=ticks.wrapping_add(1); let changed=s.moved||s.clicked||!s.recent.is_empty()||s.held!=previous_held||ticks%30==0;
            // Também envia uma amostra vazia após a última soltura; sem persistência de eventos.
            if changed {let _=app.emit("pet-input", &*s); previous_held=s.held.clone();}
            s.dx=0.;s.dy=0.;s.moved=false;s.clicked=false;s.recent.clear();
        }
    }});
}
fn settings_path(app:&tauri::AppHandle)->Result<std::path::PathBuf,String>{let dir=app.path().app_config_dir().map_err(|e|e.to_string())?;fs::create_dir_all(&dir).map_err(|e|e.to_string())?;Ok(dir.join("settings.json"))}
fn show_settings(app:&tauri::AppHandle){if let Some(w)=app.get_webview_window("settings"){let _=w.show();let _=w.set_focus();}}
fn apply(app:&tauri::AppHandle,s:&Value)->Result<(),String>{
 for (i,id) in ["cat","dog"].iter().enumerate(){
  let w=app.get_webview_window(id).ok_or("Janela ausente")?;let p=&s["desktop"][*id];
  let enabled=p["enabled"].as_bool().unwrap_or(i==0);
  if !enabled {w.hide().map_err(|e|e.to_string())?;continue;}
  let monitors=w.available_monitors().map_err(|e|e.to_string())?;
  let index=p["monitor"].as_u64().unwrap_or(0) as usize;
  let m=monitors.get(index).or_else(||monitors.first()).ok_or("Monitor indisponível")?;
  let sc=m.scale_factor();let scale=p["size"].as_f64().unwrap_or(100.).clamp(40.,200.)/100.;
  let area=m.work_area();let ww=(300.*scale*sc).round().min(area.size.width as f64) as u32;let hh=(240.*scale*sc).round().min(area.size.height as f64) as u32;
  let margin=(p["margin"].as_f64().unwrap_or(0.).clamp(0.,100.)*sc).round() as i32;
  let pos=p["position"].as_str().unwrap_or(if i==0{"br"}else{"bl"});
  let aw=area.size.width as i32;let ah=area.size.height as i32;let dx=(aw-ww as i32).max(0);let dy=(ah-hh as i32).max(0);
  let x=if pos.ends_with('l'){margin.min(dx)}else if pos.ends_with('r'){(dx-margin).max(0)}else{dx/2};
  let y=if pos.starts_with('t'){margin.min(dy)}else if pos.starts_with('b'){(dy-margin).max(0)}else{dy/2};
  w.set_size(PhysicalSize::new(ww,hh)).map_err(|e|e.to_string())?;
  w.set_position(PhysicalPosition::new(area.position.x+x,area.position.y+y)).map_err(|e|e.to_string())?;
  w.set_always_on_top(p["top"].as_bool().unwrap_or(true)).map_err(|e|e.to_string())?;
  w.set_ignore_cursor_events(p["through"].as_bool().unwrap_or(true)).map_err(|e|e.to_string())?;
  w.show().map_err(|e|e.to_string())?;
 }
 Ok(())
}
#[tauri::command] fn get_settings(state:tauri::State<State>)->Value{state.settings.lock().unwrap().clone()}
#[tauri::command] fn save_settings(app:tauri::AppHandle,state:tauri::State<State>,settings:Value)->Result<(),String>{
 if !settings.is_object(){return Err("Configurações inválidas".into());}
 let p=settings_path(&app)?;let content=serde_json::to_vec_pretty(&settings).map_err(|e|e.to_string())?;
 fs::write(p,content).map_err(|e|e.to_string())?;
 *state.settings.lock().map_err(|e|e.to_string())?=settings.clone();state.enabled.store(settings["globalInput"].as_bool().unwrap_or(true),Ordering::Relaxed);
 app.emit("settings-changed",&settings).map_err(|e|e.to_string())?;apply(&app,&settings)
}
#[tauri::command] fn list_monitors(app:tauri::AppHandle)->Result<Vec<String>,String>{let w=app.get_webview_window("settings").ok_or("Janela ausente")?;Ok(w.available_monitors().map_err(|e|e.to_string())?.iter().enumerate().map(|(i,m)|format!("{} · {} ({}×{})",i+1,m.name().map(|s|s.as_str()).unwrap_or("Monitor"),m.size().width,m.size().height)).collect())}
#[tauri::command] fn set_autostart(app:tauri::AppHandle,enabled:bool)->Result<(),String>{let a=app.autolaunch();if enabled{a.enable()}else{a.disable()}.map_err(|e|e.to_string())}
#[tauri::command] fn quit(app:tauri::AppHandle){app.exit(0)}
fn main(){tauri::Builder::default()
 .plugin(tauri_plugin_single_instance::init(|app,_,_|show_settings(app)))
 .plugin(tauri_plugin_autostart::Builder::new().args(["--background"]).build())
 .invoke_handler(tauri::generate_handler![get_settings,save_settings,list_monitors,set_autostart,quit])
 .setup(|app|{
  let handle=app.handle().clone();let s=settings_path(&handle).ok().and_then(|p|fs::read(p).ok()).and_then(|b|serde_json::from_slice::<Value>(&b).ok()).filter(Value::is_object).unwrap_or_else(||json!({}));
  let enabled=Arc::new(AtomicBool::new(s["globalInput"].as_bool().unwrap_or(true)));app.manage(State{settings:Mutex::new(s.clone()),enabled:enabled.clone()});
  let settings=MenuItem::with_id(app,"settings","Configurações",true,None::<&str>)?;let exit=MenuItem::with_id(app,"exit","Sair",true,None::<&str>)?;let menu=Menu::with_items(app,&[&settings,&exit])?;
  let mut tray=TrayIconBuilder::new().menu(&menu).tooltip("Desktop Pets").on_menu_event(|app,e|match e.id.as_ref(){"settings"=>show_settings(app),"exit"=>app.exit(0),_=>{}});
  if let Some(icon)=app.default_window_icon(){tray=tray.icon(icon.clone());}tray.build(app)?;
  if let Err(e)=apply(&handle,&s){eprintln!("{e}");}
  if std::env::args().any(|x|x=="--background"){if let Some(w)=app.get_webview_window("settings"){let _=w.hide();}}
  input_worker(handle,enabled);Ok(())
 }).on_window_event(|w,e|{if w.label()=="settings"{if let WindowEvent::CloseRequested{api,..}=e{api.prevent_close();let _=w.hide();}}})
 .run(tauri::generate_context!()).expect("Falha ao iniciar Desktop Pets");}
