import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Field, PageHeader, useLoad } from '../components/ui.jsx';

export default function Stocktake() {
  const products = useLoad(() => api('/products'));
  const warehouses = useLoad(() => api('/warehouses'));
  const [f, setF] = useState({ warehouse_id: '', product_id: '', counted_quantity: '', reason: '' });
  const [state, setState] = useState({ busy: false, error: '', ok: '' });
  const stock = useLoad(() => (f.warehouse_id ? api('/stock', { params: { warehouse_id: f.warehouse_id } }) : Promise.resolve([])), [f.warehouse_id, state.ok]);
  const current = (stock.data || []).find((s) => String(s.product_id) === String(f.product_id));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!window.confirm('Adjust the system quantity to the counted quantity? This is recorded in the movement history and cannot be edited.')) return;
    setState({ busy: true, error: '', ok: '' });
    try {
      const r = await api('/stock-adjustments', { method: 'POST', body: { warehouse_id: Number(f.warehouse_id), product_id: Number(f.product_id), counted_quantity: Number(f.counted_quantity), reason: f.reason } });
      setState({ busy: false, error: '', ok: `Adjusted from ${r.previousQuantity} to ${r.newQuantity} (${r.delta > 0 ? '+' : ''}${r.delta}).` });
      setF({ ...f, counted_quantity: '', reason: '' });
    } catch (err) { setState({ busy: false, error: err.message, ok: '' }); }
  }

  return (
    <>
      <PageHeader title="Stocktake" subtitle="Compare a physical count with the system and record the difference. A reason is required." />
      <Alert>{state.error}</Alert><Alert kind="ok">{state.ok}</Alert>
      <form className="panel" onSubmit={submit}>
        <div className="grid">
          <Field label="Warehouse">
            <select value={f.warehouse_id} onChange={set('warehouse_id')} required>
              <option value="">Choose a warehouse</option>
              {(warehouses.data || []).filter((w) => w.is_active).map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="Product" hint={f.warehouse_id && f.product_id ? `System quantity: ${current ? current.quantity : 0}` : ''}>
            <select value={f.product_id} onChange={set('product_id')} required>
              <option value="">Choose a product</option>
              {(products.data || []).map((p) => <option key={p.product_id} value={p.product_id}>{p.sku} · {p.name}</option>)}
            </select>
          </Field>
          <Field label="Counted quantity"><input type="number" min="0" step="1" value={f.counted_quantity} onChange={set('counted_quantity')} required /></Field>
          <Field label="Reason"><input value={f.reason} onChange={set('reason')} placeholder="Damaged goods, miscount, found stock…" required /></Field>
        </div>
        <div className="actions"><button className="primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Record adjustment'}</button></div>
      </form>
    </>
  );
}
