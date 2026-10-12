import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty, Field, PageHeader, money, useLoad } from '../components/ui.jsx';

const blank = { sku: '', name: '', category_id: '', unit: 'pcs', unit_cost: 0, reorder_level: 0 };

export default function Products() {
  const { can } = useAuth();
  const admin = can();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(null); // null = closed, object = open (with product_id when editing)
  const [msg, setMsg] = useState({ error: '', ok: '' });
  const cats = useLoad(() => api('/categories'));
  const list = useLoad(() => api('/products', { params: { search, include_inactive: showInactive } }), [search, showInactive]);

  async function save(e) {
    e.preventDefault();
    setMsg({ error: '', ok: '' });
    try {
      const body = { sku: form.sku, name: form.name, category_id: form.category_id || null, unit: form.unit, unit_cost: Number(form.unit_cost), reorder_level: Number(form.reorder_level) };
      if (form.product_id) await api(`/products/${form.product_id}`, { method: 'PATCH', body });
      else await api('/products', { method: 'POST', body });
      setMsg({ error: '', ok: form.product_id ? 'Product updated.' : 'Product created.' });
      setForm(null); list.reload();
    } catch (err) { setMsg({ error: err.message, ok: '' }); }
  }
  async function toggle(p) {
    setMsg({ error: '', ok: '' });
    try { await api(`/products/${p.product_id}`, { method: 'PATCH', body: { is_active: !p.is_active } }); list.reload(); }
    catch (err) { setMsg({ error: err.message, ok: '' }); }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Products" subtitle="The catalog every transaction refers to.">
        {admin && <button className="primary" onClick={() => setForm(blank)}>Add product</button>}
      </PageHeader>
      <Alert>{msg.error}</Alert><Alert kind="ok">{msg.ok}</Alert>

      {form && (
        <form className="panel" onSubmit={save}>
          <h2>{form.product_id ? 'Edit product' : 'New product'}</h2>
          <div className="grid">
            <Field label="SKU" hint="Must be unique."><input value={form.sku} onChange={set('sku')} required /></Field>
            <Field label="Name"><input value={form.name} onChange={set('name')} required /></Field>
            <Field label="Category">
              <select value={form.category_id || ''} onChange={set('category_id')}>
                <option value="">None</option>
                {(cats.data || []).map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
            </Field>
            <Field label="Unit"><input value={form.unit} onChange={set('unit')} required /></Field>
            <Field label="Unit cost (VND)"><input type="number" min="0" value={form.unit_cost} onChange={set('unit_cost')} /></Field>
            <Field label="Reorder level" hint="Warn when total stock falls below this."><input type="number" min="0" step="1" value={form.reorder_level} onChange={set('reorder_level')} /></Field>
          </div>
          <div className="actions"><button className="primary">Save product</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      <div className="filters">
        <Field label="Search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU or product name" /></Field>
        {admin && <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show deactivated</label>}
      </div>
      <Alert>{list.error}</Alert>
      {list.data && list.data.length === 0 && <Empty>No products match your search.</Empty>}
      {list.data && list.data.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th className="r">Unit cost</th><th className="r">In stock</th><th className="r">Reorder at</th>{admin && <th></th>}</tr></thead>
          <tbody>{list.data.map((p) => (
            <tr key={p.product_id} className={p.is_active ? '' : 'dim'}>
              <td>{p.sku}</td><td>{p.name}{!p.is_active && <span className="tag"> deactivated</span>}</td><td>{p.category_name || '—'}</td>
              <td className="r">{money(p.unit_cost)}</td>
              <td className="r">{p.total_stock} {p.unit}{p.is_active && p.total_stock < p.reorder_level && <span className="tag"> low</span>}</td>
              <td className="r">{p.reorder_level}</td>
              {admin && <td className="r row-actions">
                <button className="link" onClick={() => setForm({ ...p, category_id: p.category_id || '' })}>Edit</button>
                <button className="link" onClick={() => toggle(p)}>{p.is_active ? 'Deactivate' : 'Reactivate'}</button>
              </td>}
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
