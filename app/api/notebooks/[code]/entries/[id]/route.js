import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// PUT /api/notebooks/[code]/entries/[id] — Update entry
export async function PUT(request, { params }) {
  try {
    const { code, id } = await params;
    const { date, notes, photos } = await request.json();
    const db = getSupabaseAdmin();

    const nb = await getNotebookByCode(db, code);
    if (!nb) return NextResponse.json({ error: '笔记本不存在' }, { status: 404 });
    if (!verifyAccess(request, nb)) {
      return NextResponse.json({ error: '需要密码验证' }, { status: 401 });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (date !== undefined) updates.date = date;
    if (notes !== undefined) updates.notes = notes;
    if (photos !== undefined) updates.photos = photos;

    const { data, error } = await db
      .from('entries')
      .update(updates)
      .eq('id', id)
      .eq('notebook_id', nb.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, entry: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/notebooks/[code]/entries/[id] — Delete entry
export async function DELETE(request, { params }) {
  try {
    const { code, id } = await params;
    const db = getSupabaseAdmin();

    const nb = await getNotebookByCode(db, code);
    if (!nb) return NextResponse.json({ error: '笔记本不存在' }, { status: 404 });
    if (!verifyAccess(request, nb)) {
      return NextResponse.json({ error: '需要密码验证' }, { status: 401 });
    }

    const { error } = await db
      .from('entries')
      .delete()
      .eq('id', id)
      .eq('notebook_id', nb.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
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
