'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrPage() {
  const [dataUrl, setDataUrl] = useState(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    const target = `${window.location.origin}/checkin`;
    setUrl(target);
    QRCode.toDataURL(target, { width: 520, margin: 1, color: { dark: '#17402F', light: '#FFFFFF' } })
      .then(setDataUrl)
      .catch(() => {});
  }, []);

  return (
    <div className="wrap">
      <div className="topbar no-print">
        <a className="back" href="/">← início</a>
        <span className="kicker"><span className="ball" /> QR de check-in</span>
      </div>

      <div className="card qr-print" style={{ textAlign: 'center', padding: 28 }}>
        <div className="kicker" style={{ justifyContent: 'center' }}><span className="ball" /> Fila das Quadras</div>
        <h1 style={{ fontSize: 26, margin: '10px 0 4px' }}>Escaneie para entrar na fila</h1>
        <p className="muted" style={{ fontSize: 14, margin: '0 auto 18px', maxWidth: '32ch' }}>
          Aponte a câmera do celular. Você e seu parceiro escaneiam ao chegar; só assim dá para entrar na fila.
        </p>
        {dataUrl
          ? <img src={dataUrl} alt="QR code de check-in" style={{ width: 280, height: 280, maxWidth: '80%' }} />
          : <div className="empty">Gerando QR…</div>}
        <p className="muted" style={{ fontSize: 12, marginTop: 14, wordBreak: 'break-all' }}>{url}</p>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn primary" onClick={() => window.print()}>Imprimir para colar no clube</button>
      </div>
      <p className="muted no-print" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 12 }}>
        Dica: imprima e cole na recepção e em cada quadra. Depois do deploy, o QR aponta para o endereço público do app.
      </p>
    </div>
  );
}
