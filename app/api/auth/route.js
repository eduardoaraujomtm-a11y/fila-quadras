import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminPassword, ADMIN_COOKIE } from '../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  return NextResponse.json({ authed: store.get(ADMIN_COOKIE)?.value === adminPassword() });
}

export async function POST(req) {
  const { password } = await req.json();
  if (password !== adminPassword()) {
    return NextResponse.json({ ok: false, error: 'Senha incorreta.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminPassword(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
