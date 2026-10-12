import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Lines from '../components/Lines.jsx';
import { Alert, Empty, Field, PageHeader, Status, dt, money, useLoad } from '../components/ui.jsx';

const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

export default function PurchaseOrders() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState({ error: '', ok: '' });
  const list = useLoad(() => api('/purchase-orders', { params: { status } }), [status]);
  const detail = useLoad(() => (openId ? api(`/purchase-orders/${openId}`) : Promise.resolve(null)), [openId]);
  const suppliers = useLoad(() => api('/suppliers'));
  const products = useLoad(() => api('/products'));
  const [form, setForm] = useState({ supplier_id: '', expected_date: '', note: '' });
  const [lines, setLines] = useState([{ product_id: '', quantity: '', unit_cost: '' }]);

  async function create(e) {
    e.preventDefault(); setMsg({ error: '', ok: '' });
    try {
      const items = lines.map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity), unit_cost: l.unit_cost === '' ? undefined : Number(l.unit_cost) }));
      const r = await api('/purchase-orders', { method: 'POST', body: { ...form, supplier_id: Number(form.supplier_id), items } });
      setMsg({ error: '', ok: `Purchase order #${r.poId} created as a draft. Submit it when it is ready for approval.` });
      setCreating(false); setLines([{ product_id: '', quantity: '', unit_cost: '' }]); setForm({ supplier_id: '', expected_date: '', note: '' }); list.reload();
    } catch (err) { setMsg({ error: err.message, ok: '' }); }
  }
  async function change(id, next, label) {
    setMsg({ error: '', ok: '' });
    try {
      await api(`/purchase-orders/${id}/status`, { method: 'PATCH', body: { status: next } });
      setMsg({ error: '', ok: `Order #${id} ${label}.` }); list.reload(); detail.reload();
    } catch (err) { setMsg({ error: err.message, ok: '' }); }
  }

  const d = detail.data;
  const actions = d && [
    d.status === 'DRAFT' && can('Purchasing Staff', 'Warehouse Manager') && ['SUBMITTED', 'Submit for approval', 'submitted'],
    d.status === 'SUBMITTED' && can('Warehouse Manager') && ['APPROVED', 'Approve order', 'approved'],
    ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(d.status) && can('Purchasing Staff', 'Warehouse Manager') && ['CANCELLED', 'Cancel order', 'cancelled'],
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Purchase orders" subtitle="Orders to suppliers, from draft to fully received.">
        {can('Purchasing Staff') && <button className="primary" onClick={() => setCreating(true)}>New purchase order</button>}
      </PageHeader>
      <Alert>{msg.error}</Alert><Alert kind="ok">{msg.ok}</Alert>

      {creating && (
        <form className="panel" onSubmit={create}>
          <h2>New purchase order</h2>
          <div className="grid">
            <Field label="Supplier">
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} required>
                <option value="">Choose a supplier</option>
                {(suppliers.data || []).filter((s) => s.is_active).map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Expected delivery"><input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></Field>
            <Field label="Note"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          </div>
          <Lines products={products.data || []} lines={lines} setLines={setLines} withCost />
          <div className="actions"><button className="primary">Create draft order</button><button type="button" onClick={() => setCreating(false)}>Cancel</button></div>
        </form>
      )}

      <div className="filters">
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
          </select>
        </Field>
      </div>
      <Alert>{list.error}</Alert>
      {list.data && list.data.length === 0 && <Empty>No purchase orders yet.</Empty>}
      {list.data && list.data.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th>Order</th><th>Supplier</th><th>Status</th><th className="r">Received</th><th className="r">Value</th><th>Created</th><th></th></tr></thead>
          <tbody>{list.data.map((p) => (
            <tr key={p.po_id} className={openId === p.po_id ? 'selected' : ''}>
              <td>#{p.po_id}</td><td>{p.supplier_name}</td><td><Status value={p.status} /></td>
              <td className="r">{p.total_received} / {p.total_ordered}</td><td className="r">{money(p.total_value)}</td><td>{dt(p.created_at)}</td>
              <td className="r"><button className="link" onClick={() => setOpenId(openId === p.po_id ? null : p.po_id)}>{openId === p.po_id ? 'Hide' : 'View'}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      {d && (
        <section className="panel">
          <h2>Order #{d.po_id} <Status value={d.status} /></h2>
          <p className="muted">{d.supplier_name}{d.expected_date ? ` · expected ${String(d.expected_date).slice(0, 10)}` : ''}{d.note ? ` · ${d.note}` : ''}</p>
          <table>
            <thead><tr><th>SKU</th><th>Product</th><th className="r">Ordered</th><th className="r">Received</th><th className="r">Unit cost</th></tr></thead>
            <tbody>{d.lines.map((l) => (
              <tr key={l.line_id}><td>{l.sku}</td><td>{l.name}</td><td className="r">{l.ordered_qty} {l.unit}</td><td className="r">{l.received_qty}</td><td className="r">{money(l.unit_cost)}</td></tr>
            ))}</tbody>
          </table>
          {actions.length > 0 && (
            <div className="actions">{actions.map(([next, text, label]) => (
              <button key={next} className={next === 'CANCELLED' ? '' : 'primary'} onClick={() => change(d.po_id, next, label)}>{text}</button>
            ))}</div>
          )}
          {['APPROVED', 'PARTIALLY_RECEIVED'].includes(d.status) && <p className="muted">Goods for this order are received on the Receive stock page.</p>}
        </section>
      )}
    </>
  );
}
