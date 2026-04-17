import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/upload — Upload image to Supabase Storage
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: '没有文件' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `uploads/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await db.storage
      .from('photos')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = db.storage.from('photos').getPublicUrl(filePath);

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const config = {
  api: { bodyParser: false },
};
