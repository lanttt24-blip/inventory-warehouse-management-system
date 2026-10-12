import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Empty, Field, PageHeader, dt, useLoad } from '../components/ui.jsx';

export default function Stock() {
  const [warehouse, setWarehouse] = useState('');
  const [search, setSearch] = useState('');
  const wh = useLoad(() => api('/warehouses'));
  const st = useLoad(() => api('/stock', { params: { warehouse_id: warehouse, search } }), [warehouse, search]);

  return (
    <>
      <PageHeader title="Stock levels" subtitle="Quantity on hand for each product in each warehouse." />
      <div className="filters">
        <Field label="Warehouse">
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option value="">All warehouses</option>
            {(wh.data || []).map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU or product name" /></Field>
      </div>
      <Alert>{st.error}</Alert>
      {st.data && st.data.length === 0 && <Empty>No stock records match. Receive stock to add some.</Empty>}
      {st.data && st.data.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th>SKU</th><th>Product</th><th>Warehouse</th><th className="r">Quantity</th><th>Updated</th></tr></thead>
          <tbody>{st.data.map((r) => (
            <tr key={r.stock_id}><td>{r.sku}</td><td>{r.name}</td><td>{r.warehouse_name}</td>
              <td className="r">{r.quantity} {r.unit}{r.quantity < r.reorder_level && <span className="tag"> low</span>}</td>
              <td>{dt(r.updated_at)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
