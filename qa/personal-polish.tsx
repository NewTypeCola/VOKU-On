import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { ProfileSettings } from "../src/community/ProfileSettings";
import { SavedScreen } from "../src/community/Saved";
import { CommunityAccount } from "../src/community/Account";
import { allowCommunityLeave } from "../src/community/navigationGuard";
import type { Community } from "../src/community/useCommunity";
import "../src/style.css";
import "../src/motion.css";
import "../src/community/community.css";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.querySelector('#screen')!);
const by = (s:string) => document.querySelector<HTMLElement>(s)!;
const wait = () => new Promise(r=>setTimeout(r,60));
const render = async (el: React.ReactNode) => { await act(async()=>root.render(el)); await wait(); };
const click = async (el:HTMLElement) => { await act(async()=>el.click()); await wait(); };
const button = (name:string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(el=>el.textContent?.trim()===name)!;
const input = async (value:string) => { await act(async()=>{const el=by('input') as HTMLInputElement; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}); };
const check=(ok:boolean,label:string)=>{const el=document.createElement('li');el.className=ok?'pass':'fail';el.textContent=(ok?'PASS ':'FAIL ')+label;by('#results').append(el);if(!ok)throw Error(label);};
const profile={id:'qa-member',nickname:'검사회원',admissionYear:2018,cohort:93,providers:['email','google'],role:'member',joinedAt:'2026-10-01',profileComplete:true,suspendedUntil:null};
let finish:(fail?:boolean)=>void, refreshProfile:(nickname:string)=>void, calls=0, route='';
const navigate=(path:string)=>{if(allowCommunityLeave())route=path;};
function ProfileFixture(){
 const [p,setP]=useState(profile);
 refreshProfile=nickname=>setP(current=>({...current,nickname}));
 const c={profile:p,account:{profile:p,email:'member@example.invalid'},live:true,action:(_name:string,payload:any)=>{calls++;return new Promise<void>((resolve,reject)=>{finish=fail=>{if(fail)reject(Error('연결 오류'));else{setP({...p,...payload});resolve();}};});}} as unknown as Community;
 return <ProfileSettings c={c} go={navigate} list="/account?tab=settings&back=%2Fboard"/>;
}
const record={id:'voku_qa',title:'다시 읽을 큐시트',issue:'01',pages:10,year:1994,term:1};
const savedPost={id:'qa-post',title:'저장한 이야기',category:'자유글',author:'검사회원',authorRole:'member',date:'2026-10-01',views:1,likes:0,commentCount:0,status:'published'};
function SavedFixture(){
 const [archive,setArchive]=useState([record.id]),[posts,setPosts]=useState([savedPost]);
 const c={profile,account:{profile,archiveSaved:archive,saved:posts},live:true,loading:false,error:'',action:(name:string,p:any)=>{calls++;return new Promise<void>((resolve,reject)=>{finish=fail=>{if(fail)reject(Error('저장 요청 실패'));else{if(name==='archive_bookmark')setArchive(p.value?[record.id]:[]);else setPosts(p.value?[savedPost]:[]);resolve();}};});}} as unknown as Community;
 return <SavedScreen c={c} go={navigate} params={new URLSearchParams(route.includes('tab=posts')?'tab=posts':'')} catalog={[record] as any} user={{saved:[],progress:{voku_qa:3}} as any} renderRecord={r=><button className="record-row">{r.title}</button>} clearLegacy={()=>{}}/>;
}
by('#run').onclick=async()=>{
 const originalConfirm=window.confirm;let prompts=0;
 by('#results').textContent='';by('#status').textContent='검사 중';
 try{
  calls=0;await render(<ProfileFixture/>);
  check(button('회원정보 저장').disabled,'변경 전 저장 버튼 비활성');
  await act(async()=>refreshProfile('갱신된회원'));await wait();
  check(button('회원정보 저장').disabled && (by('input') as HTMLInputElement).value==='갱신된회원','편집 전 계정 갱신은 새 정보를 표시');
  await input('변경한회원');
  check(!button('회원정보 저장').disabled,'변경 후 저장 가능');
  await act(async()=>refreshProfile('최신회원정보'));await wait();
  check((by('input') as HTMLInputElement).value==='변경한회원','편집 중 계정 갱신이 입력을 덮어쓰지 않음');
  window.confirm=()=>{prompts++;return false;};
  check(!allowCommunityLeave() && prompts===1,'이동 취소 시 미저장 정보 보호');
  check((by('input') as HTMLInputElement).value==='변경한회원','이동 취소 후 입력 유지');
  await click(button('변경 취소'));
  check(button('회원정보 저장').disabled && allowCommunityLeave(),'변경 취소 후 원래 값과 이동 복원');
  await input('변경한회원');await click(button('회원정보 저장'));
  check(calls===1 && button('저장 중…').disabled && !allowCommunityLeave(),'저장 중 중복 요청과 이동 차단');
  await act(async()=>finish(true));await wait();
  check(!!document.querySelector('[role=alert]') && (by('input') as HTMLInputElement).value==='변경한회원','저장 실패 시 내용 유지와 오류 안내');
  await click(button('회원정보 저장'));await act(async()=>finish());await wait();
  check(button('회원정보 저장').disabled && allowCommunityLeave(),'저장 성공 후 변경 상태 해제');
  await click(button('비밀번호 재설정'));
  check(new URLSearchParams(route.split('?')[1]).get('next')==='/account?tab=settings&back=%2Fboard','비밀번호 재설정 후 내 설정 복귀 주소 유지');
  await input('다시변경');window.confirm=()=>true;
  await act(async()=>{check(allowCommunityLeave(),'변경 취소를 승인하면 이동 가능');});
  check(button('회원정보 저장').disabled,'이동 승인 시 취소한 입력 정리');
  check(document.documentElement.scrollWidth<=innerWidth,'프로필·로그인 정보 가로 넘침 없음');
  await render(null);calls=0;route='';await render(<SavedFixture/>);
  const remove=by('button[aria-label$="저장 해제"]');
  await click(remove);await click(remove);
  check(calls===1 && (remove as HTMLButtonElement).disabled,'저장 해제 연속 클릭 방지');
  await act(async()=>finish(true));await wait();
  check(!!document.querySelector('.record-row') && !!document.querySelector('[role=alert]'),'해제 실패 시 기존 항목 보존');
  await click(remove);await act(async()=>finish());await wait();
  check(!document.querySelector('.record-row') && !!button('실행 취소'),'마지막 큐시트 해제 후 실행 취소 제공');
  await click(button('실행 취소'));await act(async()=>finish());await wait();
  check(!!document.querySelector('.record-row') && !document.querySelector('.saved-undo'),'실행 취소로 큐시트 복원');
  route='tab=posts';await render(<SavedFixture/>);
  await click(by('button[aria-label$="저장 해제"]'));await act(async()=>finish());await wait();
  check(!document.querySelector('.community-row') && !!button('실행 취소'),'게시글 저장 해제 지원');
  await click(button('실행 취소'));await act(async()=>finish());await wait();
  check(!!document.querySelector('.community-row'),'게시글 저장 복원');
  check(document.documentElement.scrollWidth<=innerWidth,'저장 목록과 실행 취소 가로 넘침 없음');
  await render(<CommunityAccount c={{profile,account:{profile,reports:[],blocked:[],saved:[],archiveSaved:[]},live:true,loading:false,error:''} as any} go={navigate} notify={()=>{}} params={new URLSearchParams('tab=reports')}/>);
  check(!!button('문제 알린 내역') && !button('숨긴 회원') && !document.querySelector('.community-profile'),'활동 탭 명칭 정리와 반복 프로필 제거');
  by('#status').textContent=`${document.querySelectorAll('.pass').length}개 검사 통과`;
 }catch(e){by('#status').textContent='실패: '+(e as Error).message;}
 finally{window.confirm=originalConfirm;await render(null);}
};
