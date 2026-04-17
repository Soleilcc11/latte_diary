import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/password';

// GET /api/notebooks/[code] — Get notebook info (no password hash exposed)
export async function GET(request, { params }) {
  try {
    const { code } = await params;
    const db = getSupabaseAdmin();

    const { data, error } = await db
      .from('notebooks')
      .select('id, name, emoji, share_code, created_at, password_hash')
      .eq('share_code', code)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '笔记本不存在' }, { status: 404 });
    }

    return NextResponse.json({
      notebook: {
        id: data.id,
        name: data.name,
        emoji: data.emoji,
        share_code: data.share_code,
        created_at: data.created_at,
        has_password: !!data.password_hash,
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/notebooks/[code] — Update notebook
export async function PUT(request, { params }) {
  try {
    const { code } = await params;
    const { name, emoji, password, token } = await request.json();
    const db = getSupabaseAdmin();

    // Verify access
    const nb = await getNotebook(db, code);
    if (!nb) return NextResponse.json({ error: '笔记本不存在' }, { status: 404 });
    if (!await verifyAccess(request, nb)) {
      return NextResponse.json({ error: '需要密码验证' }, { status: 401 });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (emoji !== undefined) updates.emoji = emoji;
    if (password !== undefined) {
      updates.password_hash = password ? await hashPassword(password) : null;
    }

    const { data, error } = await db
      .from('notebooks')
      .update(updates)
      .eq('share_code', code)
      .select('id, name, emoji, share_code, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, notebook: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getNotebook(db, code) {
  const { data } = await db.from('notebooks').select('*').eq('share_code', code).single();
  return data;
}

async function verifyAccess(request, nb) {
  if (!nb.password_hash) return true;
  const cookie = request.cookies.get(`nb_token_${nb.share_code}`);
  return cookie?.value === nb.password_hash;
}
