-- Run against the deployed schema. All generated users/posts and edits roll back.
begin;
set local plpgsql.check_asserts = on;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  post_id uuid;
  owner_name text := '사진검증' || left(replace(owner_id::text,'-',''),8);
  photo_path text := owner_id::text || '/' || gen_random_uuid()::text || '.jpg';
  result jsonb;
  rejected boolean;
begin
  assert exists(select 1 from storage.buckets where id='profile-photos' and public and file_size_limit=262144 and allowed_mime_types=array['image/jpeg']), 'avatar bucket restrictions';
  assert not has_function_privilege('anon','public.community_action(text,jsonb)','execute'), 'anonymous profile write denied';
  assert not has_function_privilege('authenticated','voku_private.action_before_profile_photo(text,jsonb)','execute'), 'old action cannot bypass wrapper';
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
  values(owner_id,'profile-release-'||owner_id::text||'@example.invalid',now(),jsonb_build_object('nickname',owner_name),'{}'),
        (other_id,'profile-release-'||other_id::text||'@example.invalid',now(),jsonb_build_object('nickname','별도검증'||left(replace(other_id::text,'-',''),8)),'{}');
  update voku_private.members set profile_complete=true where id in (owner_id,other_id);
  -- Synthetic path, never an actual uploaded asset; only tests the public DTO.
  update public.community_profiles set avatar_path=photo_path where id=owner_id;
  update voku_private.members set avatar_customized=true where id=owner_id;
  insert into public.community_posts(author_id,category,title,body)
  values(owner_id,'추억','롤백 전용 프로필 검사','검사 후 롤백') returning id into post_id;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  execute 'set local role authenticated';
  perform public.community_action('profile',jsonb_build_object('nickname',owner_name,'introduction','검증용 비공개 소개'));
  result:=public.community_account();
  assert result->'profile'->>'introduction'='검증용 비공개 소개', 'owner can read introduction';
  assert result->'profile'->>'avatarPath'=photo_path, 'old payload preserves avatar';
  assert (result->'profile'->>'avatarCustomized')::boolean, 'custom avatar flag preserved';
  assert voku_private.profile_photo_uploadable(owner_id::text||'/'||gen_random_uuid()::text||'.jpg'), 'owner upload permitted';
  assert not voku_private.profile_photo_uploadable(other_id::text||'/'||gen_random_uuid()::text||'.jpg'), 'foreign upload denied';
  assert not voku_private.profile_photo_removable(photo_path), 'active avatar cannot be removed';
  rejected:=false;
  begin
    perform public.community_action('profile',jsonb_build_object('nickname',owner_name,'introduction',repeat('가',301)));
  exception when others then rejected:=position('300자' in sqlerrm)>0; end;
  assert rejected, 'introduction limit enforced';
  rejected:=false;
  begin
    perform public.community_action('profile',jsonb_build_object('nickname',owner_name,'avatarPath',owner_id::text||'/'||gen_random_uuid()::text||'.jpg'));
  exception when others then rejected:=position('프로필 사진' in sqlerrm)>0; end;
  assert rejected, 'nonexistent storage object rejected';

  execute 'reset role';
  update voku_private.members set role='admin' where id=other_id;
  perform set_config('request.jwt.claim.sub',other_id::text,true);
  execute 'set local role authenticated';
  result:=public.community_admin(owner_name);
  assert result->'members'->0->>'avatarPath'=photo_path, 'administrator sees public avatar';
  assert not (result->'members'->0 ? 'introduction'), 'administrator cannot read another introduction';
  assert not voku_private.profile_photo_removable(photo_path), 'foreign avatar removal denied';
  result:=public.community_account();
  assert result->'profile'->>'introduction'='', 'other account reads its own empty introduction';

  execute 'reset role';
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  result:=public.community_post(post_id);
  assert result->'post'->>'authorAvatarPath'=photo_path, 'public post includes author avatar';
  assert position('검증용 비공개 소개' in result::text)=0, 'public post excludes private introduction';
  execute 'reset role';
end $$;
rollback;
select 'pass: deployed profile permissions; all generated data rolled back' as result;
