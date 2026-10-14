import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { screenOf, classifyLabel, studyLink } from '../src/ux/model.ts';
import { validateBatch, validOrigin, authorize, collect, report } from '../server/uxStudy.js';

const now=Date.now();
const event={seq:1,at:now,kind:'click',screen:'reader',action:'reader.zoom_in'};
const batch={version:1,session:'11111111-1111-4111-8111-111111111111',device:'mobile',test:true,events:[event]};
test('copied public VOKU content links stay in the study while other links remain unchanged',()=>{
  const origin='https://voku-ux-study.pages.dev';
  for(const path of ['/#/archive','/#/board?category=공지','/p/sf2UNsbdRW','/#/read/voku_1994_1_music_01']) {
    assert.equal(studyLink('https://voku.pages.dev'+path,true,origin),new URL(origin+path).href);
    assert.equal(studyLink('https://voku.pages.dev'+path,false,origin),'https://voku.pages.dev'+path);
  }
  for(const href of ['https://outside.example/#/home','https://voku.pages.dev/?auth=recovery','https://voku.pages.dev/#/admin','https://voku.pages.dev/docs/oauth-branding/privacy.html','https://voku.pages.dev.evil.example/#/archive','https://user:pass@voku.pages.dev/#/archive'])
    assert.equal(studyLink(href,true,origin),href);
});
test('Pages routes deliver the tracker API to Functions',()=>{const routes=JSON.parse(readFileSync(new URL('../public/_routes.json',import.meta.url),'utf8'));assert.ok(routes.include.includes('/api/ux/*'));});
test('UX logs classify routes without retaining query strings or content IDs',()=>{
  assert.equal(screenOf('/post/private-member-post?email=personal@example.com'),'post');
  assert.equal(screenOf('/read/some-record?code=private'),'reader');
  assert.equal(screenOf('/admin?secret=x'),'private');
  assert.equal(classifyLabel('홍길동 · 내 프로필'),undefined);
  assert.equal(classifyLabel('private@example.com'),undefined);
  assert.equal(classifyLabel('3쪽 확대'),'reader.zoom_in');
});
test('collector rejects text, URLs, secrets and invalid IDs at the server boundary',()=>{
  assert.ok(validateBatch(batch,now));
  for(const extra of [{email:'private@example.com'},{url:'https://x?token=private'},{body:'개인 내용'},{userId:'member'}])assert.equal(validateBatch({...batch,...extra},now),null);
  assert.equal(validateBatch({...batch,events:[{...event,label:'회원 이름'}]},now),null);
  assert.equal(validateBatch({...batch,events:[{...event,action:'private@example.com'}]},now),null);
  assert.equal(validateBatch({...batch,events:[{...event,screen:'private'}]},now),null);
  assert.equal(validateBatch({...batch,events:[{...event,at:now-86400001}]},now),null);
  assert.equal(validateBatch({...batch,events:Array(21).fill(event)},now),null);
});
test('production origin cannot collect even if accidentally configured',()=>{
  assert.equal(validOrigin(new Request('https://voku.pages.dev/api/ux/events'),{UX_STUDY_ORIGIN:'https://voku.pages.dev'}),false);
  assert.equal(validOrigin(new Request('https://voku-ux-study.pages.dev/api/ux/events',{headers:{Origin:'https://foreign.test'}}),{UX_STUDY_ORIGIN:'https://voku-ux-study.pages.dev'}),false);
});
test('report authorization comes from server checked community role',async()=>{
  const env={VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public-key'};
  const req=new Request('https://study.test/api/ux/report',{headers:{Authorization:'Bearer fake-test-token'}});
  for(const role of ['member','moderator',undefined])assert.equal(await authorize(req,env,async()=>Response.json({profile:{role,id:'test'}})),false);
  assert.equal(await authorize(req,env,async()=>Response.json({profile:{role:'admin',id:'test'}})),true);
  assert.equal(await authorize(req,env,async()=>Response.json({profile:{role:'admin',id:'test',suspendedUntil:'2099-01-01'}})),false);
  assert.equal(await authorize(new Request('https://study.test'),env,async()=>{throw Error('must not fetch');}),false);
});
test('D1 schema makes retries idempotent, enforces quotas and indexes retention',()=>{
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../ux-schema.sql',import.meta.url),'utf8'));
  const insert=db.prepare('INSERT OR IGNORE INTO ux_events VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  const args=[batch.session,1,now,now,'mobile',1,'click','reader','reader.zoom_in',null,null];
  insert.run(...args);insert.run(...args);
  assert.equal(db.prepare('SELECT count(*) n FROM ux_events').get().n,1);
  assert.equal(db.prepare("SELECT total FROM ux_quotas WHERE scope='all'").get().total,1);
  db.prepare("UPDATE ux_quotas SET total=20000 WHERE scope='all'").run();
  assert.throws(()=>insert.run(batch.session,2,now,now,'mobile',1,'enter','home',null,null,null),/ux_limit/);db.close();
});
test('collector and authorized report round-trip with real SQLite, separating test visits',async()=>{
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../ux-schema.sql',import.meta.url),'utf8'));
  const wrap=(statement,args=[])=>({bind:(...values)=>wrap(statement,values),first:async()=>statement.get(...args),all:async()=>({results:statement.all(...args)}),run:()=>({results:statement.all(...args)})});
  const env={UX_STUDY_ORIGIN:'https://voku-ux-study.pages.dev',VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public-key',UX_DB:{prepare:sql=>wrap(db.prepare(sql)),batch:async statements=>statements.map(s=>s.run())}};
  const request=new Request(env.UX_STUDY_ORIGIN+'/api/ux/events',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.UX_STUDY_ORIGIN},body:JSON.stringify(batch)});
  assert.equal((await collect(request,env)).status,200);
  assert.equal(db.prepare('SELECT count(*) n FROM ux_events').get().n,1);
  const admin=async()=>Response.json({profile:{role:'admin',id:'test'}});
  const read=query=>new Request(env.UX_STUDY_ORIGIN+'/api/ux/report'+query,{headers:{Authorization:'Bearer test-token'}});
  assert.equal((await (await report(read(''),env,admin)).json()).counts.visits,0);
  const summary=await (await report(read('?test=1'),env,admin)).json();
  assert.equal(summary.counts.visits,1);assert.equal(summary.clicks[0].action,'reader.zoom_in');
  const detail=await (await report(read('?test=1&session='+batch.session),env,admin)).json();
  assert.equal(detail.events[0].action,'reader.zoom_in');
  assert.equal((await report(read('?test=1'),env,async()=>Response.json({profile:{role:'member',id:'test'}}))).status,403);
  db.close();
});
