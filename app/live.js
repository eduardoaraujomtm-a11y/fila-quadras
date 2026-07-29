'use client';
import { useEffect, useRef, useState } from 'react';

export function useSnapshot(intervalMs = 2000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  async function tick() {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      const j = await r.json();
      setData(j);
      setError(null);
    } catch (e) {
      setError('Sem conexão com o servidor.');
    }
  }

  useEffect(() => {
    tick();
    timer.current = setInterval(tick, intervalMs);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, error, refresh: tick };
}

export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export async function postJSON(url, body, method = 'POST') {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// milliseconds -> "MM:SS"
export function fmtClock(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// timestamp -> "HH:MM"
export function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// remaining play time for a court, in ms (usa o limite do grupo: 60 ou 30)
export function msLeft(court, now) {
  if (court.status !== 'playing' || !court.playStartedAt) return null;
  const lim = court.duo?.limit || 60;
  return court.playStartedAt + lim * 60 * 1000 - now;
}

// rótulo de um grupo na fila / quadra
export function groupLabel(g) {
  if (!g) return '';
  if (g.type === 'batedor') return `${g.names[0]} + Leandro`;
  if (g.type === 'singles') return g.names.join(' × ');
  let s = g.names.join(' / ');
  if (g.size < g.target) s += ` (faltam ${g.target - g.size})`;
  return s;
}

// selo curto do tipo de jogo
export function groupTag(g) {
  if (!g) return '';
  if (g.type === 'batedor') return 'Batedor · 30 min';
  if (g.type === 'doubles') return `Duplas ${g.size}/4`;
  return 'Simples';
}

// Previsão de entrada em quadra para cada grupo da fila.
// Estimativa: assume que cada jogo dura o limite (60/30), que o preparo leva ~PREP min,
// e que a recepção chama assim que a quadra libera.
const PREP_MIN = 5;

export function computeEtas(data, now) {
  const prep = PREP_MIN * 60000;
  const courts = (data?.courts || []).map((c) => {
    let freeAt;
    if (c.status === 'lesson') freeAt = c.lesson?.until || (now + 6 * 3600000);
    else if (c.status === 'playing') freeAt = Math.max(now, (c.playStartedAt || now) + (c.duo?.limit || 60) * 60000);
    else if (c.status === 'prep') freeAt = now + (c.called?.limit || 60) * 60000;
    else freeAt = now; // livre
    return { id: c.id, name: c.name, freeAt };
  });
  const byId = {};
  for (const g of (data?.queue || [])) {
    let best = courts[0];
    for (const c of courts) if (c.freeAt < best.freeAt) best = c;
    if (!best) break;
    const at = Math.max(best.freeAt, now);
    byId[g.id] = { at, waitMin: Math.max(0, Math.round((at - now) / 60000)), courtId: best.id, courtName: best.name };
    best.freeAt = at + (g.limit || 60) * 60000 + prep;
  }
  const nextFreeMin = courts.length ? Math.max(0, Math.round((Math.min(...courts.map((c) => c.freeAt)) - now) / 60000)) : null;
  return { byId, nextFreeMin };
}

export function fmtWait(min) {
  if (min == null) return '—';
  if (min <= 1) return 'a seguir';
  const r = Math.round(min / 5) * 5;
  if (r >= 60) { const h = Math.floor(r / 60), m = r % 60; return m ? `~${h}h${String(m).padStart(2, '0')}` : `~${h}h`; }
  return `~${r} min`;
}
