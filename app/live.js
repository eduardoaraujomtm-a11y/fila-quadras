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

// remaining play time for a court, in ms
export function msLeft(court, now, limitMinutes) {
  if (court.status !== 'playing' || !court.playStartedAt) return null;
  const end = court.playStartedAt + limitMinutes * 60 * 1000;
  return end - now;
}
