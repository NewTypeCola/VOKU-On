import { useEffect, useState, type ReactNode } from "react";
import { eventText, elapsed, outcomeLabel, scrollLabels } from "./presentation";
import { actions, screenLabels, type UxEvent, type Action, type Screen } from "./model";
import { bootStudy, studyEnabled } from "./tracker";
import { supabase } from "../community/client";
import { useCommunity } from "../community/useCommunity";
import { AuthScreen } from "../community/Auth";
import { oauthReturnKey } from "../community/oauth";
import { readExternalAuth } from "../community/authFlow";
import "./study.css";

type Visit={id:string;started:number;ended:number;events:number;device:string;test:number;active_seconds:number;ip:string|null};
type Summary={visits:Visit[];counts:{visits:number;events:number;clicks:number};clicks:{action:Action;count:number}[];screens:{screen:Screen;entries:number}[];outcomes?:{action:Action;value:number;count:number}[];scrolls?:{kind:string;count:number}[]};
const time=(value:number)=>new Date(value).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
function useHash(){const [hash,setHash]=useState(location.hash);useEffect(()=>{const update=()=>setHash(location.hash);window.addEventListener("hashchange",update);window.addEventListener("popstate",update);return()=>{window.removeEventListener("hashchange",update);window.removeEventListener("popstate",update);};},[]);return hash;}
export function Study({children}:{children:ReactNode}){
  const hash=useHash();
  useEffect(()=>{bootStudy();},[]);
  if(!studyEnabled)return children;
  const report=hash.split("?")[0]==="#/ux-log";
  const params=new URLSearchParams(hash.split("?")[1]);
  let operatorCallback=false;
  try { operatorCallback=!!readExternalAuth()&&sessionStorage.getItem(oauthReturnKey)==="/ux-log"; } catch { /* restricted storage */ }
  const operatorAuth=(hash.split("?")[0]==="#/auth"&&params.get("next")==="/ux-log")||operatorCallback;
  if(operatorCallback){params.set("next","/ux-log");params.set("back","/home");}
  return report?<StudyReport/>:operatorAuth?<StudyOperatorAuth params={params}/>:children;
}
const operatorGo=(path:string)=>{location.hash=path;};
function StudyOperatorAuth({params}:{params:URLSearchParams}){
  const c=useCommunity(()=>{},operatorGo,true);
  return <div className="ux-operator-auth" data-ux-ignore><AuthScreen c={c} go={operatorGo} notify={()=>{}} params={params} studyOperator/><StudyNotice/></div>;
}
export function StudyNotice(){
  return <div className="ux-footer-notice" data-ux-ignore>
    <strong>UX 테스트 버전</strong>
    <small>이용 흐름·접속 IP가 자동 기록됩니다.<br/>입력 내용은 기록하지 않으며, 기록은 관리자만 최근 30일간 조회합니다.</small>
  </div>;
}
async function loadReport(query:URLSearchParams){
  const token=(await supabase?.auth.getSession())?.data.session?.access_token;
  if(!token)throw Error("기존 게시판 관리자 계정으로 로그인해 주세요.");
  const response=await fetch("/api/ux/report?"+query,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  const json=await response.json();if(!response.ok)throw Error(json.error||"로그를 불러오지 못했습니다.");return json;
}
function StudyReport(){
  const c=useCommunity(()=>{},undefined,true);
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
        <p className="ux-help">방문 수와 IP는 사람 수와 다릅니다. 공유 Wi-Fi에서는 IP가 같을 수 있고 이동 중에는 바뀔 수 있습니다. 방문별 마지막 접속 IP를 표시하며 계정·입력 내용과 연결하지 않습니다. 머문 시간은 화면이 보이고 최근 1분 안에 조작한 시간의 근사치입니다. 클릭은 동작 시도입니다. 완료·실패는 별도의 결과 기록으로 확인하세요. 추천·저장은 체험 회원의 탭 안에서만 적용됩니다. 기기 공유 기능의 응답 완료는 상대방 수신 확인을 뜻하지 않습니다.</p>
        <div className="ux-overview"><section><h2>많이 누른 기능</h2>{summary.clicks.length?<ol>{summary.clicks.map(row=><li key={row.action}><span>{actions[row.action]}</span><strong>{row.count}</strong></li>)}</ol>:<p>기록된 클릭이 아직 없습니다.</p>}</section><section><h2>많이 연 화면</h2><ol>{summary.screens.map(row=><li key={row.screen}><span>{screenLabels[row.screen]}</span><strong>{row.entries}</strong></li>)}</ol></section></div>
        <div className="ux-overview"><section><h2>동작 결과</h2>{summary.outcomes?.length ? <ol>{summary.outcomes.map(row => <li key={`${row.action}:${row.value}`} data-outcome={row.value}><span>{actions[row.action]} · {outcomeLabel(row.value)}</span><strong>{row.count}</strong></li>)}</ol> : <p>업데이트 이후 결과 기록이 쌓이면 표시됩니다.</p>}</section><section><h2>스크롤 구분</h2><p className="ux-help">위치 비율이며 완독률이 아닙니다. 이전 기록은 재분류하지 않습니다.</p><ol>{(summary.scrolls || []).map(row => <li key={row.kind}><span>{scrollLabels[row.kind] || row.kind}</span><strong>{row.count}</strong></li>)}</ol></section></div>
        <div className="ux-visits"><section><h2>방문 목록 <small>최근 100건</small></h2>{!summary.visits.length&&<p>방문자가 실험 주소에 들어오면 자동으로 여기에 표시됩니다.</p>}{summary.visits.map(visit=><button className={selected?.id===visit.id?"selected":""} key={visit.id} onClick={()=>setSelected(visit)}><strong>방문 {visit.id.slice(0,8)} {visit.test?"· 테스트":""}</strong><span>{time(visit.started)} · {visit.device}</span><span className="ux-visit-ip">접속 IP · {visit.ip || "수집 전 방문"}</span><small>{visit.events}개 기록 · 활동 {elapsed(visit.active_seconds||0)}</small></button>)}</section><section><h2>행동 순서</h2>{!selected?<p>방문을 선택하면 이동과 조작 순서가 보입니다.</p>:<><p className="ux-selected-ip">접속 IP · {selected.ip || "수집 전 방문"}</p><ol className="ux-timeline">{events.map(event=><li key={event.seq} data-kind={event.kind} data-outcome={event.kind === "result" ? event.value : undefined}><time>{time(event.at)}</time><strong>{screenLabels[event.screen]} · {eventText(event)}</strong>{event.action==="archive.year"&&<span>{event.value}년</span>}{event.kind==="click"&&event.action==="reader.page_jump"&&event.value!==undefined&&<span>{event.value}쪽</span>}{event.action==="banner.select"&&<span>{event.value}번째 배너</span>}{event.target&&<span>이동 대상: {screenLabels[event.target]}</span>}</li>)}</ol></>}</section></div>
      </>}
    </>}
    <StudyNotice/>
  </main>;
}
