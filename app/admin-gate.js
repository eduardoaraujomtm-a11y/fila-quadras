'use client';
import { useEffect, useState } from 'react';
import { postJSON } from './live';

export default function AdminGate({ children }) {
  const [authed, setAuthed] = useState(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    try {
      const r = await fetch('/api/auth', { cache: 'no-store' });
      const j = await r.json();
      setAuthed(j.authed);
    } catch {
      setAuthed(false);
    }
  }
  useEffect(() => { check(); }, []);

  async function submit() {
    setBusy(true); setErr(null);
    const j = await postJSON('/api/auth', { password: pw });
    setBusy(false);
    if (!j.ok) { setErr(j.error || 'Senha incorreta.'); return; }
    setPw('');
    check();
  }

  if (authed === null) {
    return <div className="wrap"><div className="card">Carregando…</div></div>;
  }

  if (!authed) {
    return (
      <div className="wrap">
        <div className="topbar">
          <a className="back" href="/">← início</a>
          <span className="kicker"><span className="ball" /> Funcionários</span>
        </div>
        <div className="card" style={{ maxWidth: 420, margin: '24px auto 0' }}>
          <h2>Área restrita</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: -6 }}>Digite a senha dos funcionários para acessar.</p>
          {err && <div className="err">{err}</div>}
          <input className="field" type="password" placeholder="Senha" value={pw}
            onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
          <div style={{ height: 12 }} />
          <button className="btn primary block" disabled={busy || !pw} onClick={submit}>Entrar</button>
        </div>
      </div>
    );
  }

  return children;
}
