import test from 'node:test';
import assert from 'node:assert/strict';
import { profilePhotoUrl, normalizeIntroduction, isProfilePhotoPath } from '../src/community/profilePhoto.ts';
const owner='10000000-0000-4000-8000-000000000001';
const path=`${owner}/20000000-0000-4000-8000-000000000001.jpg`;
test('profile images resolve only owned storage paths or isolated preview JPEG data',()=>{
 assert.equal(isProfilePhotoPath(path,owner),true);
 assert.equal(isProfilePhotoPath(path,'other'),false);
 assert.equal(profilePhotoUrl(path,'https://project.supabase.co'),`https://project.supabase.co/storage/v1/object/public/profile-photos/${path}`);
 for(const value of ['https://evil.invalid/photo.jpg','../secret',`${path}?query=1`,'javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=']) {
  assert.equal(profilePhotoUrl(value,'https://project.supabase.co'),null);
  assert.equal(profilePhotoUrl(value,''),null);
 }
 const demo='data:image/jpeg;base64,AA==';
 assert.equal(profilePhotoUrl(demo,''),demo);
 assert.equal(profilePhotoUrl(demo,'https://project.supabase.co'),null);
 assert.equal(profilePhotoUrl(null,''),null);
});
test('introduction stays optional and bounded',()=>{
 assert.equal(normalizeIntroduction('  '),'');
 assert.equal(normalizeIntroduction('  방송국 이야기\n요즘 근황  '),'방송국 이야기\n요즘 근황');
 assert.equal(normalizeIntroduction('가'.repeat(300)).length,300);
 assert.throws(()=>normalizeIntroduction('가'.repeat(301)),/300자/);
});
