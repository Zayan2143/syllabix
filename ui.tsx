import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { ChapterStatus } from '../lib/types';
import { STATUSES, statusLabel } from '../lib/constants';

// ------------------------------------------------------------ Modal
export function Modal({ open, onClose, title, children, footer, width = 520, dismissable = true }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; dismissable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && dismissable) onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button.btn-primary')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); prev?.focus?.(); };
  }, [open, onClose, dismissable]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissable) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ maxWidth: width }} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          {dismissable && <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Confirm
interface ConfirmOpts { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; requireText?: string }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => { setTyped(''); setState({ ...o, resolve }); }), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  const blocked = !!state?.requireText && typed.trim() !== state.requireText;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ''} width={440}
        footer={<>
          <button className="btn" onClick={() => close(false)}>Cancel</button>
          <button className={state?.danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={blocked} onClick={() => close(true)}>
            {state?.confirmLabel ?? 'Confirm'}
          </button>
        </>}>
        <div className="confirm-msg">{state?.message}</div>
        {state?.requireText && (
          <label className="field" style={{ marginTop: 14 }}>
            <span className="field-label">Type <b>{state.requireText}</b> to confirm</span>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// ------------------------------------------------------------ Toasts
type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; text: string }
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'success' ? <CheckCircle2 size={17} /> : t.kind === 'error' ? <AlertTriangle size={17} /> : <Info size={17} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------ Form bits
export function Field({ label, hint, error, children, optional }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; optional?: boolean }) {
  return (
    <label className="field">
      <span className="field-label">{label}{optional && <span className="muted"> (optional)</span>}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Rating({ value, onChange, labels, name }: { value: number | null; onChange: (v: number | null) => void; labels: string[]; name: string }) {
  return (
    <div className="rating" role="radiogroup" aria-label={name}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} title={labels[n]}
          className={'rating-dot' + (value != null && n <= value ? ' on' : '')}
          onClick={() => onChange(value === n ? null : n)}>{n}</button>
      ))}
      <span className="rating-label">{value ? labels[value] : 'Not rated'}</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: ChapterStatus }) {
  return <span className={`badge status-${status}`}>{status === 'mastered' && <CheckCircle2 size={12} />}{statusLabel(status)}</span>;
}

export function StatusSelect({ value, onChange, disabled }: { value: ChapterStatus; onChange: (s: ChapterStatus) => void; disabled?: boolean }) {
  return (
    <select className={`status-select status-${value}`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as ChapterStatus)} aria-label="Chapter status">
      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}

// ------------------------------------------------------------ Progress
export function Progress({ value, color, size = 'md', label }: { value: number; color?: string; size?: 'sm' | 'md'; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`progress progress-${size}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, color = 'var(--accent)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------ Misc
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <div className="spinner-wrap"><div className="spinner" aria-hidden />{label && <span>{label}</span>}</div>;
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="dot" style={{ background: color, width: size, height: size }} />;
}

export function Card({ title, action, children, className = '', pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && <div className="card-head"><h3>{title}</h3>{action}</div>}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
