import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Empty, Field, PageHeader, dt, useLoad } from '../components/ui.jsx';

export default function Reports() {
  const [f, setF] = useState({ from: '', to: '', warehouse_id: '', product_id: '', type: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const wh = useLoad(() => api('/warehouses'));
  const pr = useLoad(() => api('/products', { params: { include_inactive: 'true' } }));
  const low = useLoad(() => api('/reports/low-stock'));
  const mv = useLoad(() => api('/reports/movements', { params: f }), [f.from, f.to, f.warehouse_id, f.product_id, f.type]);

  function exportCsv() {
    const rows = [['Date', 'Type', 'Reference', 'Product', 'SKU', 'Warehouse', 'Change', 'By', 'Note'],
      ...(mv.data || []).map((m) => [dt(m.created_at), m.transaction_type, m.reference || '', m.product_name, m.sku, m.warehouse_name, m.quantity_delta, m.created_by_name, m.note || ''])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'stock-movements.csv'; a.click();
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Low stock and the full history of stock movements." />
      <section>
        <h2>Low stock</h2>
        <Alert>{low.error}</Alert>
        {low.data && low.data.length === 0 && <Empty>Every active product is at or above its reorder level.</Empty>}
        {low.data && low.data.length > 0 && (
          <div className="table-wrap"><table>
            <thead><tr><th>SKU</th><th>Product</th><th className="r">On hand</th><th className="r">Reorder level</th><th className="r">Short by</th></tr></thead>
            <tbody>{low.data.map((p) => (
              <tr key={p.product_id}><td>{p.sku}</td><td>{p.name}</td><td className="r"><strong className="neg">{p.total_stock}</strong></td><td className="r">{p.reorder_level}</td><td className="r">{p.reorder_level - p.total_stock}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section>
        <h2>Movement history</h2>
        <div className="filters">
          <Field label="From"><input type="date" value={f.from} onChange={set('from')} /></Field>
          <Field label="To"><input type="date" value={f.to} onChange={set('to')} /></Field>
          <Field label="Warehouse"><select value={f.warehouse_id} onChange={set('warehouse_id')}><option value="">All</option>{(wh.data || []).map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}</select></Field>
          <Field label="Product"><select value={f.product_id} onChange={set('product_id')}><option value="">All</option>{(pr.data || []).map((p) => <option key={p.product_id} value={p.product_id}>{p.sku} · {p.name}</option>)}</select></Field>
          <Field label="Type"><select value={f.type} onChange={set('type')}><option value="">All</option>{['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT'].map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}</select></Field>
          <button onClick={exportCsv} disabled={!mv.data || mv.data.length === 0}>Export CSV</button>
        </div>
        <Alert>{mv.error}</Alert>
        {mv.data && mv.data.length === 0 && <Empty>No movements match these filters.</Empty>}
        {mv.data && mv.data.length > 0 && (
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Type</th><th>Product</th><th>Warehouse</th><th className="r">Change</th><th>Reference</th><th>By</th></tr></thead>
            <tbody>{mv.data.map((m) => (
              <tr key={m.movement_id}><td>{dt(m.created_at)}</td><td>{m.transaction_type.toLowerCase()}</td><td>{m.sku} · {m.product_name}</td><td>{m.warehouse_name}</td>
                <td className={`r ${m.quantity_delta < 0 ? 'neg' : 'pos'}`}>{m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}</td><td>{m.reference || m.note || ''}</td><td>{m.created_by_name}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
