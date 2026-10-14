import { currentRoute } from "../community/postAddress";
import { bucketWidth, classifyLabel, screenOf, type Action, type UxEvent } from "./model";
import { studyEnabled } from "./config";
import { restoreStudySession } from "./session";
export { studyEnabled } from "./config";

// New version: old opt-in/opt-out choices are not reused as an auto-recorded visit.
const key = "voku-ux-study-v2";
let raw: string | null = null;
try { raw = sessionStorage.getItem(key); } catch { /* Private browsing can deny storage. */ }
const session = restoreStudySession(raw, location.hostname === "localhost" || location.hostname === "127.0.0.1" || new URLSearchParams(location.search).get("ux_test") === "1");
let dispose: (()=>void) | undefined;
let buffer: UxEvent[] = [];
let sending = false;
const persist = () => { try { sessionStorage.setItem(key,JSON.stringify(session)); } catch { /* In-memory visit still works. */ } };
export function bootStudy() { if(studyEnabled && !dispose) { persist(); dispose=startTracking(); } }
function payload(events: UxEvent[]) { return JSON.stringify({version:2,session:session.id,device:bucketWidth(innerWidth),test:session.test,events}); }
async function flush(unloading=false) {
  if(!studyEnabled || !buffer.length || sending) return;
  const rows=buffer.slice(0,20), body=payload(rows), visit=session.id;
  if(unloading && navigator.sendBeacon("/api/ux/events",new Blob([body],{type:"application/json"}))) { buffer.splice(0,rows.length); return; }
  sending=true;
  try { const response=await fetch("/api/ux/events",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body,keepalive:true});
    if(session.id===visit && (response.ok || (response.status>=400&&response.status<500))) buffer=buffer.filter(e=>!rows.some(r=>r.seq===e.seq));
  } catch { /* Analytics never blocks the app; bounded in-memory retry only. */ }
  finally { sending=false; }
}
function clicked(element: Element): { action?: Action; value?: number; target?: ReturnType<typeof screenOf> } {
  const control=element.closest('a,button,[role="tab"],[role="menuitem"]');
  if(!control || control.closest('[data-ux-ignore]') || control.hasAttribute("disabled")) return {};
  const label=(control.getAttribute("aria-label")||control.textContent||"").trim().replace(/\s+/g," ");
  let action=classifyLabel(label);
  let value: number | undefined;
  let target: ReturnType<typeof screenOf> | undefined;
  if(control.matches('.home-image-banner')) { action="banner.open"; value=parseInt(control.closest('.home-banner-slide')?.getAttribute('aria-label')||"",10)||undefined; }
  else if(control.closest('.home-carousel-dots')) { action="banner.select"; value=Array.from(control.parentElement?.children||[]).indexOf(control)+1; }
  else if(control.matches('.record-row,.community-attachment,.attachment')) action="reader.open";
  else if(control.matches('.browse-row')) action="archive.browse";
  else if(control.matches('.resume-link')) action="reader.resume";
  else if(control.matches('.site-menu-profile')) action="menu.profile";
  else if(control.closest('.archive-recent')) action="archive.recent";
  if(control.matches('a')) {
    try { const url=new URL(control.getAttribute("href")||"",location.href);
      if(url.origin===location.origin) { target=screenOf(url.hash.startsWith("#/")?url.hash.slice(1):url.pathname); if(!action&&target==="post") action="post.open"; }
      else if(!action) action="link.external";
    } catch { /* No URL ever enters the event. */ }
  }
  if(action==="archive.year"||action==="reader.page_jump") value=parseInt(label,10);
  if(action==="board.category") value=["전체","자유글","추억","질문","동문소식","공지"].indexOf(label);
  if(action==="popular.select") value=["많이 본 글","댓글 많은 글","인기 큐시트"].indexOf(label);
  return {action,...(value!==undefined?{value}:{}),...(target?{target}:{})};
}
function startTracking() {
  const routeKey=()=>{const path=currentRoute();return path.split("?")[0]+(screenOf(path)==="archive"?"?"+path.split("?")[1]:"");};
  let screen=screenOf(currentRoute()), previousRoute=routeKey(), lastTick=performance.now(), activeMs=0, lastInteraction=lastTick, depth=0, lastScroll=0;
  let touch: {x:number;y:number;pinch:boolean}|undefined;
  let press: {x:number;y:number;screen:ReturnType<typeof screenOf>;at:number;control:Element;data:ReturnType<typeof clicked>}|undefined;
  const emit=(kind:UxEvent["kind"],extra:Partial<UxEvent>={})=>{
    if((extra.screen||screen)==="private") return;
    buffer.push({seq:++session.seq,at:Date.now(),kind,screen,...extra}); persist();
    if(buffer.length>100) buffer.shift();
    if(buffer.length>=20) void flush();
  };
  const tick=()=>{ const now=performance.now(); if(document.visibilityState==="visible"&&now-lastInteraction<60000) activeMs+=Math.min(now-lastTick,1000); lastTick=now; };
  const leave=()=>{tick(); emit("leave",{value:Math.round(activeMs/1000)}); activeMs=0;};
  const route=()=>{const next=screenOf(currentRoute()),key=routeKey(); if(key!==previousRoute) {leave(); screen=next;previousRoute=key;depth=0;emit("enter");}};
  const click=(event:MouseEvent)=>{lastInteraction=performance.now(); if(event.detail!==0||!(event.target instanceof Element)) return; const data=clicked(event.target); if(data.action) emit("click",data);};
  const pointerDown=(event:PointerEvent)=>{lastInteraction=performance.now();if(event.button!==0||!(event.target instanceof Element))return;const control=event.target.closest('a,button,[role="tab"],[role="menuitem"]');if(control)press={x:event.clientX,y:event.clientY,screen,at:Date.now(),control,data:clicked(control)};};
  const pointerUp=(event:PointerEvent)=>{if(press&&event.target instanceof Element&&event.target.closest('a,button,[role="tab"],[role="menuitem"]')===press.control&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<16&&press.data.action)emit("click",{...press.data,screen:press.screen,at:press.at});press=undefined;};
  const pointerCancel=()=>{press=undefined;};
  const submit=(event:Event)=>{ if(!(event.target instanceof HTMLFormElement)||event.target.closest('[data-ux-ignore]')) return; emit("click",{action:screen==="auth"?"auth.submit":screen==="write"?"write.submit":screen==="post"?"comment.submit":screen==="search"||screen==="board"?"search.submit":"form.submit"}); };
  const scroll=()=>{lastInteraction=performance.now(); if(lastInteraction-lastScroll<200) return; lastScroll=lastInteraction; const max=document.documentElement.scrollHeight-innerHeight; if(max<=0)return; const percent=Math.min(100,Math.floor(((scrollY+2)/max)*4)*25); if(percent>depth){depth=percent;emit("scroll",{value:depth});}};
  const touchStart=(e:TouchEvent)=>{lastInteraction=performance.now(); const first=e.touches[0]; if(first)touch={x:first.clientX,y:first.clientY,pinch:e.touches.length>1};};
  const touchEnd=(e:TouchEvent)=>{if(!touch)return; const last=e.changedTouches[0]; if(touch.pinch&&screen==="reader")emit("gesture",{value:2}); else if(last&&Math.abs(last.clientX-touch.x)>70&&Math.abs(last.clientY-touch.y)<60)emit("gesture",{value:last.clientX>touch.x?1:-1}); touch=undefined;};
  const visibility=()=>{tick(); if(document.visibilityState==="hidden"){emit("engagement",{value:Math.round(activeMs/1000)});activeMs=0;void flush(true);} else {lastTick=performance.now();lastInteraction=lastTick;}};
  const pagehide=()=>{leave();void flush(true);};
  const interaction=()=>{lastInteraction=performance.now();};
  document.addEventListener("click",click,true);document.addEventListener("submit",submit,true);document.addEventListener("pointerdown",pointerDown,true);document.addEventListener("pointerup",pointerUp,true);document.addEventListener("pointercancel",pointerCancel,true);
  window.addEventListener("hashchange",route);window.addEventListener("popstate",route);window.addEventListener("scroll",scroll,{passive:true});
  document.addEventListener("touchstart",touchStart,{passive:true});document.addEventListener("touchend",touchEnd,{passive:true});document.addEventListener("keydown",interaction,{passive:true});
  document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",pagehide);
  const timer=setInterval(()=>{tick();void flush();},5000); const activeTimer=setInterval(tick,1000); emit("enter"); void flush();
  return ()=>{clearInterval(timer);clearInterval(activeTimer);document.removeEventListener("click",click,true);document.removeEventListener("submit",submit,true);document.removeEventListener("pointerdown",pointerDown,true);document.removeEventListener("pointerup",pointerUp,true);document.removeEventListener("pointercancel",pointerCancel,true);window.removeEventListener("hashchange",route);window.removeEventListener("popstate",route);window.removeEventListener("scroll",scroll);document.removeEventListener("touchstart",touchStart);document.removeEventListener("touchend",touchEnd);document.removeEventListener("keydown",interaction);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",pagehide);};
}
