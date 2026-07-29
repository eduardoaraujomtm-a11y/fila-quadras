import { cookies } from 'next/headers';

// Senha dos funcionários. Vem de env (RECEPCAO_PASSWORD); se ausente, usa o padrão.
export function adminPassword() {
  return process.env.RECEPCAO_PASSWORD || 'lira2026';
}

export const ADMIN_COOKIE = 'fila_admin';

export async function isAdmin() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === adminPassword();
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    const e = new Error('Acesso restrito aos funcionários.');
    e.status = 401;
    throw e;
  }
}
