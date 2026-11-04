// An Excel-style message box over the sheet.

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function ExcelDialog({ message, detail, children }: { message: string; detail?: string; children: ReactNode }) {
  const titleId = useId();
  const messageId = useId();
  const ref = useRef<HTMLDivElement>(null);

  // Move focus into the dialog so Enter and Tab reach its buttons.
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, []);

  return (
    <div className="xl-dialog-backdrop">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="xl-dialog"
      >
        <div className="xl-dialog-title" id={titleId}>
          Microsoft Excel
        </div>
        <div className="xl-dialog-body">
          <span className="xl-dialog-icon" aria-hidden="true">
            !
          </span>
          <div id={messageId}>
            <p>{message}</p>
            {detail && <p className="xl-dialog-detail">{detail}</p>}
          </div>
        </div>
        <div className="xl-dialog-buttons">{children}</div>
      </div>
    </div>
  );
}
