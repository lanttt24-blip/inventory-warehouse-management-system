import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Field, PageHeader, useLoad } from '../components/ui.jsx';

export default function Users() {
  const users = useLoad(() => api('/users'));
  const roles = useLoad(() => api('/roles'));
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ error: '', ok: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault(); setMsg({ error: '', ok: '' });
    try { await api('/users', { method: 'POST', body: { ...form, role_id: Number(form.role_id) } }); setForm(null); setMsg({ error: '', ok: 'User created.' }); users.reload(); }
    catch (err) { setMsg({ error: err.message, ok: '' }); }
  }
  async function toggle(u) {
    setMsg({ error: '', ok: '' });
    try { await api(`/users/${u.user_id}`, { method: 'PATCH', body: { is_active: !u.is_active } }); users.reload(); }
    catch (err) { setMsg({ error: err.message, ok: '' }); }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Accounts and the role that decides what each person can do.">
        <button className="primary" onClick={() => setForm({ full_name: '', email: '', password: '', role_id: '' })}>Add user</button>
      </PageHeader>
      <Alert>{msg.error}</Alert><Alert kind="ok">{msg.ok}</Alert>
      {form && (
        <form className="panel" onSubmit={save}>
          <h2>New user</h2>
          <div className="grid">
            <Field label="Full name"><input value={form.full_name} onChange={set('full_name')} required /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={set('email')} required /></Field>
            <Field label="Password" hint="At least 8 characters."><input type="password" minLength={8} value={form.password} onChange={set('password')} required /></Field>
            <Field label="Role"><select value={form.role_id} onChange={set('role_id')} required><option value="">Choose a role</option>{(roles.data || []).map((r) => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}</select></Field>
          </div>
          <div className="actions"><button className="primary">Create user</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <Alert>{users.error}</Alert>
      {users.data && (
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>{users.data.map((u) => (
            <tr key={u.user_id} className={u.is_active ? '' : 'dim'}><td>{u.full_name}</td><td>{u.email}</td><td>{u.role_name}</td><td>{u.is_active ? 'Active' : 'Inactive'}</td>
              <td className="r row-actions"><button className="link" onClick={() => toggle(u)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</button></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
