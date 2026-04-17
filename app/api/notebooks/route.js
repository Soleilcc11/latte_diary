import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashPassword, generateShareCode } from '@/lib/password';

// POST /api/notebooks — Create a new notebook
export async function POST(request) {
  try {
    const { name, emoji, password } = await request.json();
    const db = getSupabaseAdmin();

    // Generate unique share code
    let shareCode;
    let attempts = 0;
    while (attempts < 10) {
      shareCode = generateShareCode();
      const { data: existing } = await db.from('notebooks').select('id').eq('share_code', shareCode).single();
      if (!existing) break;
      attempts++;
    }

    const notebook = {
      name: name || '拉花日记',
      emoji: emoji || '☕',
      share_code: shareCode,
      password_hash: password ? await hashPassword(password) : null,
    };

    const { data, error } = await db.from('notebooks').insert(notebook).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, notebook: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
