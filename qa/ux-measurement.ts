import { bootStudy } from '../src/ux/tracker';
import { measureStudy, studyAutoScroll } from '../src/ux/signals';
import { shareLink } from '../src/share';
if (!['127.0.0.1','localhost'].includes(location.hostname)) throw Error('Local QA only');
document.body.innerHTML = `<style>body{font:18px sans-serif;margin:20px;line-height:1.6}button{font:inherit;padding:12px;margin:6px 0;display:block}.spacer{height:1600px;background:linear-gradient(#edf3e5,#fff)}img{width:80px;height:80px}</style><main class="reader"><h1>UX 계측 로컬 검증</h1><button id="scenario">성공·실패·취소 상황 검사</button><button id="restore">저장 위치로 자동 복귀</button><button id="preview" class="ring-preview" aria-label="1999년 예시 원고 읽기">원고 미리보기 버튼 검사</button><div id="status" role="status"></div><div id="images"></div><div class="spacer">이 영역을 직접 스크롤하세요.</div><button id="top">맨 위로 이동</button></main>`;
bootStudy();
document.querySelector('#restore')!.addEventListener('click',()=>{studyAutoScroll('scroll.restore');window.scrollTo({top:900,behavior:'instant'});});
document.querySelector('#top')!.addEventListener('click',()=>{studyAutoScroll('scroll.jump');window.scrollTo({top:0,behavior:'instant'});});
document.querySelector('#preview')!.addEventListener('click',()=>{location.hash='/read/qa-preview';});
document.querySelector('#scenario')!.addEventListener('click',async()=>{
  await measureStudy('reader.pages',()=>Promise.resolve());
  await measureStudy('reader.pages',()=>Promise.reject(Error('fixture failure'))).catch(()=>{});
  await shareLink({url:location.origin},{share:async()=>{throw new DOMException('cancel fixture','AbortError');}});
  await shareLink({url:location.origin},{clipboard:{writeText:async()=>{}}});
  const original=document.execCommand;
  try {document.execCommand=()=>false;await shareLink({url:location.origin},{clipboard:{writeText:async()=>{throw Error('fixture denied');}}});}
  finally {document.execCommand=original;}
  const images=document.querySelector('#images')!;
  const good=document.createElement('img');good.className='cue-image';good.alt='표시 성공 검사';good.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="green"/></svg>');
  const bad=document.createElement('img');bad.className='cue-image';bad.alt='표시 실패 검사';bad.src='/qa/missing-fixture-image.png';
  images.append(good,bad);document.querySelector('#status')!.textContent='상황 검사 완료';
});
