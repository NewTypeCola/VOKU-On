import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { controlAction } from '../src/ux/model.ts';
import { createScrollTracker } from '../src/ux/scroll.ts';
import { eventText } from '../src/ux/presentation.ts';
import { isStudyOrigin } from '../src/ux/config.ts';
import { memberResultAction } from '../src/ux/signals.ts';
import { collect, report, validateBatch } from '../server/uxStudy.js';

const now=Date.now(),session='11111111-1111-4111-8111-111111111111';
const batch=events=>({version:3,session,device:'mobile',test:true,events:events.map((e,i)=>({seq:i+1,at:now,screen:'reader',...e}))});
test('previously unclassified archive preview and home links have content-independent actions',()=>{
  assert.equal(controlAction('1995년 실명 제목 1회 큐시트 읽기','ring-preview'),'archive.preview');
  assert.equal(controlAction('사적인 제목','home-episode-link','reader'),'reader.open');
  assert.equal(controlAction('추억 게시글 더보기','home-more','board'),'home.more');
  assert.equal(controlAction('커뮤니티 전체 보기','home-board-link','board'),'home.community');
  assert.equal(controlAction('제목 1/4쪽','archive-recent-row'),'archive.recent');
  assert.equal(controlAction('펼치기 (3)','','archive','recent'),'archive.recent_toggle');
  assert.equal(controlAction('1995년','','archive','archive-path'),'archive.path');
  assert.equal(controlAction('이전 연도',''),'archive.previous_year');
  assert.equal(controlAction('이전 쪽',''),'reader.page_jump');
  assert.equal(controlAction('취소','reader-jump-cancel'),'reader.jump_cancel');
  assert.equal(controlAction('로그인 / 회원가입','site-menu-profile'),'auth.open');
  assert.equal(controlAction('사진 다시 불러오기',''),'content.retry');
  assert.equal(controlAction('확대','','post','photo'),'photo.zoom');
  assert.equal(controlAction('다른 글 제목','community-reading-row','post'),'post.reading');
  assert.equal(controlAction('private@example.com',''),undefined);
});
test('restoring to the bottom never implies a user scrolled through the document',()=>{
  const scroll=createScrollTracker(0);
  scroll.input(10);
  scroll.automatic('scroll.restore',20);
  assert.deepEqual(scroll.sample(1000,1000,30),{kind:'scroll_auto',action:'scroll.restore',value:100});
  scroll.input(40);
  assert.deepEqual(scroll.sample(650,1000,45),{kind:'scroll_user',value:50});
  assert.equal(scroll.sample(650,2000,55),null,'layout height changes without movement are not scrolls');
  scroll.automatic('scroll.jump',60);
  assert.deepEqual(scroll.sample(500,2000,65),{kind:'scroll_auto',action:'scroll.jump',value:25});
});
test('inertia stays user-driven, stale input and route resets do not',()=>{
  const scroll=createScrollTracker(0);
  scroll.input(0);
  assert.equal(scroll.sample(260,1000,1000).kind,'scroll_user');
  assert.equal(scroll.sample(510,1000,2000).kind,'scroll_user');
  assert.equal(scroll.sample(760,1000,5000).kind,'scroll_unknown');
  scroll.input(5100);scroll.reset(760);
  assert.equal(scroll.sample(1000,1000,5150).kind,'scroll_unknown');
  assert.equal(scroll.sample(1000,1000,5200),null);
});
test('legacy scrolls stay unclassified and outcomes are not counted as attempted page numbers',()=>{
  assert.match(eventText({kind:'scroll',value:100}),/이전 기록 · 원인 미분류/);
  assert.match(eventText({kind:'scroll_user',value:50}),/직접 스크롤/);
  assert.match(eventText({kind:'scroll_auto',action:'scroll.restore',value:75}),/읽던 위치 복귀/);
  assert.equal(eventText({kind:'result',action:'reader.page_jump',value:0}),'쪽 이동 · 실패');
  assert.match(eventText({kind:'result',action:'share.native',value:1}),/응답 완료/);
  assert.match(eventText({kind:'result',action:'share.native',value:-1}),/취소/);
  assert.equal(memberResultAction('like',false),'post.unlike');
  assert.equal(memberResultAction('archive_bookmark',true),'reader.save');
});
test('v3 accepts bounded results and scroll causes; rejects content and unsupported result data',()=>{
  for(const row of [
    {kind:'result',action:'share.copy',value:1},{kind:'result',action:'share.native',value:-1},
    {kind:'result',action:'reader.image',value:0},{kind:'result',action:'write.restricted',value:2},
    {kind:'scroll_user',value:25},{kind:'scroll_auto',action:'scroll.restore',value:100},
    {kind:'scroll_unknown',value:0},{kind:'change',action:'archive.ring_year',value:1999},
  ]) assert.ok(validateBatch(batch([row]),now));
  for(const row of [
    {kind:'result',action:'back',value:1},{kind:'result',action:'reader.image',value:3},
    {kind:'scroll_auto',action:'nav.home',value:100},{kind:'scroll_user',value:42},
    {kind:'scroll_user',value:25,action:'scroll.restore'},{kind:'result',action:'reader.image',value:0,error:'secret URL'},
    {kind:'change',action:'archive.ring_year',value:2026},
  ]) assert.equal(validateBatch(batch([row]),now),null);
  assert.equal(validateBatch({...batch([{kind:'result',action:'reader.image',value:1}]),version:2},now),null);
  for(const version of [1,2])assert.ok(validateBatch({...batch([{kind:'scroll',value:75}]),version},now));
});
test('new events append to existing D1 rows and the report keeps old/new scrolls separate',async()=>{
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../ux-schema.sql',import.meta.url),'utf8'));
  const wrap=(statement,args=[])=>({bind:(...values)=>wrap(statement,values),all:async()=>({results:statement.all(...args)}),run:()=>({results:statement.all(...args)})});
  const env={UX_STUDY_ORIGIN:'https://study.test',VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public-key',UX_DB:{prepare:sql=>wrap(db.prepare(sql)),batch:async statements=>statements.map(s=>s.run())}};
  const request=body=>new Request('https://study.test/api/ux/events',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(body)});
  const old={...batch([{kind:'scroll',value:100}]),version:2};
  assert.equal((await collect(request(old),env)).status,200);
  const before=db.prepare('SELECT * FROM ux_events').all();
  const updated=batch([{seq:2,kind:'scroll_auto',action:'scroll.restore',value:100},{seq:3,kind:'scroll_user',value:50},{seq:4,kind:'result',action:'reader.image',value:0}]);
  assert.equal((await collect(request(updated),env)).status,200);
  assert.equal((await collect(request(updated),env)).status,200,'beacon retries are idempotent');
  assert.deepEqual(db.prepare('SELECT * FROM ux_events WHERE seq=1').all(),before);
  const result=await report(new Request('https://study.test/api/ux/report?test=1',{headers:{Authorization:'Bearer test-token'}}),env,async()=>Response.json({profile:{role:'admin',id:'test'}}));
  const data=await result.json();
  assert.equal(data.counts.events,4);assert.equal(data.counts.clicks,0);
  assert.deepEqual(data.scrolls.map(x=>x.kind).sort(),['scroll','scroll_auto','scroll_user']);
  assert.equal(data.outcomes[0].value,0);assert.equal(data.outcomes[0].count,1);
  assert.equal(data.visits[0].ip,'192.0.2.1');
  db.close();
});
test('the original production origin cannot enable measurement even with a mistaken env flag',()=>{
  assert.equal(isStudyOrigin('true','https://voku.pages.dev','https://voku.pages.dev'),false);
  assert.equal(isStudyOrigin('true','https://voku-ux-study.pages.dev','https://voku-ux-study.pages.dev'),true);
  assert.equal(isStudyOrigin(undefined,'https://voku-ux-study.pages.dev','https://voku-ux-study.pages.dev'),false);
});
