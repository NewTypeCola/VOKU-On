import { Button, Spinner } from "@heroui/react";
import type { ReactNode } from "react";
import "./community/loading.css";

export function LoadingState({ children = "불러오는 중" }: { children?: ReactNode }) {
  return <div className="community-loading" role="status">
    <Spinner size="sm" aria-hidden="true" /><span>{children}</span>
  </div>;
}

export function ErrorState({ message, retry, children }: {
  message: string; retry: () => void; children?: ReactNode;
}) {
  return <div className="community-state">
    <div role="alert"><h3>내용을 불러오지 못했어요</h3><p>{message}</p></div>
    <div className="feedback-actions"><Button variant="outline" onPress={retry}>다시 불러오기</Button>{children}</div>
  </div>;
}

export function EmptyState({ title, children, action, icon }: {
  title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode;
}) {
  return <div className="community-empty">
    {icon && <span aria-hidden="true">{icon}</span>}
    <h3>{title}</h3>
    {children && <div className="empty-description">{children}</div>}
    {action && <div className="feedback-actions">{action}</div>}
  </div>;
}
