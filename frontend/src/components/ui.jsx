import { useEffect, useState } from 'react';

export function Alert({ kind = 'error', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && <button className="link" onClick={onClose} aria-label="Dismiss">Dismiss</button>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function Status({ value }) {
  const label = String(value).replace(/_/g, ' ').toLowerCase();
  return <span className={`badge b-${String(value).toLowerCase()}`}>{label}</span>;
}

export function Empty({ children }) { return <div className="empty">{children}</div>; }

export const money = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0);
export const dt = (s) => (s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** Load data on mount / when deps change. Returns { data, error, loading, reload } */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fn().then((data) => alive && setState({ data, error: '', loading: false }))
        .catch((e) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
