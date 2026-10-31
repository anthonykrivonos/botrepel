import { useEffect, useRef } from "react";

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

/** A native modal dialog: focus trapping, Escape, and the backdrop come from the platform. */
export function Dialog({ open, title, onClose, children }: DialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) {
      dialog?.showModal();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[min(28rem,calc(100%-2rem))] animate-enter rounded-dialog border border-line-strong bg-surface p-6 text-fg-body backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <h2 className="mb-4 text-lg">{title}</h2>
      {children}
    </dialog>
  );
}
