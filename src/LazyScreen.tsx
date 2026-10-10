import { Button,Spinner } from '@heroui/react';
import { Component,Suspense,type ReactNode } from 'react';

class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="community-state" role="alert">
      <p>화면을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.</p>
      <Button variant="outline" onPress={() => location.reload()}>다시 불러오기</Button>
    </div>;
    return this.props.children;
  }
}

export function LazyScreen({ children }: { children: ReactNode }) {
  return <ScreenBoundary><Suspense fallback={<div className="community-loading" role="status"><Spinner size="sm" />불러오는 중</div>}>
    {children}
  </Suspense></ScreenBoundary>;
}
