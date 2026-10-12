import { Button } from '@heroui/react';
import { Component,Suspense,type ReactNode } from 'react';
import { ErrorState, LoadingState } from './ScreenFeedback';

class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <ErrorState message="연결을 확인하고 다시 시도해 주세요." retry={() => location.reload()}>
      <Button variant="ghost" onPress={() => { location.hash = '/home'; location.reload(); }}>홈으로</Button>
    </ErrorState>;
    return this.props.children;
  }
}

export function LazyScreen({ children }: { children: ReactNode }) {
  return <ScreenBoundary><Suspense fallback={<LoadingState />}>
    {children}
  </Suspense></ScreenBoundary>;
}
