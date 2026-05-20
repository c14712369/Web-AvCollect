import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_COOKIE, expectedSessionHash, timingSafeEqual } from '@/lib/auth';

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: '請輸入密碼' },
        { status: 400 }
      );
    }

    const secret = process.env.APP_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'Server 未設定 APP_SECRET' },
        { status: 500 }
      );
    }

    if (!timingSafeEqual(parsed.data.password, secret)) {
      return NextResponse.json(
        { success: false, error: '密碼錯誤' },
        { status: 401 }
      );
    }

    const sessionHash = await expectedSessionHash(secret);
    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_COOKIE, sessionHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (error) {
    console.error('[POST /api/auth/login]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
