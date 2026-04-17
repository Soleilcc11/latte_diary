import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/notebooks/[code]/entries — List all entries
export async function GET(request, { params }) {
  try {
    const { code } = await params;
    const db = getSupabaseAdmin();

    const nb = await getNotebookByCode(db, code);
    if (!nb) return NextResponse.json({ error: '笔记本不存在' }, { status: 404 });
    if (!verifyAccess(request, nb)) {
      return NextResponse.json({ error: '需要密码验证' }, { status: 401 });
    }

    const { data, error } = await db
      .from('entries')
      .select('*')
      .eq('notebook_id', nb.id)
      .order('date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ entries: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/notebooks/[code]/entries — Create entry
export async function POST(request, { params }) {
  try {
    const { code } = await params;
    const { date, notes, photos } = await request.json();
    const db = getSupabaseAdmin();

    const nb = await getNotebookByCode(db, code);
    if (!nb) return NextResponse.json({ error: '笔记本不存在' }, { status: 404 });
    if (!verifyAccess(request, nb)) {
      return NextResponse.json({ error: '需要密码验证' }, { status: 401 });
    }

    const { data, error } = await db
      .from('entries')
      .insert({
        notebook_id: nb.id,
        date,
        notes: notes || '',
        photos: photos || [],
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, entry: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getNotebookByCode(db, code) {
  const { data } = await db.from('notebooks').select('*').eq('share_code', code).single();
  return data;
}

function verifyAccess(request, nb) {
  if (!nb.password_hash) return true;
  const cookie = request.cookies.get(`nb_token_${nb.share_code}`);
  return cookie?.value === nb.password_hash;
}
