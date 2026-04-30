import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Max width class, default: max-w-lg */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Close on overlay click, default: true */
  closeOnOverlay?: boolean;
  /** Optional explicit aria-label for the dialog (used when no <ModalHeader> is rendered) */
  ariaLabel?: string;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-3xl',
};

export function Modal({ isOpen, onClose, children, size = 'lg', closeOnOverlay = true, ariaLabel }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Initial focus: first focusable element inside the dialog, fallback to the dialog container.
  useEffect(() => {
    if (!isOpen) return;
    const container = contentRef.current;
    if (!container) return;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = container.querySelector<HTMLElement>(focusableSelector);
    if (focusable) {
      focusable.focus();
    } else {
      container.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
      onClick={(e) => {
        if (closeOnOverlay && contentRef.current && !contentRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? 'Modal'}
        tabIndex={-1}
        className={`bg-white rounded-xl shadow-xl w-full ${sizeMap[size]} max-h-[90vh] overflow-y-auto focus:outline-none`}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  onClose?: () => void;
}

export function ModalHeader({ children, onClose }: ModalHeaderProps) {
  const headingId = useId();
  const headerRef = useRef<HTMLHeadingElement>(null);

  // Best-effort: also wire aria-labelledby on the parent <dialog> at mount so screen
  // readers announce the heading text instead of the generic "Modal" fallback.
  useEffect(() => {
    const dialog = headerRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    if (dialog && headerRef.current) {
      dialog.setAttribute('aria-labelledby', headerRef.current.id);
      dialog.removeAttribute('aria-label');
    }
  }, []);

  return (
    <div className="flex items-center justify-between p-5 border-b border-slate-200">
      <h3 ref={headerRef} id={headingId} className="text-lg font-semibold text-slate-800">{children}</h3>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="p-5">{children}</div>;
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-3 p-5 border-t border-slate-200">{children}</div>;
}
