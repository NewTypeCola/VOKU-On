import { Modal } from "@heroui/react";
import type { ReactNode } from "react";

/** One scrollable, keyboard-aware dialog for archive and community screens. */
export function Dialog({ title, open, close, children, className = "", animated = true }: {
  title: string;
  open: boolean;
  close: () => void;
  children: ReactNode;
  className?: string;
  animated?: boolean;
}) {
  return <Modal.Backdrop className={animated ? undefined : "voku-dialog-static"} isOpen={open} onOpenChange={value => { if (!value) close(); }}>
    <Modal.Container placement="center" size="sm" className="voku-dialog-container">
      <Modal.Dialog className={`voku-dialog ${className}`}>
        <Modal.CloseTrigger aria-label="닫기" />
        <Modal.Header><Modal.Heading>{title}</Modal.Heading></Modal.Header>
        <Modal.Body>{children}</Modal.Body>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>;
}
