import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty, Field, PageHeader, useLoad } from '../components/ui.jsx';

export default function Warehouses() {
  const { can } = useAuth();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ error: '', ok: '' });
  const list = useLoad(() => api('/warehouses'));

  async function save(e) {
    e.preventDefault(); setMsg({ error: '', ok: '' });
    try {
      const body = { name: form.name, location: form.location };
      if (form.warehouse_id) await api(`/warehouses/${form.warehouse_id}`, { method: 'PATCH', body });
      else await api('/warehouses', { method: 'POST', body });
      setForm(null); setMsg({ error: '', ok: 'Warehouse saved.' }); list.reload();
    } catch (err) { setMsg({ error: err.message, ok: '' }); }
  }
  async function toggle(w) {
    try { await api(`/warehouses/${w.warehouse_id}`, { method: 'PATCH', body: { is_active: !w.is_active } }); list.reload(); }
    catch (err) { setMsg({ error: err.message, ok: '' }); }
  }

  return (
    <>
      <PageHeader title="Warehouses" subtitle="Locations where stock is held.">
        {can() && <button className="primary" onClick={() => setForm({ name: '', location: '' })}>Add warehouse</button>}
      </PageHeader>
      <Alert>{msg.error}</Alert><Alert kind="ok">{msg.ok}</Alert>
      {form && (
        <form className="panel" onSubmit={save}>
          <h2>{form.warehouse_id ? 'Edit warehouse' : 'New warehouse'}</h2>
          <div className="grid">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Location"><input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          </div>
          <div className="actions"><button className="primary">Save warehouse</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <Alert>{list.error}</Alert>
      {list.data && list.data.length === 0 && <Empty>No warehouses yet.</Empty>}
      {list.data && list.data.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Location</th><th>Status</th>{can() && <th></th>}</tr></thead>
          <tbody>{list.data.map((w) => (
            <tr key={w.warehouse_id} className={w.is_active ? '' : 'dim'}>
              <td>{w.name}</td><td>{w.location || '—'}</td><td>{w.is_active ? 'Active' : 'Inactive'}</td>
              {can() && <td className="r row-actions">
                <button className="link" onClick={() => setForm(w)}>Edit</button>
                <button className="link" onClick={() => toggle(w)}>{w.is_active ? 'Deactivate' : 'Reactivate'}</button>
              </td>}
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
