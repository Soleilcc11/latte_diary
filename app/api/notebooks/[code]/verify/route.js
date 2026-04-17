import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyPassword } from '@/lib/password';

// POST /api/notebooks/[code]/verify — Verify password, set cookie
export async function POST(request, { params }) {
  try {
    const { code } = await params;
    const { password } = await request.json();
    const db = getSupabaseAdmin();

    const { data: nb } = await db
      .from('notebooks')
      .select('id, password_hash, share_code')
      .eq('share_code', code)
      .single();

    if (!nb) {
      return NextResponse.json({ error: '笔记本不存在' }, { status: 404 });
    }

    if (!nb.password_hash) {
      return NextResponse.json({ success: true });
    }

    const valid = await verifyPassword(password, nb.password_hash);
    if (!valid) {
      return NextResponse.json({ error: '密码错误' }, { status: 403 });
    }

    // Set cookie for 7 days
    const response = NextResponse.json({ success: true });
    response.cookies.set(`nb_token_${code}`, nb.password_hash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
