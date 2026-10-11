import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
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
    await db.exec("reset role");
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
    await db.query("select public.community_feed($1,$2,$3,$4) result", [
      args.category || "",
      args.sort || "latest",
      args.query || "",
      args.page || 1,
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
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb,raw_app_meta_data jsonb default '{"provider":"email"}');
    create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,identity_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
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
