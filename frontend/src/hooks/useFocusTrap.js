import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Returns a ref to attach to the modal container.
// Traps Tab/Shift-Tab inside, focuses first element on open, closes on Escape.
export default function useFocusTrap(onClose) {
  const ref = useRef(null);
  const previousFocus = useRef(null);
  // Keep latest onClose in a ref so the effect never needs to re-run when it changes
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const el = ref.current;
    if (!el) return;

    // Focus first focusable element when modal opens
    const focusable = () => Array.from(el.querySelectorAll(FOCUSABLE));
    focusable()[0]?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const els = focusable();
      if (els.length === 0) { e.preventDefault(); return; }
      const first = els[0];
      const last  = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    el.addEventListener('keydown', handleKey);
    return () => {
      el.removeEventListener('keydown', handleKey);
      previousFocus.current?.focus(); // restore focus when modal closes
    };
  }, []); // empty deps — runs only on mount, never re-runs on re-render

  return ref;
}
