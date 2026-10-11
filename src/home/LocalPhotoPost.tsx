import { Button } from "@heroui/react";
import { useState } from "react";
import { Dialog, Header, type Go } from "../community/shared";
import { localPhotoExample } from "./examples";
import "./home.css";

export function LocalPhotoPost({ id, go, params }: { id: string; go: Go; params: URLSearchParams }) {
  const post = localPhotoExample(id);
  const [open, setOpen] = useState(false);
  const list = params.get("list") || "";
  const returnTo = /^\/home(?:\?|$)/.test(list) ? list : "/home";
  const back = () => go(returnTo, false, false, true);
  return <main className="home-example-post">
    <Header title="추억 이야기" go={go} onBack={back} backLabel="홈으로 돌아가기" />
    {post ? <article>
      <p className="home-example-notice">로컬 확인용 예시 · 실제 게시글이 아닙니다</p>
      <span className="home-example-category">추억</span>
      <h1>{post.title}</h1>
      <p className="home-example-byline">로컬 예시 · 2026.10.11</p>
      <div className="home-example-body">{post.body.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
      <button type="button" className="home-example-image" onClick={() => setOpen(true)} aria-label="예시 사진 크게 보기"><img src={post.exampleImage} alt={post.imageAlt} width="1448" height="1086" /></button>
      <p className="home-example-caption">홈의 사진 목록을 확인하기 위해 만든 글과 AI 생성 이미지입니다. 실제 VOKU 소장 사진이나 동문의 경험이 아니며, 운영 사이트에는 등록되지 않습니다.</p>
      <Button variant="outline" onPress={back}>홈으로</Button>
      <Dialog title="예시 사진" open={open} close={() => setOpen(false)}><img className="home-example-enlarged" src={post.exampleImage} alt={post.imageAlt} /></Dialog>
    </article> : <div className="home-corner-state"><p>로컬 예시 글을 찾을 수 없어요.</p><Button variant="outline" onPress={back}>홈으로</Button></div>}
  </main>;
}
