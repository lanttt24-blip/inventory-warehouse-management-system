import { useState } from 'react';
import { api } from '../api.js';
import Lines from '../components/Lines.jsx';
import { Alert, Field, PageHeader, useLoad } from '../components/ui.jsx';

const newLines = () => [{ product_id: '', quantity: '' }];
const clean = (lines) => lines.map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }));

function useRefs() {
  const products = useLoad(() => api('/products'));
  const warehouses = useLoad(() => api('/warehouses'));
  return { products: products.data || [], warehouses: (warehouses.data || []).filter((w) => w.is_active), error: products.error || warehouses.error };
}

function WarehouseSelect({ label, value, onChange, warehouses, exclude }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Choose a warehouse</option>
        {warehouses.filter((w) => String(w.warehouse_id) !== String(exclude)).map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
      </select>
    </Field>
  );
}

function useSubmit(onDone) {
  const [state, setState] = useState({ busy: false, error: '', ok: '' });
  const run = async (fn, okMessage) => {
    setState({ busy: true, error: '', ok: '' });
    try { const r = await fn(); setState({ busy: false, error: '', ok: okMessage(r) }); onDone && onDone(); return true; }
    catch (e) { setState({ busy: false, error: e.message, ok: '' }); return false; }
  };
  return [state, run];
}

/* ---------------- Receive ---------------- */
export function Receive() {
  const refs = useRefs();
  const pos = useLoad(() => api('/purchase-orders'));
  const [warehouse, setWarehouse] = useState('');
  const [poId, setPoId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState(newLines());
  const [state, run] = useSubmit();
  const receivable = (pos.data || []).filter((p) => ['APPROVED', 'PARTIALLY_RECEIVED'].includes(p.status));

  async function choosePo(id) {
    setPoId(id);
    if (!id) { setLines(newLines()); return; }
    try {
      const po = await api(`/purchase-orders/${id}`);
      const open = po.lines.filter((l) => l.ordered_qty > l.received_qty)
        .map((l) => ({ product_id: l.product_id, quantity: l.ordered_qty - l.received_qty }));
      setLines(open.length ? open : newLines());
    } catch { /* error shown on submit */ }
  }
  function submit(e) {
    e.preventDefault();
    run(() => api('/receipts', { method: 'POST', body: { warehouse_id: Number(warehouse), po_id: poId ? Number(poId) : undefined, note, items: clean(lines) } }),
      (r) => `Stock received. Reference ${r.reference}${r.purchaseOrderStatus ? `; order is now ${r.purchaseOrderStatus.replace(/_/g, ' ').toLowerCase()}` : ''}.`)
      .then((ok) => { if (ok) { setLines(newLines()); setNote(''); setPoId(''); pos.reload(); } });
  }
  return (
    <>
      <PageHeader title="Receive stock" subtitle="Add delivered goods to a warehouse. Link a purchase order to track what is still outstanding." />
      <Alert>{refs.error}</Alert><Alert>{state.error}</Alert><Alert kind="ok">{state.ok}</Alert>
      <form className="panel" onSubmit={submit}>
        <div className="grid">
          <WarehouseSelect label="Receive into" value={warehouse} onChange={setWarehouse} warehouses={refs.warehouses} />
          <Field label="Purchase order (optional)">
            <select value={poId} onChange={(e) => choosePo(e.target.value)}>
              <option value="">Direct receipt, no order</option>
              {receivable.map((p) => <option key={p.po_id} value={p.po_id}>#{p.po_id} · {p.supplier_name} ({p.total_received}/{p.total_ordered} received)</option>)}
            </select>
          </Field>
          <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery note number, driver…" /></Field>
        </div>
        <Lines products={refs.products} lines={lines} setLines={setLines} />
        <div className="actions"><button className="primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Receive stock'}</button></div>
      </form>
    </>
  );
}

/* ---------------- Issue ---------------- */
export function Issue() {
  const refs = useRefs();
  const [warehouse, setWarehouse] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState(newLines());
  const [state, run] = useSubmit();
  function submit(e) {
    e.preventDefault();
    run(() => api('/issues', { method: 'POST', body: { warehouse_id: Number(warehouse), reason, items: clean(lines) } }), () => 'Stock issued.')
      .then((ok) => { if (ok) { setLines(newLines()); setReason(''); } });
  }
  return (
    <>
      <PageHeader title="Issue stock" subtitle="Record goods leaving a warehouse. Issues that exceed available stock are rejected." />
      <Alert>{refs.error}</Alert><Alert>{state.error}</Alert><Alert kind="ok">{state.ok}</Alert>
      <form className="panel" onSubmit={submit}>
        <div className="grid">
          <WarehouseSelect label="Issue from" value={warehouse} onChange={setWarehouse} warehouses={refs.warehouses} />
          <Field label="Reason or reference"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sales order, internal use…" required /></Field>
        </div>
        <Lines products={refs.products} lines={lines} setLines={setLines} />
        <div className="actions"><button className="primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Issue stock'}</button></div>
      </form>
    </>
  );
}

/* ---------------- Transfer ---------------- */
export function Transfer() {
  const refs = useRefs();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState(newLines());
  const [state, run] = useSubmit();
  function submit(e) {
    e.preventDefault();
    run(() => api('/transfers', { method: 'POST', body: { from_warehouse_id: Number(from), to_warehouse_id: Number(to), note, items: clean(lines) } }), () => 'Stock transferred.')
      .then((ok) => { if (ok) { setLines(newLines()); setNote(''); } });
  }
  return (
    <>
      <PageHeader title="Transfer stock" subtitle="Move goods between two warehouses in one step." />
      <Alert>{refs.error}</Alert><Alert>{state.error}</Alert><Alert kind="ok">{state.ok}</Alert>
      <form className="panel" onSubmit={submit}>
        <div className="grid">
          <WarehouseSelect label="From" value={from} onChange={setFrom} warehouses={refs.warehouses} exclude={to} />
          <WarehouseSelect label="To" value={to} onChange={setTo} warehouses={refs.warehouses} exclude={from} />
          <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <Lines products={refs.products} lines={lines} setLines={setLines} />
        <div className="actions"><button className="primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Transfer stock'}</button></div>
      </form>
    </>
  );
}
