// Produces reviewable SQL; never connects to production or creates members.
// node scripts/seed-community-samples.mjs <existing-author-uuid> > /tmp/samples.sql
// node scripts/seed-community-samples.mjs --cleanup > /tmp/cleanup.sql
const batch = "community-ux-2026-10-11";
if (process.argv[2] === "--cleanup") {
  console.log(
    `update public.community_posts set status='deleted',updated_at=now() where sample_batch='${batch}';`,
  );
  process.exit(0);
}
const author = process.argv[2];
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    author || "",
  )
)
  throw Error("Existing author UUID required");
const entries = [
  [
    "일상",
    "커뮤니티 화면을 함께 살펴보세요",
    "이 글을 포함한 [예시] 게시글은 목록과 댓글의 사용성을 확인하기 위해 준비했습니다. 실제 동문의 경험이나 운영 공지, 모임 일정이 아닙니다.\n\n말머리로 골라 읽고, 글 아래의 ‘다른 글 이어 읽기’로 다음 이야기를 열어보세요. 예시 글은 확인이 끝난 뒤 한꺼번에 정리할 수 있습니다.",
    null,
    "notice",
  ],
  [
    "추억",
    "방송실 책상 위, 원고 한 장의 기억",
    "큐시트의 종이 질감과 오래된 글씨를 떠올려 보는 사진 글입니다. 사진을 눌러 크게 보고, 목록에서는 작은 대표 사진으로 구별해 보세요.",
  ],
  [
    "일상",
    "오랜만에 들러 짧은 인사를 남겨요",
    "자주 오지 못해도 안부 한 줄 남길 수 있는 공간이면 좋겠습니다. 오늘은 읽고 싶은 이야기 한 편을 골라 천천히 읽어보세요.",
  ],
  [
    "음악",
    "가을 저녁에 어울리는 선곡 이야기",
    "**한 곡을 고르던 시간**\n\n방송의 첫 곡과 마지막 곡을 고르는 기준은 참 달랐을 것 같아요. 지금 다시 선곡한다면 어떤 분위기로 시작하고 싶으신가요?\n\n- 첫 곡: 하루를 여는 가벼운 분위기\n- 중간 곡: 이야기에 잠깐 숨을 주는 곡\n- 마지막 곡: 여운이 오래 남는 음악",
  ],
  [
    "질문",
    "큐시트를 보다가 궁금한 내용이 생겼어요",
    "자료를 읽으면서 궁금해진 표현이나 프로그램 구성을 질문하는 글의 예시입니다. 아래 답글이 길어졌을 때 접고 펼치기와 공감을 확인해 보세요.",
  ],
  [
    "일상",
    "운영진에게만 남기는 질문 예시",
    "비밀글의 제목과 본문, 연결 자료, 사진, 댓글은 작성자와 기존 운영진만 확인할 수 있습니다. 공개 목록에서는 내용 대신 비밀글 안내가 표시됩니다.",
    null,
    "secret",
  ],
  [
    "추억",
    "1994년 광교음악산책을 함께 읽어요",
    "당시 프로그램의 구성과 페이지 흐름을 함께 살펴보는 자료 이야기입니다. 연결된 큐시트를 열고 돌아왔을 때 읽던 목록이 유지되는지도 확인해 보세요.",
    "voku_1994_1_gwanggyo_music_walk_01",
  ],
  [
    "동문소식",
    "동문들의 소식을 나누는 글은 이렇게",
    "가까운 근황이나 새로운 도전을 소개하는 형식의 예시입니다. 이 글에는 실제 사람의 소식이나 확정된 모임 일정이 담겨 있지 않습니다.",
  ],
  [
    "추억",
    "녹음 버튼을 누르기 직전의 정적",
    "시작 신호를 기다리던 짧은 정적을 떠올려 봅니다. 누군가는 원고를 다시 읽고, 누군가는 음량을 살폈겠지요.\n\n여러분이라면 어떤 장면부터 기억나실까요?",
  ],
  [
    "음악",
    "선곡 노트에 적고 싶던 한 줄",
    "노래 제목 옆에 곡의 분위기를 한 줄로 적어두는 선곡 노트의 예시입니다. 다른 분의 이야기에는 댓글로 공감하는 마음을 남겨보세요.",
  ],
  [
    "질문",
    "오래된 글로 빠르게 이동할 수 있나요?",
    "목록 아래에서 페이지 번호, 처음·끝 버튼, 원하는 페이지 입력으로 이동할 수 있어요. 두 번째 페이지에서 글을 열었다가 목록으로 돌아오는 흐름도 확인해 보세요.",
  ],
  [
    "일상",
    "오늘의 작은 안부 한 줄",
    "짧은 글도 편하게 남길 수 있도록 구성한 예시입니다. 오늘 하루도 편안히 보내세요.",
  ],
  [
    "추억",
    "1988년 VOKU 기자석의 첫 페이지",
    "오래된 방송 자료를 읽으며 이야기를 붙이는 글의 예시입니다. 아래의 큐시트 연결에서 실제 공개 자료를 읽을 수 있습니다.",
    "voku_1988_1_voku_reporters_desk_01",
  ],
  [
    "음악",
    "방송의 시작과 끝을 잇는 음악",
    "오프닝과 클로징 음악이 다르면 같은 이야기에도 다른 느낌이 생깁니다. 선곡 이야기를 여러 댓글로 나누는 모습을 확인해 보세요.",
  ],
  [
    "동문소식",
    "새로운 취미를 소개하는 근황 글",
    "오랜만에 찾은 동문에게 새로운 취미나 관심사를 소개하는 형식입니다. 실제 인물의 근황이 아닌 화면 확인용 글이에요.",
  ],
  [
    "질문",
    "사진은 몇 장까지 올릴 수 있나요?",
    "현재는 JPG·PNG·WebP 사진을 한 글에 6장까지 넣을 수 있어요. 처음 넣은 사진이 대표 사진이 됩니다. 일반 문서 파일은 아직 첨부하지 않습니다.",
  ],
  [
    "일상",
    "점심시간에 잠깐 읽고 갑니다",
    "바쁜 하루 중 짧게 들러 글 한 편을 읽고 가는 방문을 생각하며 작성한 예시입니다. 이전에 보던 말머리와 페이지로 자연스럽게 돌아갈 수 있는지 살펴보세요.",
  ],
  [
    "추억",
    "손글씨 원고를 천천히 읽는 오후",
    "여러 단락이 있는 글의 읽기 흐름을 확인하는 예시입니다.\n\n원고를 넘기다 보면 문장의 길이뿐 아니라 종이 위에 남은 흔적도 눈에 들어옵니다. 고친 낱말과 여백의 표시를 보며 준비하던 시간을 상상해 봅니다.\n\n첫 페이지는 제목과 순서를, 다음 페이지는 이야기의 전개를 보여줍니다. 한 장만 볼 때와 차례대로 읽을 때의 느낌이 다를 수 있습니다.\n\n이야기를 다 읽었다면 댓글 아래에 이어지는 목록에서 다른 글을 골라보세요. 긴 글에서도 다음 글로 이동하는 길이 자연스러운지 확인하기 위한 구성입니다.",
    "voku_1998_1_an_afternoon_with_poetry_01",
  ],
  [
    "음악",
    "다시 만들고 싶은 나만의 방송 순서",
    "**방송 순서 예시**\n\n- 짧은 인사\n- 오늘의 이야기\n- 음악과 함께 쉬어가기\n- 다음 만남을 약속하는 마무리\n\n복잡한 편집 없이 간단한 목록으로 구성한 글입니다.",
  ],
  [
    "동문소식",
    "서로의 반가운 변화를 기록해요",
    "여러 종류의 근황 글을 목록에서 구분해 보는 예시입니다. 사적인 연락처나 실제 개인 정보는 포함하지 않았습니다.",
  ],
  [
    "질문",
    "작성하던 글을 잠시 멈춰도 되나요?",
    "제목과 본문, 선택한 사진은 임시 저장이 끝나면 같은 기기의 같은 브라우저에서 복원됩니다. 수정 중인 글도 이어서 작성할 수 있습니다.",
  ],
  [
    "추억",
    "모닝커피 한 회차와 함께하는 아침",
    "2011년 모닝커피 자료에 이야기를 연결하는 예시입니다. 자료를 읽고 게시글로 돌아와 다른 의견을 이어가는 흐름을 살펴보세요.",
    "voku_2011_1_morning_coffee_01",
  ],
  [
    "일상",
    "처음 오신 분께 건네는 인사",
    "처음 오셨다면 전체 글을 둘러본 뒤 관심 있는 말머리를 눌러보세요. 짧은 인사와 질문도 함께 나눌 수 있습니다.",
  ],
  [
    "음악",
    "제목만 기억나는 노래에 대한 이야기",
    "특정 가사 대신 곡을 들었던 상황이나 분위기를 설명하는 음악 글의 예시입니다. 긴 제목과 짧은 본문이 목록에서 어떻게 보이는지 확인해 보세요.",
  ],
  [
    "질문",
    "제목이 길면 목록에서 어떻게 보일까요 — 작은 화면에서도 이야기의 주제를 알아볼 수 있을까요?",
    "휴대폰 화면에서 제목 줄바꿈, 댓글 수, 새글 표시가 서로 겹치지 않는지 확인하는 예시입니다.",
  ],
  [
    "동문소식",
    "함께 나누고 싶은 소식을 기다립니다",
    "동문소식 말머리의 오래된 글을 확인하기 위한 예시입니다. 모임 장소나 날짜가 확정된 안내가 아닙니다.",
  ],
  [
    "추억",
    "2004년 음악이 있는 아침을 펼쳐봅니다",
    "한 회차의 큐시트를 함께 읽는 자료 이야기입니다. 연결된 실제 자료의 원문은 수정하지 않았습니다.",
    "voku_2004_1_a_morning_with_music_01",
  ],
  [
    "질문",
    "개인적인 문의를 남기는 비밀글 예시",
    "비밀글을 목록에서 구별하고, 작성자 계정으로 내용을 열람하는 흐름을 확인하기 위한 글입니다. 실제 개인 정보나 민감한 내용은 없습니다.",
    null,
    "secret",
  ],
  [
    "일상",
    "첫 페이지로 돌아가기 전에",
    "목록의 마지막 부분을 읽고 처음 버튼으로 돌아가는 흐름을 확인해 보세요. 여러 페이지를 오가며 글을 읽어도 말머리와 검색 조건이 이어집니다.",
  ],
  [
    "추억",
    "오래된 이야기의 마지막 장",
    "오래된 글이 모인 페이지에도 댓글과 자료 연결, 이어 읽기 기능을 같은 방식으로 사용할 수 있습니다. 다음 방문에도 편하게 다시 찾아와 주세요.",
  ],
];
const rows = entries.map(([category, title, body, recordId, kind], i) => ({
  category,
  title: `[예시] ${title}`,
  body:
    body +
    "\n\n※ 화면 확인용 예시입니다. 실제 동문이 작성한 경험이나 소식이 아닙니다.",
  recordId: recordId || null,
  secret: kind === "secret",
  pinned: kind === "notice",
  hours: i < 7 ? i + 1 : 24 * (i - 5),
  comments: [4, 8, 12, 17, 21].includes(i) ? 4 : i % 3 === 0 ? 1 : 0,
}));
console.log(`begin;
do $seed$
declare batch text:='${batch}'; owner_id uuid:='${author}'; participant uuid; item jsonb; pid uuid; root_id uuid; i integer;
begin
  perform pg_advisory_xact_lock(hashtext(batch));
  if not exists(select 1 from public.community_profiles where id=owner_id) then raise exception 'Sample author not found'; end if;
  if exists(select 1 from public.community_posts where sample_batch=batch) then return; end if;
  select id into participant from public.community_profiles where id<>owner_id order by created_at limit 1;
  participant:=coalesce(participant,owner_id);
  for item in select value from jsonb_array_elements($data$${JSON.stringify(rows)}$data$::jsonb) loop
    insert into public.community_posts(author_id,category,title,body,record_id,pinned,is_secret,sample_batch,body_format,created_at,updated_at)
      values(owner_id,item->>'category',item->>'title',item->>'body',nullif(item->>'recordId',''),(item->>'pinned')::boolean,(item->>'secret')::boolean,batch,'markdown',now()-make_interval(hours=>(item->>'hours')::integer),now()-make_interval(hours=>(item->>'hours')::integer)) returning id into pid;
    if (item->>'comments')::integer>0 then
      insert into public.community_comments(post_id,author_id,body,is_sample) values(pid,participant,'[예시 대화] 글을 읽고 떠오른 생각을 나누는 댓글입니다. 답글과 공감의 위치를 확인해 보세요.',true) returning id into root_id;
      for i in 1..(item->>'comments')::integer loop
        insert into public.community_comments(post_id,author_id,parent_id,body,is_sample) values(pid,case when i%2=0 then participant else owner_id end,root_id,'[예시 답글 '||i||'] 같은 댓글에 이어지는 대화입니다. 답글이 많아지면 접거나 펼쳐서 읽을 수 있어요.',true);
      end loop;
    end if;
  end loop;
end $seed$;
commit;
select id,title,is_secret,pinned,created_at from public.community_posts where sample_batch='${batch}' order by created_at desc;
`);
