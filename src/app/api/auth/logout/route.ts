import { NextResponse } from 'next/server';
import { AUTH_COOKIE, getAuthCookieOptions } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE, '', getAuthCookieOptions(0));
  return res;
}
