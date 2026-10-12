import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { loginRequest } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { login(await loginRequest(email, password)); nav('/'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login">
      <div className="login-side">
        <h1>IWMS</h1>
        <p>Know what is on every shelf, and how it got there.</p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <h2>Log in</h2>
        <Alert>{error}</Alert>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
        <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <button className="primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </div>
  );
}
