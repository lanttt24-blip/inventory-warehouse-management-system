import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty, Field, PageHeader, useLoad } from '../components/ui.jsx';

export default function Suppliers() {
  const { can } = useAuth();
  const canEdit = can('Purchasing Staff');
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ error: '', ok: '' });
  const list = useLoad(() => api('/suppliers'));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault(); setMsg({ error: '', ok: '' });
    try {
      const body = { name: form.name, email: form.email, phone: form.phone, address: form.address };
      if (form.supplier_id) await api(`/suppliers/${form.supplier_id}`, { method: 'PATCH', body });
      else await api('/suppliers', { method: 'POST', body });
      setForm(null); setMsg({ error: '', ok: 'Supplier saved.' }); list.reload();
    } catch (err) { setMsg({ error: err.message, ok: '' }); }
  }
  async function toggle(s) {
    try { await api(`/suppliers/${s.supplier_id}`, { method: 'PATCH', body: { is_active: !s.is_active } }); list.reload(); }
    catch (err) { setMsg({ error: err.message, ok: '' }); }
  }

  return (
    <>
      <PageHeader title="Suppliers" subtitle="Who you buy from.">
        {canEdit && <button className="primary" onClick={() => setForm({ name: '', email: '', phone: '', address: '' })}>Add supplier</button>}
      </PageHeader>
      <Alert>{msg.error}</Alert><Alert kind="ok">{msg.ok}</Alert>
      {form && (
        <form className="panel" onSubmit={save}>
          <h2>{form.supplier_id ? 'Edit supplier' : 'New supplier'}</h2>
          <div className="grid">
            <Field label="Name"><input value={form.name} onChange={set('name')} required /></Field>
            <Field label="Email"><input type="email" value={form.email || ''} onChange={set('email')} /></Field>
            <Field label="Phone"><input value={form.phone || ''} onChange={set('phone')} /></Field>
            <Field label="Address"><input value={form.address || ''} onChange={set('address')} /></Field>
          </div>
          <div className="actions"><button className="primary">Save supplier</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <Alert>{list.error}</Alert>
      {list.data && list.data.length === 0 && <Empty>No suppliers yet.</Empty>}
      {list.data && list.data.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>{list.data.map((s) => (
            <tr key={s.supplier_id} className={s.is_active ? '' : 'dim'}>
              <td>{s.name}</td><td>{s.email || '—'}</td><td>{s.phone || '—'}</td><td>{s.is_active ? 'Active' : 'Inactive'}</td>
              {canEdit && <td className="r row-actions">
                <button className="link" onClick={() => setForm(s)}>Edit</button>
                <button className="link" onClick={() => toggle(s)}>{s.is_active ? 'Deactivate' : 'Reactivate'}</button>
              </td>}
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
