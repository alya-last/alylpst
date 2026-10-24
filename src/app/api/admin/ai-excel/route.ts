import { NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { excelBuffer } from '@/lib/ai-excel'

export const maxDuration = 30

// Yapay zekanın sohbette hazırladığı Excel'i indirir. Yalnızca dosyayı hazırlatan kullanıcı açabilir (RLS: user_id = auth.uid()).
export async function GET(req: Request) {
  const y = await modulGerekli([]); if (y.hata) return y.hata
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Geçersiz dosya' }, { status: 400 })
  const { data } = await y.sb.from('ai_excel').select('baslik,sayfalar').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Dosya bulunamadı (7 gün sonra silinir)' }, { status: 404 })
  const buf = await excelBuffer(data.baslik, data.sayfalar as any)
  const ad = String(data.baslik).replace(/[^\p{L}\p{N}\- ]/gu, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'rapor'
  return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${encodeURIComponent(ad)}.xlsx"; filename*=UTF-8''${encodeURIComponent(ad)}.xlsx`, 'Cache-Control': 'no-store' } })
}
