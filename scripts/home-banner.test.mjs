import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerTarget, bannerView, isBannerImagePath } from '../src/home/banner.ts';

test('banner links accept copied VOKU routes, short links and HTTPS destinations', () => {
  assert.equal(bannerTarget('  '),'');
  assert.equal(bannerTarget('https://voku.pages.dev/#/board?category=공지'),'/board?category='+encodeURIComponent('공지'));
  assert.equal(bannerTarget('https://voku.pages.dev/p/aBcDeFg_12'),'/post/aBcDeFg_12');
  assert.equal(bannerTarget('/p/aBcDeFg_12?comment=abc'),'/post/aBcDeFg_12?comment=abc');
  assert.equal(bannerTarget('/#/archive'),'/archive');
  assert.equal(bannerTarget('#/read/1997-test'),'/read/1997-test');
  assert.equal(bannerTarget('https://example.com/guide'),'https://example.com/guide');
  assert.equal(bannerTarget('https://voku.pages.dev/about/'),'https://voku.pages.dev/about/');
});
test('banner links reject executable schemes, ambiguous routes and credential-bearing URLs', () => {
  for (const value of ['javascript:alert(1)','data:text/html,test','//example.com','https://user:password@example.com','https://example.com\\evil','/home-other','/auth','http://example.com','/board\n?test=1'])
    assert.throws(()=>bannerTarget(value),undefined,value);
});
test('banner view preserves image dimensions, title and optional non-clickable state', () => {
  const view=bannerView({id:'1',title:'이용 안내',src:'image',width:1600,height:800,link:'',enabled:true});
  assert.equal(view.path,''); assert.equal(view.label,'이용 안내'); assert.equal(view.alt,'이용 안내'); assert.equal(view.width/view.height,2);
  assert.ok(isBannerImagePath('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.jpg'));
  assert.equal(isBannerImagePath('../secret.jpg'),false);
});
