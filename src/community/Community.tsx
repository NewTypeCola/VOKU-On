import { lazy, type ComponentProps } from "react";
import { LazyScreen } from "../LazyScreen";
import "./loading.css";

const Board = lazy(() => import('./Board').then(m => ({ default: m.CommunityBoard })));
export function CommunityBoard(props: ComponentProps<typeof Board>) {
  return <LazyScreen><Board {...props} /></LazyScreen>;
}

const Auth = lazy(() => import('./Auth').then(m => ({ default: m.AuthScreen })));
export function AuthScreen(props: ComponentProps<typeof Auth>) {
  return <LazyScreen><Auth {...props} /></LazyScreen>;
}

const Post = lazy(() => import('./Post').then(m => ({ default: m.CommunityPostScreen })));
export function CommunityPostScreen(props: ComponentProps<typeof Post>) {
  return <LazyScreen><Post {...props} /></LazyScreen>;
}

const Composer = lazy(() => import('./Composer').then(m => ({ default: m.CommunityComposer })));
export function CommunityComposer(props: ComponentProps<typeof Composer>) {
  return <LazyScreen><Composer {...props} /></LazyScreen>;
}

const Account = lazy(() => import('./Account').then(m => ({ default: m.CommunityAccount })));
export function CommunityAccount(props: ComponentProps<typeof Account>) {
  return <LazyScreen><Account {...props} /></LazyScreen>;
}

const Admin = lazy(() => import('./Admin').then(m => ({ default: m.CommunityAdmin })));
export function CommunityAdmin(props: ComponentProps<typeof Admin>) {
  return <LazyScreen><Admin {...props} /></LazyScreen>;
}
