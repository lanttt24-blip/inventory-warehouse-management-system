import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty, PageHeader, money, useLoad } from '../components/ui.jsx';

export default function Dashboard() {
  const { user, can } = useAuth();
  const s = useLoad(() => api('/summary'));
  const low = useLoad(() => (can('Warehouse Manager') ? api('/reports/low-stock') : Promise.resolve([])), [user.role]);

  return (
    <>
      <PageHeader title={`Hello, ${user.name}`} subtitle="Where your inventory stands right now." />
      <Alert>{s.error}</Alert>
      {s.data && (
        <div className="stats">
          <div className={`stat ${s.data.low_stock > 0 ? 'warn' : ''}`}>
            <span className="num">{s.data.low_stock}</span><span>products below reorder level</span>
          </div>
          <div className="stat"><span className="num">{money(s.data.stock_value)}</span><span>stock value at cost</span></div>
          <div className="stat"><span className="num">{s.data.open_orders}</span><span>open purchase orders</span></div>
          <div className="stat"><span className="num">{s.data.products}</span><span>active products in {s.data.warehouses} warehouses</span></div>
        </div>
      )}
      {can('Warehouse Manager') && (
        <section>
          <h2>Needs reordering</h2>
          {low.data && low.data.length === 0 && <Empty>Nothing is below its reorder level.</Empty>}
          {low.data && low.data.length > 0 && (
            <table>
              <thead><tr><th>SKU</th><th>Product</th><th className="r">On hand</th><th className="r">Reorder level</th></tr></thead>
              <tbody>{low.data.map((p) => (
                <tr key={p.product_id}><td>{p.sku}</td><td>{p.name}</td>
                  <td className="r"><strong className="neg">{p.total_stock}</strong> {p.unit}</td><td className="r">{p.reorder_level}</td></tr>
              ))}</tbody>
            </table>
          )}
          <p><Link to="/reports">See full reports</Link></p>
        </section>
      )}
    </>
  );
}
