import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'

// Oturum bitince süre ve araç sayısını kaydeder (yalnızca kullanıcının kendi kaydı — RLS).
export async function POST(req: NextRequest) {
  const y = await modulGerekli(); if (y.hata) return y.hata
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const id = String(b?.oturum_id || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return NextResponse.json({ ok: true })
  const kelepce = (v: unknown, mx: number) => Math.min(Math.max(Math.round(Number(v) || 0), 0), mx)
  await y.sb.from('ai_ses_oturumlari').update({ bitti: new Date().toISOString(), sure_sn: kelepce(b.sure_sn, 7200), arac_sayisi: kelepce(b.arac_sayisi, 1000) }).eq('id', id)
  return NextResponse.json({ ok: true })
}
