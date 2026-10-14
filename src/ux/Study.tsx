import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { actions, screenLabels, type UxEvent, type Action, type Screen } from "./model";
import { bootStudy, chooseStudy, getStudyChoice, studyEnabled, subscribeStudy } from "./tracker";
import { supabase } from "../community/client";
import { useCommunity } from "../community/useCommunity";
import "./study.css";

type Visit={id:string;started:number;ended:number;events:number;device:string;test:number;active_seconds:number};
type Summary={visits:Visit[];counts:{visits:number;events:number;clicks:number};clicks:{action:Action;count:number}[];screens:{screen:Screen;entries:number}[]};
const time=(value:number)=>new Date(value).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
const elapsed=(seconds:number)=>seconds>=60?`${Math.floor(seconds/60)}분 ${seconds%60}초`:`${seconds}초`;
function useHash(){const [hash,setHash]=useState(location.hash);useEffect(()=>{const update=()=>setHash(location.hash);window.addEventListener("hashchange",update);window.addEventListener("popstate",update);return()=>{window.removeEventListener("hashchange",update);window.removeEventListener("popstate",update);};},[]);return hash;}
export function Study({children}:{children:ReactNode}){
  const choice=useSyncExternalStore(subscribeStudy,getStudyChoice);
  const hash=useHash();
  const [settings,setSettings]=useState(false);
  useEffect(()=>{bootStudy();},[]);
  if(!studyEnabled)return children;
  const report=hash.split("?")[0]==="#/ux-log";
  return <>{report?<StudyReport/>:children}
    {!report && (choice===null||settings) ? <aside className="ux-consent" aria-label="UX 실험 참여 안내" data-ux-ignore>
      <strong>VOKU On 이용 흐름을 살펴봅니다</strong>
      <p>동의하시면 누른 기능, 화면 이동, 머문 시간과 스크롤 정도를 임의의 방문 번호로 기록합니다. 입력 내용·회원 정보·화면 영상은 기록하지 않습니다. 방문 로그는 30일간 분석하며 이후 정리합니다. 아래 설정에서 언제든 기록을 멈출 수 있습니다.</p>
      <p className="ux-real-data">기존 회원과 게시글이 연결되어 있어, 여기서 남긴 글·댓글도 실제 서비스에 반영됩니다.</p>
      <div><button onClick={()=>{chooseStudy("yes");setSettings(false);}}>참여하고 둘러보기</button><button className="ux-secondary" onClick={()=>{chooseStudy("no");setSettings(false);}}>기록 없이 보기</button></div>
    </aside>:!report&&<button className="ux-status" data-ux-ignore onClick={()=>setSettings(true)}>UX 실험 · {choice==="yes"?"기록 중":"기록 안 함"} · 설정</button>}
  </>;
}
async function loadReport(query:URLSearchParams){
  const token=(await supabase?.auth.getSession())?.data.session?.access_token;
  if(!token)throw Error("기존 게시판 관리자 계정으로 로그인해 주세요.");
  const response=await fetch("/api/ux/report?"+query,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  const json=await response.json();if(!response.ok)throw Error(json.error||"로그를 불러오지 못했습니다.");return json;
}
function eventText(event:UxEvent){
  if(event.kind==="click"){
    let label=actions[event.action!]||"기능 클릭";
    if(event.action==="board.category"&&event.value!==undefined)label+=" · "+["전체","자유글","추억","질문","동문소식","공지"][event.value];
    if(event.action==="popular.select"&&event.value!==undefined)label+=" · "+["많이 본 글","댓글 많은 글","인기 큐시트"][event.value];
    if(event.action==="banner.open"&&event.value)label+=` · ${event.value}번째 배너`;
    return label;
  }
  if(event.kind==="enter")return "화면 열기";
  if(event.kind==="leave")return `화면 떠남 · 읽거나 조작한 시간 ${elapsed(event.value||0)}`;
  if(event.kind==="engagement")return `다른 앱·탭으로 전환 · 활동 시간 ${elapsed(event.value||0)}`;
  if(event.kind==="scroll")return `화면 ${event.value}%까지 내려봄`;
  return event.value===2?"두 손가락 조작":event.value===1?"오른쪽으로 밀기":"왼쪽으로 밀기";
}
function StudyReport(){
  const c=useCommunity(()=>{});
  const [days,setDays]=useState("7"),[includeTest,setTest]=useState(false),[revision,setRevision]=useState(0);
  const [summary,setSummary]=useState<Summary|null>(null),[selected,setSelected]=useState<Visit|null>(null),[events,setEvents]=useState<UxEvent[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const allowed=c.profile?.role==="admin";
  useEffect(()=>{
    if(!allowed)return;let cancelled=false;setLoading(true);setError("");
    void loadReport(new URLSearchParams({days,test:includeTest?"1":"0"})).then(result=>{if(!cancelled){setSummary(result);setSelected(null);setEvents([]);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[allowed,days,includeTest,revision]);
  useEffect(()=>{
    if(!selected)return;let cancelled=false;setEvents([]);setError("");
    void loadReport(new URLSearchParams({days,test:includeTest?"1":"0",session:selected.id})).then(result=>{if(!cancelled)setEvents(result.events);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};
  },[selected,days,includeTest]);
  const download=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),days,includeTest,summary,selected,events},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="voku-ux-log.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <main className="ux-report" data-ux-ignore>
    <header><a href="#/home">← VOKU On으로</a><span>실험 사이트 전용</span></header>
    <h1>방문 흐름 살펴보기</h1><p className="ux-intro">무엇을 누르고 어디로 이동했는지, 방문 한 번의 순서로 확인합니다.</p>
    {c.loading?<p role="status">관리자 권한 확인 중…</p>:!allowed?<section className="ux-empty"><h2>관리자 로그인 후 볼 수 있습니다</h2><p>기존 회원 계정을 사용합니다. 일반 회원에게는 방문 로그를 공개하지 않습니다.</p><a className="ux-button" href="#/auth?next=%2Fux-log&back=%2Fhome">로그인하기</a></section>:<>
      <div className="ux-filters"><label>기간 <select value={days} onChange={e=>setDays(e.target.value)}><option value="1">최근 1일</option><option value="7">최근 7일</option><option value="30">최근 30일</option></select></label><label><input type="checkbox" checked={includeTest} onChange={e=>setTest(e.target.checked)}/> 테스트 방문 포함</label><button onClick={()=>setRevision(x=>x+1)} disabled={loading}>새로고침</button><button onClick={download} disabled={!summary}>JSON 저장</button></div>
      {error&&<p role="alert" className="ux-error">{error}</p>}
      {loading&&<p role="status">기록 불러오는 중…</p>}
      {summary&&<>
        <div className="ux-counts"><div><strong>{summary.counts.visits||0}</strong><span>방문</span></div><div><strong>{summary.counts.clicks||0}</strong><span>기능 클릭</span></div><div><strong>{summary.counts.events||0}</strong><span>UX 기록</span></div></div>
        <p className="ux-help">방문 수는 사람 수와 다릅니다. 계정과 연결하지 않으며 입력 내용은 수집하지 않습니다. 머문 시간은 화면이 보이고 최근 1분 안에 조작한 시간의 근사치입니다. 클릭은 동작 시도이며 가입·등록 성공을 뜻하지 않습니다.</p>
        <div className="ux-overview"><section><h2>많이 누른 기능</h2>{summary.clicks.length?<ol>{summary.clicks.map(row=><li key={row.action}><span>{actions[row.action]}</span><strong>{row.count}</strong></li>)}</ol>:<p>기록된 클릭이 아직 없습니다.</p>}</section><section><h2>많이 연 화면</h2><ol>{summary.screens.map(row=><li key={row.screen}><span>{screenLabels[row.screen]}</span><strong>{row.entries}</strong></li>)}</ol></section></div>
        <div className="ux-visits"><section><h2>방문 목록 <small>최근 100건</small></h2>{!summary.visits.length&&<p>참여자가 실험 주소에서 기록에 동의하면 여기에 표시됩니다.</p>}{summary.visits.map(visit=><button className={selected?.id===visit.id?"selected":""} key={visit.id} onClick={()=>setSelected(visit)}><strong>방문 {visit.id.slice(0,8)} {visit.test?"· 테스트":""}</strong><span>{time(visit.started)} · {visit.device}</span><small>{visit.events}개 기록 · 활동 {elapsed(visit.active_seconds||0)}</small></button>)}</section><section><h2>행동 순서</h2>{!selected?<p>방문을 선택하면 이동과 조작 순서가 보입니다.</p>:<ol className="ux-timeline">{events.map(event=><li key={event.seq}><time>{time(event.at)}</time><strong>{screenLabels[event.screen]} · {eventText(event)}</strong>{event.action==="archive.year"&&<span>{event.value}년</span>}{event.action==="reader.page_jump"&&<span>{event.value}쪽</span>}{event.action==="banner.select"&&<span>{event.value}번째 배너</span>}{event.target&&<span>이동 대상: {screenLabels[event.target]}</span>}</li>)}</ol>}</section></div>
      </>}
    </>}
  </main>;
}
