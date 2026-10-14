import { actions, resultActions, screens } from "../src/ux/model.ts";

export const response = (body, status=200) => new Response(JSON.stringify(body), {status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex","X-Content-Type-Options":"nosniff"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const devices=["small","mobile","tablet","desktop"];
const legacyKinds=["enter","leave","click","scroll","engagement","gesture"];
const kinds=[...legacyKinds,"result","change","scroll_user","scroll_auto","scroll_unknown"];
export function visitorIp(request) {
  // Cloudflare supplies these at the edge. Never accept an IP in event JSON or X-Forwarded-For.
  const value=request.headers.get("CF-Connecting-IPv6") || request.headers.get("CF-Connecting-IP") || "";
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(value) && value.split(".").every(part=>Number(part)<=255)) return value;
  if(value.includes(":") && /^[0-9a-f:.]{2,45}$/i.test(value)) {
    try { return new URL(`http://[${value}]/`).hostname.slice(1,-1); } catch { /* Invalid IPv6 is not retained. */ }
  }
  return null;
}
export function validOrigin(request,env) {
  const origin=new URL(request.url).origin;
  return origin!=="https://voku.pages.dev" && origin===env.UX_STUDY_ORIGIN && (!request.headers.has("Origin") || request.headers.get("Origin")===origin);
}
export function validateBatch(body,now=Date.now()) {
  if(!body||Object.keys(body).some(k=>!["version","session","device","test","events"].includes(k))||![1,2,3].includes(body.version)||!uuid.test(body.session)||!devices.includes(body.device)||typeof body.test!=="boolean"||!Array.isArray(body.events)||body.events.length<1||body.events.length>20) return null;
  const seen=new Set();
  const events=[];
  for(const row of body.events){
    if(!row||Object.keys(row).some(k=>!["seq","at","kind","screen","action","value","target"].includes(k))||!Number.isSafeInteger(row.seq)||row.seq<1||row.seq>100000||seen.has(row.seq)||!Number.isSafeInteger(row.at)||Math.abs(row.at-now)>86400000||!kinds.includes(row.kind)||!screens.includes(row.screen)||row.screen==="private")return null;
    if(row.action!==undefined&&!Object.hasOwn(actions,row.action))return null;
    if(row.kind==="click"&&!row.action)return null;
    if(body.version<3&&!legacyKinds.includes(row.kind))return null;
    if(row.kind==="result"&&(!Object.hasOwn(resultActions,row.action||"")||![-1,0,1,2].includes(row.value)))return null;
    if(row.kind==="change"&&(row.action!=="archive.ring_year"||!Number.isInteger(row.value)||row.value<1988||row.value>2019))return null;
    if(["scroll_user","scroll_auto","scroll_unknown"].includes(row.kind)&&![0,25,50,75,100].includes(row.value))return null;
    if(row.kind==="scroll_auto"&&!["scroll.restore","scroll.jump","scroll.navigation","scroll.layout"].includes(row.action))return null;
    if(["scroll_user","scroll_unknown"].includes(row.kind)&&row.action!==undefined)return null;
    if(row.target!==undefined&&!screens.includes(row.target))return null;
    if(row.value!==undefined&&(!Number.isSafeInteger(row.value)||row.value< -1||row.value>86400))return null;
    if(row.kind==="scroll"&&![25,50,75,100].includes(row.value))return null;
    if(row.kind==="gesture"&&![-1,1,2].includes(row.value))return null;
    if(row.action==="archive.year"&&(!Number.isInteger(row.value)||row.value<1988||row.value>2019))return null;
    if(row.action==="banner.select"&&(!Number.isInteger(row.value)||row.value<1||row.value>10))return null;
    if(row.action==="board.category"&&(!Number.isInteger(row.value)||row.value<0||row.value>5))return null;
    if(row.action==="popular.select"&&(!Number.isInteger(row.value)||row.value<0||row.value>2))return null;
    seen.add(row.seq);events.push({seq:row.seq,at:row.at,kind:row.kind,screen:row.screen,action:row.action||null,value:row.value??null,target:row.target||null});
  }
  return {version:body.version,session:body.session,device:body.device,test:body.test?1:0,events};
}
export async function collect(request,env) {
  if(!validOrigin(request,env))return response({error:"허용되지 않는 실험 주소입니다."},403);
  if(!env.UX_DB)return response({error:"로그 저장소를 준비 중입니다."},503);
  if(!request.headers.get("Content-Type")?.startsWith("application/json"))return response({error:"잘못된 형식"},415);
  if(Number(request.headers.get("Content-Length")||0)>12000)return response({error:"요청 크기 제한"},413);
  const raw=await request.text();if(raw.length>12000)return response({error:"요청 크기 제한"},413);
  let batch;try{batch=validateBatch(JSON.parse(raw));}catch{/* invalid JSON */}
  if(!batch)return response({error:"허용된 UX 항목만 기록할 수 있습니다."},400);
  const now=Date.now(), cutoff=now-30*86400000;
  // IP comes only from the edge; no User-Agent, referrer, JWT, form values, member IDs or text.
  const day=Math.floor(now/86400000);
  const limits=await env.UX_DB.prepare("SELECT scope,total FROM ux_quotas WHERE day=? AND scope IN ('all',?)").bind(day,batch.session).all();
  if(limits.results.some(row=>row.total>=(row.scope==='all'?20000:3000)))return response({error:"오늘의 기록 한도에 도달했습니다."},429);
  const statements=batch.events.map(e=>env.UX_DB.prepare("INSERT OR IGNORE INTO ux_events(session_id,seq,at,received_at,device,is_test,kind,screen,action,value,target) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(batch.session,e.seq,e.at,now,batch.device,batch.test,e.kind,e.screen,e.action,e.value,e.target));
  // Old tabs still showing the former consent notice do not collect IP until updated.
  if(batch.version>=2)statements.push(env.UX_DB.prepare("INSERT INTO ux_visit_ips(session_id,ip,last_seen) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET ip=COALESCE(excluded.ip,ux_visit_ips.ip),last_seen=excluded.last_seen").bind(batch.session,visitorIp(request),now));
  statements.push(env.UX_DB.prepare("DELETE FROM ux_events WHERE rowid IN (SELECT rowid FROM ux_events WHERE received_at<? LIMIT 500)").bind(cutoff));
  statements.push(env.UX_DB.prepare("DELETE FROM ux_quotas WHERE day<?").bind(day-30));
  statements.push(env.UX_DB.prepare("DELETE FROM ux_visit_ips WHERE session_id IN (SELECT session_id FROM ux_visit_ips WHERE last_seen<? LIMIT 500)").bind(cutoff));
  try{await env.UX_DB.batch(statements);}catch(error){if(String(error).includes("ux_limit"))return response({error:"오늘의 기록 한도에 도달했습니다."},429);throw error;}
  return response({accepted:batch.events.length});
}
export async function authorize(request,env,fetcher=fetch) {
  const auth=request.headers.get("Authorization")||"";
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth))return false;
  const base=env.VITE_SUPABASE_URL?.replace(/\/$/,"");
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base||"")||!env.VITE_SUPABASE_PUBLISHABLE_KEY)return false;
  try {
    const result=await fetcher(base+"/rest/v1/rpc/community_account",{method:"POST",headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:auth,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(8000)});
    if(!result.ok)return false;
    const account=await result.json();
    return account?.profile?.role==="admin" && !!account.profile.id && (!account.profile.suspendedUntil||new Date(account.profile.suspendedUntil).getTime()<=Date.now());
  }catch{return false;}
}
export async function report(request,env,fetcher=fetch) {
  if(!validOrigin(request,env))return response({error:"허용되지 않는 실험 주소입니다."},403);
  if(!await authorize(request,env,fetcher))return response({error:"기존 게시판 관리자 계정으로 로그인해 주세요."},403);
  if(!env.UX_DB)return response({error:"로그 저장소를 준비 중입니다."},503);
  const url=new URL(request.url), days=[1,7,30].includes(Number(url.searchParams.get("days")))?Number(url.searchParams.get("days")):7;
  const cutoff=Date.now()-days*86400000, includeTest=url.searchParams.get("test")==="1";
  const filter=includeTest?"":" AND is_test=0";
  const selected=url.searchParams.get("session");
  if(selected){
    if(!uuid.test(selected))return response({error:"잘못된 방문 번호"},400);
    const {results}=await env.UX_DB.prepare("SELECT seq,at,kind,screen,action,value,target FROM ux_events WHERE session_id=? AND received_at>?"+filter+" ORDER BY at,seq LIMIT 3000").bind(selected,cutoff).all();
    return response({events:results});
  }
  const [visits,counts,clicks,flow,outcomes,scrolls]=await env.UX_DB.batch([
    env.UX_DB.prepare("SELECT session_id AS id,min(at) AS started,max(at) AS ended,count(*) AS events,max(device) AS device,max(is_test) AS test,sum(CASE WHEN kind IN ('leave','engagement') THEN value ELSE 0 END) AS active_seconds,(SELECT ip FROM ux_visit_ips WHERE ux_visit_ips.session_id=ux_events.session_id) AS ip FROM ux_events WHERE received_at>?"+filter+" GROUP BY session_id ORDER BY started DESC LIMIT 100").bind(cutoff),
    env.UX_DB.prepare("SELECT count(DISTINCT session_id) AS visits,count(*) AS events,sum(CASE WHEN kind='click' THEN 1 ELSE 0 END) AS clicks FROM ux_events WHERE received_at>?"+filter).bind(cutoff),
    env.UX_DB.prepare("SELECT action,count(*) AS count FROM ux_events WHERE received_at>? AND kind='click'"+filter+" GROUP BY action ORDER BY count DESC LIMIT 30").bind(cutoff),
    env.UX_DB.prepare("SELECT screen,count(*) AS entries FROM ux_events WHERE received_at>? AND kind='enter'"+filter+" GROUP BY screen ORDER BY entries DESC").bind(cutoff),
    env.UX_DB.prepare("SELECT action,value,count(*) AS count FROM ux_events WHERE received_at>? AND kind='result'"+filter+" GROUP BY action,value ORDER BY action,value").bind(cutoff),
    env.UX_DB.prepare("SELECT kind,count(*) AS count FROM ux_events WHERE received_at>? AND kind IN ('scroll','scroll_user','scroll_auto','scroll_unknown')"+filter+" GROUP BY kind").bind(cutoff),
  ]);
  return response({visits:visits.results,counts:counts.results[0],clicks:clicks.results,screens:flow.results,outcomes:outcomes.results,scrolls:scrolls.results,days,includeTest});
}
