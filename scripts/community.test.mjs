import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
let backfilled;
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  alice: "00000000-0000-4000-8000-000000000002",
  bob: "00000000-0000-4000-8000-000000000003",
  unconfirmed: "00000000-0000-4000-8000-000000000004",
};
const first = "10000000-0000-4000-8000-000000000001",
  second = "10000000-0000-4000-8000-000000000002";
async function as(user, fn) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user ? ids[user] : "",
  ]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role").catch(error => { if (error.code !== "25P02") throw error; });
  }
}
async function action(kind, payload) {
  return (
    await db.query("select public.community_action($1,$2::jsonb) result", [
      kind,
      JSON.stringify(payload),
    ])
  ).rows[0].result;
}
async function feed(args = {}) {
  return (
    await db.query("select public.community_feed($1,$2,$3,$4,$5) result", [
      args.category || "",
      args.sort || "latest",
      args.query || "",
      args.page || 1,
      !!args.linked,
    ])
  ).rows[0].result;
}
async function thread(id) {
  return (await db.query("select public.community_post($1) result", [id]))
    .rows[0].result;
}
async function account() {
  return (await db.query("select public.community_account() result")).rows[0]
    .result;
}
async function activity(kind, page = 1) {
  return (await db.query("select public.community_activity($1,$2) result", [kind, page])).rows[0].result;
}
async function readNotifications(id = null) {
  return db.query("select public.community_read_notifications($1)", [id]);
}
async function withActivityFixture(check) {
  await db.exec("begin");
  try {
    ids.activity = crypto.randomUUID();
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'activity@example.invalid',now(),'{\"nickname\":\"활동회원\"}')", [ids.activity]);
    // Equal timestamps exercise deterministic page boundaries as well as old limits.
    const posts = (await db.query("insert into public.community_posts(author_id,category,title,body,created_at) select $1,'음악','활동 '||n,'본문','2026-10-01' from generate_series(1,105)n returning id", [ids.activity])).rows;
    await db.query("insert into public.community_comments(post_id,author_id,body,created_at) select $1,$2,'이전 댓글 '||n,'2026-10-01' from generate_series(1,105)n", [posts[0].id, ids.activity]);
    await db.query("insert into public.community_notifications(user_id,post_id,text,created_at) select $1,$2,'이전 알림 '||n,'2026-10-01' from generate_series(1,55)n", [ids.activity, posts[0].id]);
    await check(posts);
  } finally {
    await db.exec("rollback;reset role");
  }
}
async function rejectsInTransaction(fn, pattern) {
  await db.exec("savepoint expected_error");
  try { await assert.rejects(fn, pattern); }
  finally { await db.exec("rollback to savepoint expected_error;release savepoint expected_error"); }
}
before(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,owner_id text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb,raw_app_meta_data jsonb default '{"provider":"email"}');
    create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const publicCodes = file.endsWith("community_public_post_codes.sql");
    if (publicCodes) {
      await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('99999999-0000-4000-8000-000000000001','backfill@example.invalid',now(),'{"nickname":"backfill"}');
        insert into public.community_posts(id,author_id,category,title,body,created_at,updated_at) values('99999999-0000-4000-8000-000000000002','99999999-0000-4000-8000-000000000001','추억','보존 제목','보존 본문','2026-01-01','2026-01-02');`);
    }
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
    if (publicCodes) {
      backfilled = (await db.query("select id,public_code,title,body,created_at::text,updated_at::text from public.community_posts where id='99999999-0000-4000-8000-000000000002'")).rows[0];
      await db.exec("delete from public.community_posts where id='99999999-0000-4000-8000-000000000002';delete from auth.users where id='99999999-0000-4000-8000-000000000001';");
    }
  }
  for (const [name, id] of Object.entries(ids))
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)", [
      id,
      `${name}@example.invalid`,
      name === "unconfirmed" ? null : "2026-10-10T00:00:00Z",
      JSON.stringify({ nickname: name, role: "admin" }),
    ]);
  await db.query("update voku_private.members set role='admin' where id=$1", [
    ids.admin,
  ]);
  await db.query(
    "insert into public.community_posts(id,author_id,category,title,body) values($1,$2,'일상','첫 방송 이야기','함께 나누는 본문'),($3,$4,'질문','두 번째 질문','질문 본문')",
    [first, ids.alice, second, ids.bob],
  );
});
beforeEach(async () => {
  await db.exec("reset role;delete from voku_private.rate_limits;");
});
after(() => db.close());

test("public reading works; anonymous writes and administration do not", async () => {
  await as(null, async () => {
    assert.equal((await feed()).total, 2);
    await assert.rejects(
      action("post_save", { category: "일상", title: "불가", body: "본문" }),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.community_admin()"),
      /permission denied/,
    );
  });
});
test("signup metadata cannot grant a role and unverified accounts cannot write", async () => {
  await as("alice", async () =>
    assert.equal((await account()).profile.role, "member"),
  );
  await as("unconfirmed", () =>
    assert.rejects(action("like", { postId: first, value: true }), /이메일/),
  );
});
test("direct writes and private member data are denied to authenticated users", async () => {
  await as("alice", async () => {
    await assert.rejects(
      db.query("update public.community_posts set pinned=true where id=$1", [
        first,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from voku_private.members"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from voku_private.audit"),
      /permission denied/,
    );
  });
});
test("members cannot use moderation RPCs, overwrite others, or spoof ownership", async () => {
  await as("bob", async () => {
    for (const kind of ["post_pin", "post_lock", "post_visibility"])
      await assert.rejects(
        action(kind, { postId: first, value: true, reason: "임의 변경" }),
        /권한/,
      );
    await assert.rejects(
      action("post_save", {
        id: first,
        title: "변조",
        body: "변조",
        category: "일상",
      }),
      /본인/,
    );
    await assert.rejects(action("post_delete", { postId: first }), /본인/);
    await assert.rejects(
      action("set_role", { userId: ids.bob, role: "admin" }),
      /권한/,
    );
    const created = await action("post_save", {
      category: "음악",
      title: "새 선곡",
      body: "본문",
      authorId: ids.admin,
    });
    assert.equal((await thread(created.postId)).post.authorId, ids.bob);
  });
});
test("recommendations are idempotent and cannot be self-awarded; saves are private", async () => {
  await as("alice", () =>
    assert.rejects(action("like", { postId: first, value: true }), /본인/),
  );
  await as("bob", async () => {
    await action("like", { postId: first, value: true });
    await action("like", { postId: first, value: true });
    assert.equal((await thread(first)).post.likes, 1);
    await action("bookmark", { postId: first, value: true });
    assert.equal((await account()).saved[0].id, first);
  });
  await as("alice", async () =>
    assert.equal(
      (await db.query("select * from public.community_bookmarks")).rows.length,
      0,
    ),
  );
});
test("reply validation, notifications and comment author-only edit rules are enforced", async () => {
  const result = await as("bob", () =>
    action("comment_save", { postId: first, body: "댓글입니다" }),
  );
  await as("alice", async () => {
    assert.equal((await account()).notifications.length, 1);
    await assert.rejects(
      action("comment_save", {
        postId: second,
        body: "잘못된 답글",
        parentId: result.commentId,
      }),
      /답글/,
    );
    await assert.rejects(
      action("comment_save", {
        postId: first,
        id: result.commentId,
        body: "타인 댓글 수정",
      }),
      /본인/,
    );
    await action("comment_save", {
      postId: first,
      parentId: result.commentId,
      body: "답글입니다",
    });
  });
  await as("bob", async () => {
    await action("comment_delete", { postId: first, id: result.commentId });
    const comments = (await thread(first)).comments;
    assert.equal(comments.length, 2);
    assert.equal(comments[0].body, "삭제된 댓글입니다.");
    assert.equal(comments[1].parentId, result.commentId);
  });
});
test("locked discussions reject comments, and moderation leaves an audit record", async () => {
  await as("admin", () => action("post_lock", { postId: second, value: true }));
  await as("alice", () =>
    assert.rejects(
      action("comment_save", { postId: second, body: "잠김" }),
      /잠긴/,
    ),
  );
  await as("admin", async () => {
    const data = (await db.query("select public.community_admin() result"))
      .rows[0].result;
    assert.ok(data.audit.some((a) => a.action === "post_lock"));
    await action("post_lock", { postId: second, value: false });
  });
});
test("reports remain private, cannot be duplicated and hide content only through staff action", async () => {
  await as("bob", () =>
    action("report", {
      postId: first,
      reason: "광고·도배",
      detail: "확인 요청",
    }),
  );
  await db.exec("delete from voku_private.rate_limits");
  await as("bob", () =>
    assert.rejects(
      action("report", { postId: first, reason: "욕설·비방" }),
      /이미/,
    ),
  );
  await as("alice", async () =>
    assert.equal(
      (await db.query("select * from public.community_reports")).rows.length,
      0,
    ),
  );
  const reports = await as(
    "admin",
    async () =>
      (await db.query("select public.community_admin() result")).rows[0].result
        .reports,
  );
  await as("admin", () =>
    assert.rejects(
      action("resolve_report", { id: reports[0].id, reason: "선택 누락" }),
      /처리 방식/,
    ),
  );
  await as("admin", () =>
    action("resolve_report", {
      id: reports[0].id,
      decision: "hide",
      reason: "신고 내용 확인",
    }),
  );
  await as(null, async () => {
    assert.ok(!(await feed()).posts.some((p) => p.id === first));
    await assert.rejects(thread(first), /공개되지/);
    assert.equal(
      (
        await db.query("select * from public.community_posts where id=$1", [
          first,
        ])
      ).rows.length,
      0,
    );
  });
  await as("bob", async () =>
    assert.equal((await account()).reports[0].status, "resolved"),
  );
  await as("admin", () =>
    action("post_visibility", {
      postId: first,
      value: false,
      reason: "확인 후 공개",
    }),
  );
});
test("suspensions block all write RPCs, remain visible to owner, and can be lifted", async () => {
  await as("admin", () =>
    action("suspend", { userId: ids.bob, days: 7, reason: "도배 제한" }),
  );
  await as("bob", async () => {
    assert.equal((await account()).profile.suspensionReason, "도배 제한");
    await assert.rejects(
      action("like", { postId: first, value: false }),
      /제한/,
    );
    await assert.rejects(action("profile", { nickname: "우회계정" }), /제한/);
  });
  await as("admin", () => action("restore_member", { userId: ids.bob }));
  await as("bob", () => action("like", { postId: first, value: false }));
});
test("moderators cannot change roles or restrict administrators", async () => {
  await as("admin", () =>
    action("set_role", { userId: ids.alice, role: "moderator" }),
  );
  await as("alice", async () => {
    await assert.rejects(
      action("set_role", { userId: ids.bob, role: "moderator" }),
      /관리자/,
    );
    await assert.rejects(
      action("suspend", { userId: ids.admin, days: 7, reason: "권한 우회" }),
      /권한/,
    );
  });
  await as("admin", async () => {
    await assert.rejects(
      action("set_role", { userId: ids.admin, role: "member" }),
      /권한/,
    );
    await action("set_role", { userId: ids.alice, role: "member" });
  });
});
test("publishing and comment cooldowns prevent rapid repeats", async () => {
  await as("alice", async () => {
    await action("post_save", {
      category: "일상",
      title: "속도 확인",
      body: "처음 글",
    });
    await assert.rejects(
      action("post_save", {
        category: "일상",
        title: "속도 확인",
        body: "연속 글",
      }),
      /잠시/,
    );
  });
});
test("server pagination and literal search preserve stable pages", async () => {
  await db.query(
    "insert into public.community_posts(author_id,category,title,body) select $1,'일상','쪽 확인 '||n,'검색_기호%' from generate_series(1,26)n",
    [ids.alice],
  );
  await as(null, async () => {
    const one = await feed({ query: "검색_기호%", page: 1 }),
      two = await feed({ query: "검색_기호%", page: 2 });
    assert.equal(one.total, 26);
    assert.equal(one.posts.length, 20);
    assert.equal(two.posts.length, 6);
    assert.ok(!two.posts.some((p) => one.posts.some((q) => p.id === q.id)));
    assert.equal((await feed({ query: "' OR true --" })).total, 0);
  });
});
test("blocking hides ordinary posts, while operator announcements stay available", async () => {
  await as("bob", () => action("block", { userId: ids.alice, value: true }));
  await as("bob", async () =>
    assert.ok(!(await feed()).posts.some((p) => p.authorId === ids.alice)),
  );
  await as("admin", () => action("post_pin", { postId: first, value: true }));
  await as("bob", async () =>
    assert.ok((await feed()).notices.some((p) => p.id === first)),
  );
});

test("moderation rejects missing duration and missing role", async () => {
  await as("admin", async () => {
    await assert.rejects(
      action("suspend", { userId: ids.bob, reason: "기간 누락" }),
      /기간/,
    );
    await assert.rejects(action("set_role", { userId: ids.bob }), /관리자/);
  });
});

test("existing accounts retain empty optional affiliation data", async () => {
  await as("alice", async () => {
    const p = (await account()).profile;
    assert.equal(p.admissionYear, null);
    assert.equal(p.cohort, null);
  });
});
test("signup stores validated affiliation independently of admission timing and ignores role metadata", async () => {
  const id = crypto.randomUUID();
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'affiliation@example.invalid',null,$2)",
    [
      id,
      JSON.stringify({
        nickname: "새학번회원",
        admission_year: 2018,
        cohort: 94,
        role: "admin",
      }),
    ],
  );
  const row = (
    await db.query(
      "select admission_year,cohort,role from voku_private.members where id=$1",
      [id],
    )
  ).rows[0];
  assert.deepEqual(row, { admission_year: 2018, cohort: 94, role: "member" });
  for (const metadata of [
    { admission_year: "18", cohort: 93 },
    { admission_year: 9999, cohort: 93 },
    { admission_year: 2018, cohort: 0 },
    { admission_year: 2018, cohort: 1000 },
    { admission_year: 2018, cohort: "93기" },
  ]) {
    const invalidId = crypto.randomUUID();
    await assert.rejects(
      db.query(
        "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'invalid@example.invalid',null,$2)",
        [invalidId, JSON.stringify({ nickname: "가입검증회원", ...metadata })],
      ),
      /학번|입학년도|기수/,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int count from auth.users where id=$1",
          [invalidId],
        )
      ).rows[0].count,
      0,
    );
  }
});
test("profile edits save own affiliation, ignore spoofed ownership, and keep fields out of public profiles", async () => {
  await as("alice", async () => {
    await action("profile", {
      nickname: "alice",
      admissionYear: 2018,
      cohort: 97,
      userId: ids.bob,
      role: "admin",
    });
    const p = (await account()).profile;
    assert.equal(p.admissionYear, 2018);
    assert.equal(p.cohort, 97);
    assert.equal(p.role, "member");
    const publicRow = (
      await db.query("select * from public.community_profiles where id=$1", [
        ids.alice,
      ])
    ).rows[0];
    assert.equal("admission_year" in publicRow, false);
    assert.equal("cohort" in publicRow, false);
  });
  await as("bob", async () =>
    assert.equal((await account()).profile.admissionYear, null),
  );
  await as("admin", async () => {
    const results = (
      await db.query("select public.community_admin('97기') result")
    ).rows[0].result;
    assert.ok(
      results.members.some((p) => p.id === ids.alice && p.cohort === 97),
    );
  });
});
test("nickname-only updates preserve existing affiliation for older clients", async () => {
  await as("alice", async () => {
    await action("profile", { nickname: "alice" });
    const p = (await account()).profile;
    assert.equal(p.admissionYear, 2018);
    assert.equal(p.cohort, 97);
  });
});
test("invalid profile fields are rejected before any profile changes", async () => {
  await as("alice", async () => {
    for (const fields of [
      { admissionYear: 18 },
      { admissionYear: 9999 },
      { cohort: 0 },
      { cohort: -1 },
      { cohort: 1000 },
      { cohort: 1.5 },
    ]) {
      await assert.rejects(
        action("profile", { nickname: "바뀌면안됨", ...fields }),
        /학번|입학년도|기수/,
      );
      assert.equal((await account()).profile.nickname, "alice");
    }
  });
});
test("members may clear optional fields", async () => {
  await as("alice", async () => {
    await action("profile", {
      nickname: "alice",
      admissionYear: null,
      cohort: null,
    });
    const p = (await account()).profile;
    assert.equal(p.admissionYear, null);
    assert.equal(p.cohort, null);
  });
});

test("admin totals are independent of search and the 100-item display limit", async () => {
  await db.query(
    "insert into public.community_posts(author_id,category,title,body,pinned) select $1,'일상','운영 공지 '||n,'공지 본문',true from generate_series(1,102)n",
    [ids.admin],
  );
  await as("admin", async () => {
    const all = (await db.query("select public.community_admin() result"))
      .rows[0].result;
    const filtered = (
      await db.query("select public.community_admin('매칭없는검색') result")
    ).rows[0].result;
    assert.equal(all.posts.length, 100);
    assert.equal(all.stats.pinnedPosts, 103);
    assert.equal(filtered.posts.length, 0);
    assert.deepEqual(filtered.stats, all.stats);
  });
});


test("Kakao signup requires a real identity and nickname onboarding before community writes", async () => {
  const id = crypto.randomUUID();
  ids.kakao = id;
  await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
    values($1,null,null,'{"nickname":"카카오실명","role":"admin","admission_year":2018}','{"provider":"kakao"}')`, [id]);
  await as("kakao", async () => {
    const profile = (await account()).profile;
    assert.equal(profile.profileComplete, false);
    assert.equal(profile.role, "member");
    assert.equal(profile.admissionYear, null);
    assert.notEqual(profile.nickname, "카카오실명");
    await assert.rejects(action("profile", {nickname:"카카오회원"}), /인증/);
  });
  await db.query("insert into auth.identities(user_id,provider,identity_data) values($1,'kakao','{}')", [id]);
  await as("kakao", async () => {
    await assert.rejects(action("like", {postId:first,value:true}), /닉네임 설정/);
    await assert.rejects(action("profile", {nickname:"alice"}), /unique/);
    assert.equal((await account()).profile.profileComplete, false);
    await action("profile", {nickname:"카카오회원",admissionYear:2018,cohort:94,role:"admin",userId:ids.admin});
    const profile = (await account()).profile;
    assert.equal(profile.profileComplete, true);
    assert.deepEqual(profile.providers, ["kakao"]);
    assert.equal(profile.role, "member");
    assert.equal(profile.admissionYear, 2018);
    assert.equal(profile.cohort, 94);
    await action("like", {postId:first,value:true});
    await assert.rejects(db.query("select voku_private.community_action('profile','{}')"), /permission denied/);
    await assert.rejects(db.query("select voku_private.require_identity()"), /permission denied/);
  });
  await db.query("update voku_private.members set suspended_until=now()+interval '1 day' where id=$1", [id]);
  await as("kakao", () => assert.rejects(action("profile",{nickname:"변경불가"}), /제한/));
});

test("user-editable metadata cannot impersonate a Kakao identity", async () => {
  await db.query(`update auth.users set raw_user_meta_data=raw_user_meta_data || '{"provider":"kakao","profile_complete":true}' where id=$1`, [ids.unconfirmed]);
  await as("unconfirmed", () => assert.rejects(action("profile",{nickname:"위조회원"}), /인증/));
});


test("dashboard-created email accounts default to incomplete ordinary members", async () => {
  const id = crypto.randomUUID();
  ids.operatorCandidate = id;
  await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'operator@example.invalid',null,'{}')", [id]);
  await as("operatorCandidate", async () => {
    const p = (await account()).profile;
    assert.equal(p.profileComplete,false);
    assert.equal(p.role,"member");
    await assert.rejects(action("profile",{nickname:"운영후보"}),/인증/);
  });
  await db.query("update auth.users set email_confirmed_at=now() where id=$1",[id]);
  await as("operatorCandidate", async () => {
    await assert.rejects(action("like",{postId:first,value:true}),/닉네임 설정/);
    await action("profile",{nickname:"운영후보",role:"admin"});
    assert.equal((await account()).profile.role,"member");
    await assert.rejects(db.query("select public.community_admin()"),/운영 권한/);
  });
});

test("activity pages expose older own records beyond the former 100/50 limits with stable boundaries", async () => {
  await withActivityFixture(async () => {
    await as("activity", async () => {
      const summary = await account();
      assert.equal(summary.posts.length, 100);
      assert.equal(summary.comments.length, 100);
      assert.equal(summary.notifications.length, 50);
      assert.equal(summary.unreadNotificationCount, 55);
      for (const [kind, total] of [["posts",105],["comments",105],["notifications",55]]) {
        const found = [];
        for (let page = 1; page <= Math.ceil(total / 20); page++) {
          const result = await activity(kind, page);
          assert.equal(result.total, total);
          assert.equal(result.kind, kind);
          assert.equal(result.page, page);
          assert.equal(result.pageSize, 20);
          found.push(...result.items.map(item => item.id));
          if (kind !== "notifications") assert.ok(result.items.every(item => item.authorId === ids.activity));
          assert.deepEqual(await activity(kind, page), result);
        }
        assert.equal(new Set(found).size, total);
        assert.equal(found.length, total);
      }
      assert.equal((await activity("posts", -1)).page, 1);
      assert.equal((await activity("posts", 2147483647)).page, 6);
      await rejectsInTransaction(() => activity("members"), /활동 분류/);
    });
    await as("bob", async () => {
      for (const kind of ["posts","comments"]) assert.ok((await activity(kind)).items.every(item => item.authorId === ids.bob));
      assert.ok((await activity("notifications")).items.every(item => !item.text.startsWith("이전 알림")));
    });
  });
});

test("hidden/deleted content and comments on hidden posts are excluded from own activity totals", async () => {
  await withActivityFixture(async posts => {
    await db.query("update public.community_posts set status='hidden' where id=$1", [posts[0].id]);
    await db.query("update public.community_posts set status='deleted' where id=$1", [posts[1].id]);
    await as("activity", async () => {
      assert.equal((await activity("posts")).total, 103);
      assert.equal((await activity("comments")).total, 0);
    });
    await db.query("update public.community_posts set status='published' where id=$1", [posts[0].id]);
    await db.query("update public.community_comments set status='hidden' where id in (select id from public.community_comments where author_id=$1 limit 2)", [ids.activity]);
    await as("activity", async () => assert.equal((await activity("comments")).total, 103));
  });
});

test("reading one notification affects only that notification; explicit mark-all covers every page", async () => {
  await withActivityFixture(async posts => {
    const foreign = (await db.query("insert into public.community_notifications(user_id,post_id,text) values($1,$2,'타인의 알림') returning id", [ids.bob, posts[0].id])).rows[0].id;
    await as("activity", async () => {
      const firstPage = await activity("notifications");
      const chosen = firstPage.items[0].id;
      await readNotifications(chosen);
      await readNotifications(chosen);
      let summary = await account();
      assert.equal(summary.unreadNotificationCount, 54);
      assert.equal((await activity("notifications")).items.filter(n => n.read).length, 1);
      await readNotifications(foreign);
      await readNotifications(crypto.randomUUID());
      await rejectsInTransaction(() => readNotifications("invalid-id"), /uuid/);
      assert.equal((await account()).unreadNotificationCount, 54);
      await readNotifications();
      summary = await account();
      assert.equal(summary.unreadNotificationCount, 0);
      assert.ok((await activity("notifications", 3)).items.every(n => n.read));
    });
    assert.equal((await db.query("select is_read from public.community_notifications where id=$1", [foreign])).rows[0].is_read, false);
  });
});

test("activity APIs require authentication and do not grant direct notification updates", async () => {
  await as(null, async () => {
    await assert.rejects(activity("posts"), /permission denied/);
    await assert.rejects(readNotifications(), /permission denied/);
  });
  await as("bob", async () => {
    await assert.rejects(db.query("update public.community_notifications set is_read=true"), /permission denied/);
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(activity("notifications"), /로그인/);
    await assert.rejects(readNotifications(), /로그인/);
  });
});

async function publishingFixture(check) {
  await db.exec('begin');
  try { await db.exec('delete from public.community_blocks'); await check(); } finally { await db.exec('rollback;reset role'); }
}
async function reserve(count = 1) {
  return (await db.query('select public.community_media_reserve($1) result', [count])).rows[0].result;
}
async function uploadMetadata(photo, metadata = { mimetype: 'image/jpeg', size: 2048 }) {
  return db.query("insert into storage.objects(bucket_id,name,metadata) values('community-photos',$1,$2)", [photo.path, metadata]);
}
const saveWithPhotos = (id, ids, extra = {}) => action('post_save', { id, title: '사진과 방송', body: '**방송실**\n- 기억', category: '추억', bodyFormat: 'markdown', photoIds: ids, ...extra });

test('photo reservations require completed membership and bound unfinished storage', () => publishingFixture(async () => {
  await rejectsInTransaction(() => as(null, () => reserve()), /permission denied/);
  await rejectsInTransaction(() => as('unconfirmed', () => reserve()), /이메일/);
  await rejectsInTransaction(() => as('alice', () => reserve(7)), /6장/);
  await as('alice', async () => { await reserve(6); await reserve(6); });
  await rejectsInTransaction(() => as('alice', () => reserve()), /미완료/);
  await db.query('update voku_private.members set suspended_until=now()+interval \'1 day\' where id=$1', [ids.bob]);
  await rejectsInTransaction(() => as('bob', () => reserve()), /제한/);
}));

test('private photo policies allow own immutable uploads and reveal only published attachments', () => publishingFixture(async () => {
  const [photo] = await as('alice', () => reserve());
  await rejectsInTransaction(() => as('bob', () => uploadMetadata(photo)), /row-level security/);
  await as('alice', () => uploadMetadata(photo));
  await as(null, async () => assert.equal((await db.query("select * from storage.objects where name=$1", [photo.path])).rows.length, 0));
  await as('alice', () => saveWithPhotos(first, [photo.id]));
  await as(null, async () => {
    assert.equal((await db.query('select * from storage.objects where name=$1', [photo.path])).rows.length, 1);
    const p = (await thread(first)).post;
    assert.equal(p.bodyFormat, 'markdown'); assert.deepEqual(p.photos, [{ id: photo.id, path: photo.path }]);
    assert.equal(p.views, 0);
  });
  await as('alice', async () => {
    assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [photo.path])).rows.length, 0);
    assert.equal((await db.query("update storage.objects set metadata='{}' where name=$1 returning id", [photo.path])).rows.length, 0);
  });
  await db.query("update public.community_posts set status='hidden' where id=$1", [first]);
  await as(null, async () => assert.equal((await db.query('select * from storage.objects where name=$1', [photo.path])).rows.length, 0));
  await db.query("update public.community_posts set status='deleted' where id=$1", [first]);
  await as('bob', async () => assert.equal((await db.query('select * from storage.objects where name=$1', [photo.path])).rows.length, 0));
}));

test('photo attachments validate upload, ownership, count, order and transaction rollback', () => publishingFixture(async () => {
  const photos = await as('alice', () => reserve(6));
  const [foreign] = await as('bob', () => reserve());
  await rejectsInTransaction(() => as('alice', () => saveWithPhotos(first, [photos[0].id])), /업로드/);
  for (const photo of photos) await as('alice', () => uploadMetadata(photo));
  await as('bob', () => uploadMetadata(foreign));
  await rejectsInTransaction(() => as('alice', () => saveWithPhotos(first, [foreign.id])), /본인의 사진/);
  await rejectsInTransaction(() => as('alice', () => saveWithPhotos(first, [photos[0].id, photos[0].id])), /중복/);
  await rejectsInTransaction(() => as('alice', () => saveWithPhotos(first, [...photos.map(p => p.id), foreign.id])), /6장/);
  assert.notEqual((await thread(first)).post.title, '사진과 방송');
  await as('alice', () => saveWithPhotos(first, photos.map(p => p.id).reverse()));
  assert.deepEqual((await thread(first)).post.photos.map(p => p.id), photos.map(p => p.id).reverse());
  await as('alice', () => saveWithPhotos(first, [photos[0].id]));
  assert.equal((await thread(first)).post.photos.length, 1);
  await as(null, async () => assert.equal((await db.query('select * from storage.objects where name=$1', [photos[1].path])).rows.length, 0));
  await as('alice', async () => {
    await db.query('select public.community_media_discard($1)', [[photos[1].id]]);
    assert.equal((await db.query('select * from public.community_media where id=$1', [photos[1].id])).rows.length, 1);
    await db.query('delete from storage.objects where name=$1', [photos[1].path]);
    await db.query('select public.community_media_discard($1)', [[photos[1].id]]);
    assert.equal((await db.query('select * from public.community_media where id=$1', [photos[1].id])).rows.length, 0);
  });
  await rejectsInTransaction(() => as('alice', () => saveWithPhotos(first, [], { bodyFormat: 'html' })), /본문 형식/);
  assert.equal((await thread(first)).post.photos.length, 1);
  await as('alice', () => action('post_save', { id: first, title: '이전 클라이언트', body: '본문', category: '일상' }));
  assert.equal((await thread(first)).post.photos.length, 1);
  assert.equal((await thread(first)).post.bodyFormat, 'markdown');
}));

test('malformed or oversized storage metadata cannot become a public attachment', () => publishingFixture(async () => {
  const photos = await as('alice', () => reserve(2));
  await as('alice', () => uploadMetadata(photos[0], { mimetype: 'image/svg+xml', size: 100 }));
  await as('alice', () => uploadMetadata(photos[1], { mimetype: 'image/jpeg', size: 2097153 }));
  for (const p of photos) await rejectsInTransaction(() => as('alice', () => saveWithPhotos(first, [p.id])), /업로드/);
}));

test('views deduplicate per Korean calendar day, exclude authors and protect hidden posts', () => publishingFixture(async () => {
  const visitor = crypto.randomUUID();
  const view = v => db.query('select public.community_post_view($1,$2) result', [first, v]).then(r => Number(r.rows[0].result));
  await as(null, async () => { assert.equal(await view(visitor), 1); assert.equal(await view(visitor), 1); assert.equal(await view(crypto.randomUUID()), 2); });
  await as('alice', async () => assert.equal(await view(visitor), 2));
  await as('bob', async () => { assert.equal(await view(visitor), 3); assert.equal(await view(crypto.randomUUID()), 3); });
  assert.equal((await thread(first)).post.views, 3);
  await db.query("update voku_private.post_viewers set viewed_on=viewed_on-1 where post_id=$1", [first]);
  await as('bob', async () => assert.equal(await view(visitor), 4));
  await db.query("update public.community_posts set status='hidden' where id=$1", [first]);
  await rejectsInTransaction(() => as(null, () => view(crypto.randomUUID())), /공개되지/);
  await rejectsInTransaction(() => as('bob', () => db.query('select * from voku_private.post_viewers')), /permission denied/);
  await rejectsInTransaction(() => as(null, () => view(null)), /방문/);
}));

test('secret posts redact list/search/thread and deny direct rows, media, reactions and views to other readers', () => publishingFixture(async () => {
  const [photo] = await as('alice', () => reserve());
  await as('alice', () => uploadMetadata(photo));
  await as('alice', () => saveWithPhotos(first, [photo.id]));
  await db.query("update public.community_posts set is_secret=true,pinned=false,created_at=clock_timestamp(),record_id='voku_private_record',title='비공개 제목',body='비공개 본문' where id=$1", [first]);
  const reply = (await db.query("insert into public.community_comments(post_id,author_id,body) values($1,$2,'비공개 댓글') returning id", [first, ids.alice])).rows[0].id;
  for (const who of [null, 'bob']) await as(who, async () => {
    const dto = (await feed()).posts.find(p => p.id === first);
    assert.equal(dto.title, '비밀글입니다'); assert.equal(dto.body, ''); assert.deepEqual(dto.photos, []); assert.equal(dto.recordId, null); assert.equal(dto.readable, false);
    assert.equal((await feed({ query: '비공개' })).total, 0);
    assert.equal((await feed({ category: '자료 이야기' })).total, 0);
    assert.equal((await thread(first)).comments.length, 0);
    for (const table of ['community_posts','community_comments','community_media']) {
      const column = table === 'community_posts' ? 'id' : 'post_id';
      assert.equal((await db.query(`select * from public.${table} where ${column}=$1`, [first])).rows.length, 0);
    }
    assert.equal((await db.query('select * from storage.objects where name=$1', [photo.path])).rows.length, 0);
  });
  for (const who of ['alice','admin']) await as(who, async () => {
    const t = await thread(first); assert.equal(t.post.body, '비공개 본문'); assert.equal(t.post.photos.length, 1); assert.equal(t.comments.find(c => c.id === reply).body, '비공개 댓글');
    assert.equal((await db.query('select * from storage.objects where name=$1', [photo.path])).rows.length, 1);
  });
  for (const kind of ['like','bookmark','comment_save','comment_like','report']) await rejectsInTransaction(() => as('bob', () => action(kind, {postId:first,id:reply,body:'침입',value:true,reason:'기타'})), /권한/);
  await rejectsInTransaction(() => as(null, () => db.query('select public.community_post_view($1,$2)', [first,crypto.randomUUID()])), /공개되지/);
}));

test('secret creation uses existing author/staff access and fixes visibility after publication', () => publishingFixture(async () => {
  const created = await as('bob', () => action('post_save', {category:'질문',title:'나만의 질문',body:'본문',isSecret:true}));
  await as('bob', async () => assert.equal((await thread(created.postId)).post.readable, true));
  await as('alice', async () => assert.equal((await thread(created.postId)).post.readable, false));
  await rejectsInTransaction(() => as('bob', () => action('post_save', {id:created.postId,category:'질문',title:'변경',body:'본문',isSecret:false})), /공개 범위/);
  await rejectsInTransaction(() => as('admin', () => action('post_pin', {postId:created.postId,value:true})), /비밀글/);
  await rejectsInTransaction(() => as('admin', () => action('post_save', {category:'일상',title:'공지',body:'본문',notice:true,isSecret:true})), /공지/);
  const old = (await thread(first)).post;
  await rejectsInTransaction(() => as('alice', () => action('post_save', {id:first,category:'일상',title:'충돌',body:'본문',expectedUpdatedAt:'2000-01-01T00:00:00Z'})), /수정됐어요/);
  assert.equal((await thread(first)).post.title, old.title);
}));

test('comment empathy is idempotent, removable and validates ownership and comment visibility', () => publishingFixture(async () => {
  const { commentId } = await as('alice', () => action('comment_save', {postId:first,body:'대화'}));
  await as('bob', async () => {
    for (let n=0;n<2;n++) await action('comment_like', {postId:first,id:commentId,value:true});
    const comment = (await thread(first)).comments.find(c => c.id === commentId);
    assert.equal(comment.likes, 1); assert.equal(comment.liked, true);
    await action('comment_like', {postId:first,id:commentId,value:false});
    assert.equal((await thread(first)).comments.find(c => c.id === commentId).likes, 0);
  });
  await rejectsInTransaction(() => as('alice', () => action('comment_like',{postId:first,id:commentId,value:true})), /본인의 댓글/);
  await rejectsInTransaction(() => as('bob', () => action('comment_like',{postId:second,id:commentId,value:true})), /댓글을 찾을/);
  await as('alice', () => action('comment_delete',{postId:first,id:commentId}));
  await rejectsInTransaction(() => as('bob', () => action('comment_like',{postId:first,id:commentId,value:true})), /댓글을 찾을/);
}));

test('new comment notifications link to the exact reply in both activity and account', () => publishingFixture(async () => {
  const root = await as('alice', () => action('comment_save',{postId:first,body:'원 댓글'}));
  const reply = await as('bob', () => action('comment_save',{postId:first,parentId:root.commentId,body:'답글'}));
  await as('alice', async () => {
    assert.equal((await activity('notifications')).items[0].commentId,reply.commentId);
    assert.equal((await account()).notifications[0].commentId,reply.commentId);
  });
}));

test('board pages clamp safely and category counts/search retain deterministic boundaries', () => publishingFixture(async () => {
  await db.query("insert into public.community_posts(author_id,category,title,body,created_at) select $1,'음악','페이지 예시 '||n,'본문','2026-10-01' from generate_series(1,45)n", [ids.alice]);
  await as(null, async () => {
    const a = await feed({query:'페이지 예시',page:1}), b = await feed({query:'페이지 예시',page:2}), z = await feed({query:'페이지 예시',page:2147483647});
    assert.equal(a.total,45); assert.equal(a.categoryCounts.자유글,45); assert.equal(z.page,3); assert.equal(z.posts.length,5);
    assert.equal(new Set([...a.posts,...b.posts,...z.posts].map(p => p.id)).size,45);
  });
}));

test('revoked staff access cannot leak secret comments through account/activity summaries', () => publishingFixture(async () => {
  await db.query('update public.community_posts set is_secret=true,pinned=false where id=$1',[first]);
  await as('admin', () => action('comment_save',{postId:first,body:'운영 답변 비밀'}));
  await db.query("update voku_private.members set role='member' where id=$1",[ids.admin]);
  await as('admin', async () => { assert.equal((await activity('comments')).total,0); assert.equal((await account()).comments.length,0); });
}));


test('UX sample batch creates exactly thirty labelled posts, is repeatable and cleans up only its own posts', () => publishingFixture(async () => {
  const sql = execFileSync(process.execPath,['scripts/seed-community-samples.mjs',ids.alice],{encoding:'utf8'}).replace(/^begin;/,'').replace(/^commit;/m,'');
  await db.exec(sql); await db.exec(sql);
  const counts = (await db.query("select count(*) total,count(*) filter(where is_secret) secret,count(*) filter(where pinned) pinned from public.community_posts where sample_batch='community-ux-2026-10-11'")).rows[0];
  assert.deepEqual(counts,{total:30,secret:2,pinned:1});
  await as(null, async () => {
    const post = (await feed({page:1,query:'[예시]'})).posts.find(p => p.demo);
    assert.equal(post.author,'VOKU 예시');
  });
  const cleanup = execFileSync(process.execPath,['scripts/seed-community-samples.mjs','--cleanup'],{encoding:'utf8'});
  await db.exec(cleanup);
  assert.equal((await db.query("select count(*) n from public.community_posts where sample_batch='community-ux-2026-10-11' and status<>'deleted'")).rows[0].n,0);
  assert.equal((await db.query('select status from public.community_posts where id=$1',[first])).rows[0].status,'published');
}));

async function reading(id, args = {}) {
  return (await db.query('select public.community_reading($1,$2,$3,$4,$5,$6) result', [id,args.category || '',args.sort || 'latest',args.query || '',args.start ?? null,!!args.linked])).rows[0].result;
}

test('five-post reading windows center across board boundaries, clamp edges and advance by five', () => publishingFixture(async () => {
  const rows = (await db.query("insert into public.community_posts(author_id,category,title,body,created_at) select $1,'음악','UX창 '||n,'본문','2026-10-01'::timestamptz+make_interval(mins=>n) from generate_series(1,27)n returning id,created_at", [ids.alice])).rows.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
  const ordered = rows.map(p => p.id);
  await as(null, async () => {
    const middle = await reading(ordered[19],{query:'UX창'});
    assert.equal(middle.start,17); assert.equal(middle.total,27);
    assert.deepEqual(middle.posts.map(p => p.id),ordered.slice(17,22));
    assert.deepEqual((await reading(ordered[19],{query:'UX창',start:22})).posts.map(p => p.id),ordered.slice(22,27));
    assert.equal((await reading(ordered[0],{query:'UX창'})).start,0);
    assert.equal((await reading(ordered[26],{query:'UX창'})).start,22);
    assert.equal((await reading(ordered[19],{query:'UX창',start:2147483647})).start,22);
    const empty = await reading(ordered[0],{query:'일치없는UX창'});
    assert.equal(empty.total,0); assert.deepEqual(empty.posts,[]); assert.equal(empty.start,0);
  });
}));

test('subject categories keep linked posts and merge legacy music; archive filtering is independent', () => publishingFixture(async () => {
  await db.query("update public.community_posts set pinned=false,title='UX말머리 원문',category='음악',record_id='voku_ux_link',is_secret=false where id=$1",[first]);
  await db.query("update public.community_posts set pinned=false,title='UX말머리 질문',category='질문',record_id='voku_ux_question' where id=$1",[second]);
  await as(null, async () => {
    const free = await feed({category:'자유글',query:'UX말머리'});
    assert.deepEqual(free.posts.map(p=>p.id),[first]);
    assert.deepEqual(Object.keys(free.categoryCounts).sort(),['전체','자유글','추억','질문','동문소식','공지'].sort());
    const linked = await feed({query:'UX말머리',linked:true});
    assert.equal(linked.total,2); assert.equal(linked.categoryCounts.질문,1);
    assert.equal((await feed({category:'질문',query:'UX말머리',linked:true})).posts[0].id,second);
    const legacy = (await db.query("select public.community_feed('음악','latest','UX말머리',1) result")).rows[0].result;
    assert.equal(legacy.posts[0].id,first);
    const window = await reading(first,{query:'UX말머리',linked:true});
    assert.equal(window.posts.length,2);
  });
  assert.equal((await db.query('select category from public.community_posts where id=$1',[first])).rows[0].category,'음악');
}));

test('reading windows and linked filters retain secret, hidden and blocked post protection', () => publishingFixture(async () => {
  await db.query("update public.community_posts set pinned=false,is_secret=true,title='UX비밀제목',body='UX비밀본문',record_id='voku_ux_secret',created_at=now() where id=$1",[first]);
  for (const user of [null,'bob']) await as(user,async () => {
    const p = (await reading(first)).posts.find(p=>p.id===first);
    assert.equal(p.title,'비밀글입니다'); assert.equal(p.body,''); assert.equal(p.recordId,null); assert.deepEqual(p.photos,[]);
    assert.equal((await reading(first,{query:'UX비밀본문'})).total,0);
    assert.ok(!(await reading(first,{linked:true})).posts.some(p=>p.id===first));
  });
  for (const user of ['alice','admin']) await as(user,async () => assert.equal((await reading(first,{query:'UX비밀제목',linked:true})).posts[0].body,'UX비밀본문'));
  await db.query('insert into public.community_blocks(user_id,target_id) values($1,$2)',[ids.bob,ids.alice]);
  await as('bob',async () => assert.ok(!(await reading(first)).posts.some(p=>p.id===first)));
  await db.query("update public.community_posts set status='hidden' where id=$1",[first]);
  await as(null,async () => assert.ok(!(await reading(first)).posts.some(p=>p.id===first)));
  assert.equal((await db.query("select has_function_privilege('anon','voku_private.listing_candidates(text,text,boolean)','execute') allowed")).rows[0].allowed,false);
}));

test('reading order follows recommendation ties and date ordering with a stable id tie-break', () => publishingFixture(async () => {
  await db.query("update public.community_posts set title='UX정렬 '||title,pinned=false,created_at='2026-10-01',is_secret=false where id=any($1)",[[first,second]]);
  await db.query('delete from public.community_likes where post_id=any($1)',[[first,second]]);
  await db.query('insert into public.community_likes(user_id,post_id) values($1,$2)',[ids.bob,first]);
  await as(null,async () => {
    assert.equal((await reading(second,{query:'UX정렬',sort:'popular'})).posts[0].id,first);
    const newest = await reading(first,{query:'UX정렬'});
    assert.deepEqual(newest.posts.map(p=>p.id),[first,second].sort().reverse());
  });
}));

test('Google verified email uses nickname onboarding without exposing the Google name or granting metadata roles', async () => {
  const id = crypto.randomUUID(); ids.google = id;
  await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
    values($1,'google@example.invalid',now(),'{"name":"구글실명","full_name":"구글실명","role":"admin","profile_complete":true}','{"provider":"google"}')`, [id]);
  await db.query("insert into auth.identities(user_id,provider,identity_data) values($1,'google','{}')", [id]);
  await as('google', async () => {
    const p = (await account()).profile;
    assert.equal(p.profileComplete, false);
    assert.notEqual(p.nickname, '구글실명');
    assert.equal(p.role, 'member');
    await assert.rejects(action('like',{postId:first,value:true}), /닉네임 설정/);
    await action('profile',{nickname:'구글동문', role:'admin'});
    const ready = (await account()).profile;
    assert.equal(ready.profileComplete,true);
    assert.deepEqual(ready.providers,['google']);
    assert.equal(ready.role,'member');
    await action('like',{postId:first,value:true});
    await assert.rejects(db.query('select public.community_admin()'), /운영 권한/);
  });
});
test('email signup without nickname remains unusable until email verification and nickname setup', async () => {
  const id = crypto.randomUUID(); ids.emailSignup = id;
  await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'signup@example.invalid',null,'{}')", [id]);
  await as('emailSignup', async () => {
    assert.equal((await account()).profile.profileComplete,false);
    await assert.rejects(action('profile',{nickname:'이메일동문'}),/인증/);
  });
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[id]);
  await as('emailSignup', async () => {
    await assert.rejects(action('like',{postId:first,value:true}),/닉네임 설정/);
    await action('profile',{nickname:'이메일동문'});
    const p=(await account()).profile;
    assert.equal(p.profileComplete,true); assert.equal(p.role,'member');
    assert.equal(p.admissionYear,null); assert.equal(p.cohort,null);
    await action('like',{postId:first,value:true});
  });
});


test('public codes backfill without changing the UUID, content or dates', () => {
  assert.equal(backfilled.id, '99999999-0000-4000-8000-000000000002');
  assert.match(backfilled.public_code, /^[A-Za-z0-9_-]{10}$/);
  assert.equal(backfilled.title, '보존 제목');
  assert.equal(backfilled.body, '보존 본문');
  assert.ok(backfilled.created_at.startsWith('2026-01-01'));
  assert.ok(backfilled.updated_at.startsWith('2026-01-02'));
});
const codeThread = code => db.query('select public.community_post_by_code($1) result', [code]).then(r => r.rows[0].result);

test('public codes are unique and immutable; old UUID reads and actions remain valid', () => publishingFixture(async () => {
  const rows = (await db.query("insert into public.community_posts(author_id,category,title,body) select $1,'추억','주소 '||n,'본문' from generate_series(1,300)n returning id,public_code", [ids.alice])).rows;
  assert.equal(new Set(rows.map(p => p.public_code)).size, 300);
  for (const p of rows) assert.match(p.public_code, /^[A-Za-z0-9_-]{10}$/);
  const p = rows[0];
  await db.query("update public.community_posts set public_code='aaaaaaaaaa',title='수정된 제목' where id=$1", [p.id]);
  await as(null, async () => {
    const byCode = await codeThread(p.public_code), byId = await thread(p.id);
    assert.deepEqual(byCode, byId);
    assert.equal(byCode.post.publicCode, p.public_code);
    assert.equal(byCode.post.title, '수정된 제목');
    assert.ok((await feed()).posts.every(post => /^[A-Za-z0-9_-]{10}$/.test(post.publicCode)));
  });
  await as('bob', () => action('bookmark', { postId: p.id, value: true }));
  assert.equal((await db.query('select post_id from public.community_bookmarks where post_id=$1', [p.id])).rows[0].post_id, p.id);
  await rejectsInTransaction(() => as('bob', () => db.query('select voku_private.assign_post_code()')), /permission denied/);
}));

test('short addresses preserve secret, hidden and deleted post rules for every role', () => publishingFixture(async () => {
  await db.query("update public.community_posts set is_secret=true,pinned=false,title='주소 비밀 제목',body='주소 비밀 본문' where id=$1", [first]);
  const code = (await thread(first)).post.publicCode;
  for (const who of [null, 'bob']) await as(who, async () => {
    const value = await codeThread(code);
    assert.equal(value.post.body, '');
    assert.equal(value.post.title, '비밀글입니다');
    assert.deepEqual(value.comments, []);
    assert.deepEqual(value, await thread(first));
  });
  for (const who of ['alice', 'admin']) await as(who, async () => assert.equal((await codeThread(code)).post.body, '주소 비밀 본문'));
  await db.query("update public.community_posts set status='hidden' where id=$1", [first]);
  for (const who of [null, 'alice', 'bob']) await rejectsInTransaction(() => as(who, () => codeThread(code)), /공개되지/);
  await as('admin', async () => assert.equal((await codeThread(code)).post.id, first));
  await db.query("update public.community_posts set status='deleted' where id=$1", [first]);
  await rejectsInTransaction(() => as('admin', () => codeThread(code)), /공개되지/);
  for (const bad of [null, '', '<script>', '../secret', 'xxxxxxxxxx']) await rejectsInTransaction(() => as(null, () => codeThread(bad)), /찾을 수/);
}));

const archiveBookmark = (records, saved = true) => db.query('select public.community_archive_bookmark($1,$2)', [records, saved]);
const boardAdmin = (tab = 'posts', filter = 'all', query = '', page = 1) => db.query('select public.community_board_admin($1,$2,$3,$4) result', [tab, filter, query, page]).then(r => r.rows[0].result);
const restoreComment = (id, reason = '내용 확인 후 다시 공개') => db.query('select public.community_restore_comment($1,$2) result', [id, reason]).then(r => r.rows[0].result);

test('archive bookmarks belong to each account and survive repeat imports without duplicates', () => publishingFixture(async () => {
  const record = 'voku_1994_music_001', other = 'voku_1995_music_002';
  await as('alice', async () => {
    assert.deepEqual((await account()).archiveSaved, []);
    await archiveBookmark([record, other, record]);
    await archiveBookmark([record, other]);
    assert.deepEqual(new Set((await account()).archiveSaved), new Set([record, other]));
  });
  await as('bob', async () => {
    assert.deepEqual((await account()).archiveSaved, []);
    await archiveBookmark([record]);
  });
  await as('alice', async () => {
    await archiveBookmark([record], false);
    assert.deepEqual((await account()).archiveSaved, [other]);
  });
  // New requests with the same identity read stored rows, not a browser's list.
  await as('bob', async () => assert.deepEqual((await account()).archiveSaved, [record]));
  await rejectsInTransaction(() => as('bob', () => db.query('select * from voku_private.archive_bookmarks')), /permission denied/);
  await rejectsInTransaction(() => as('bob', () => db.query('delete from voku_private.archive_bookmarks')), /permission denied/);
}));

test('archive saving rejects guests, unconfirmed or restricted accounts and malformed batches atomically', () => publishingFixture(async () => {
  await rejectsInTransaction(() => as(null, () => archiveBookmark(['voku_test'])), /permission denied/);
  await rejectsInTransaction(() => as('unconfirmed', () => archiveBookmark(['voku_test'])), /이메일/);
  for (const value of [null, [], ['voku_ok', '../bad'], ['voku_ok', null], ['voku_' + 'a'.repeat(196)], Array(6001).fill('voku_ok')]) {
    await rejectsInTransaction(() => as('alice', () => archiveBookmark(value)), /큐시트/);
  }
  await rejectsInTransaction(() => as('alice', () => archiveBookmark(['voku_ok'], null)), /큐시트/);
  await as('alice', async () => assert.deepEqual((await account()).archiveSaved, []));
  await db.query('update voku_private.members set profile_complete=false where id=$1', [ids.alice]);
  await rejectsInTransaction(() => as('alice', () => archiveBookmark(['voku_ok'])), /설정|미완료/);
  await db.query('update voku_private.members set suspended_until=now()+interval \'1 day\' where id=$1', [ids.bob]);
  await rejectsInTransaction(() => as('bob', () => archiveBookmark(['voku_ok'])), /제한/);
}));

test('board administration pages reach old posts, notices, hidden comments, reports and audit beyond 100 rows', () => withActivityFixture(async posts => {
  await db.query("update public.community_posts set pinned=true,created_at='2000-01-01' where id=$1", [posts[0].id]);
  await db.query("update public.community_posts set status='hidden',created_at='2000-01-01' where id=$1", [posts[1].id]);
  await db.query("update public.community_comments set status='hidden' where author_id=$1", [ids.activity]);
  await db.query("insert into public.community_reports(reporter_id,post_id,reason,created_at) select $1,id,'기타','2026-10-01' from public.community_posts where author_id=$2", [ids.bob, ids.activity]);
  await db.query("insert into voku_private.audit(actor_id,action,target,reason,created_at) select $1,'post_pin',id::text,'확인 [true]','2026-10-01' from public.community_posts where author_id=$2", [ids.admin, ids.activity]);
  await as('admin', async () => {
    const found = [];
    for (let page=1; page<=6; page++) {
      const result = await boardAdmin('posts', 'all', '활동 ', page);
      assert.equal(result.total, 105);
      assert.equal(result.page, page);
      assert.equal(result.pageSize, 20);
      found.push(...result.posts.map(p => p.id));
    }
    assert.equal(new Set(found).size, 105);
    assert.ok((await boardAdmin('posts', 'notice', '활동 ')).posts.some(p => p.id === posts[0].id));
    assert.ok((await boardAdmin('posts', 'hidden', '활동 ')).posts.some(p => p.id === posts[1].id));
    assert.equal((await boardAdmin('posts', 'all', '활동 ', 999999)).page, 6);
    for (const tab of ['comments','reports','audit']) {
      const firstPage = await boardAdmin(tab);
      assert.ok(firstPage.total >= 105);
      const idsFound = [];
      for (let page=1; page<=Math.ceil(firstPage.total/20); page++) {
        const result = await boardAdmin(tab, 'all', '', page);
        assert.deepEqual(await boardAdmin(tab, 'all', '', page), result);
        idsFound.push(...result[tab].map(item => item.id));
      }
      assert.equal(new Set(idsFound).size, firstPage.total);
      assert.equal(idsFound.length, firstPage.total);
    }
  });
  for (const who of [null, 'alice', 'bob']) {
    for (const tab of ['posts','comments','reports','audit']) await rejectsInTransaction(() => as(who, () => boardAdmin(tab)), /permission denied|권한/);
  }
}));

test('only board staff can restore hidden comments; authors deleted comments stay deleted and audit retains context', () => publishingFixture(async () => {
  await db.query("update voku_private.members set role='moderator' where id=$1", [ids.admin]);
  const comment = (await db.query("insert into public.community_comments(post_id,author_id,body,status) values($1,$2,'검토할 댓글 본문','hidden') returning id", [first, ids.alice])).rows[0].id;
  await as('bob', async () => assert.ok(!(await thread(first)).comments.some(c => c.body === '검토할 댓글 본문')));
  for (const who of [null,'alice','bob']) await rejectsInTransaction(() => as(who, () => restoreComment(comment)), /permission denied|권한/);
  await rejectsInTransaction(() => as('admin', () => restoreComment(comment, ' ')), /사유/);
  await as('admin', async () => {
    assert.equal((await boardAdmin('comments')).comments.find(c => c.id === comment).body, '검토할 댓글 본문');
    assert.deepEqual(await restoreComment(comment), {postId:first,commentId:comment});
    const event = (await boardAdmin('audit')).audit.find(a => a.action === 'comment_restore' && a.target === comment);
    assert.equal(event.postId, first); assert.equal(event.commentId, comment);
    assert.equal(event.excerpt, '검토할 댓글 본문'); assert.ok(event.postTitle);
    assert.ok(!(await boardAdmin('comments')).comments.some(c => c.id === comment));
  });
  await as('bob', async () => assert.equal((await thread(first)).comments.find(c => c.id === comment).body, '검토할 댓글 본문'));
  await rejectsInTransaction(() => as('admin', () => restoreComment(comment)), /숨긴 댓글만/);
  await db.query("update public.community_comments set status='deleted' where id=$1", [comment]);
  await rejectsInTransaction(() => as('admin', () => restoreComment(comment)), /숨긴 댓글만/);
  await as('admin', async () => assert.equal((await boardAdmin('audit')).audit.find(a => a.target === comment).excerpt, '작성자가 삭제한 댓글입니다.'));
  await db.query("update public.community_comments set status='hidden' where id=$1", [comment]);
  await db.query("update public.community_posts set status='deleted' where id=$1", [first]);
  await rejectsInTransaction(() => as('admin', () => restoreComment(comment)), /숨긴 댓글만/);
}));
