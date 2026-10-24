import type { SupabaseClient } from '@supabase/supabase-js'
import { hesaplaPuantaj, type Ayar, type PuantajSatiri, type Vardiya } from '@/lib/puantaj'

export class PersonelHata extends Error { constructor(m: string, public durum = 400) { super(m) } }

const pad = (n: number) => String(n).padStart(2, '0')
export function ayAraligi(donem: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(donem || ''); if (!m || +m[2] < 1 || +m[2] > 12) throw new PersonelHata('Dönem YYYY-AA biçiminde olmalı.')
  const y = +m[1], a = +m[2], son = new Date(Date.UTC(y, a, 0)).getUTCDate()
  return { bas: `${y}-${pad(a)}-01`, bit: `${y}-${pad(a)}-${pad(son)}` }
}
const yerelGunBasi = (tarih: string, ekGun = 0) => new Date(Date.parse(tarih + 'T00:00:00Z') + ekGun * 86400000 - 3 * 3600e3).toISOString() // İstanbul gün başı → UTC

async function sayfala<T>(soru: (bas: number, bit: number) => PromiseLike<{ data: T[] | null; error: any }>, ust = 40000): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ust; i += 1000) {
    const { data, error } = await soru(i, i + 999); if (error) throw new PersonelHata('Veri okunamadı: ' + error.message, 500)
    out.push(...(data || [])); if (!data || data.length < 1000) break
  }
  return out
}

/** Puantajı kullanıcının kendi oturumuyla (RLS: personel/yönetim) okuyup hesaplar. */
export async function puantajVerisi(sb: SupabaseClient, bas: string, bit: string, opt: { personelId?: string; simdi?: Date } = {}) {
  const [ayarR, vardR, tatR] = await Promise.all([
    sb.from('personel_ayarlari').select('*').eq('id', 1).maybeSingle(),
    sb.from('vardiyalar').select('*'),
    sb.from('resmi_tatiller').select('*').gte('tarih', bas).lte('tarih', bit),
  ])
  if (vardR.error) throw new PersonelHata(/permission|policy|denied/i.test(vardR.error.message) ? 'Bu veriye erişim yetkin yok.' : vardR.error.message, /permission|policy|denied/i.test(vardR.error.message) ? 403 : 500)
  const ayar: Ayar & { fazla_mesai_carpani?: number } = { haftalik_normal_saat: 45, hafta_tatili: 0, calisma_gunleri: [1, 2, 3, 4, 5, 6], unutulan_cikis_saat: 16, ...(ayarR.data || {}) }

  let pq = sb.from('personel').select('id,sicil_no,ad_soyad,departman,vardiya_id,ise_giris,isten_cikis,aktif').order('ad_soyad', { ascending: true }).limit(2000)
  if (opt.personelId) pq = pq.eq('id', opt.personelId)
  const pr = await pq; if (pr.error) throw new PersonelHata(pr.error.message, 500)
  // Aktif olanlar + dönem içinde işten ayrılanlar
  const personeller = (pr.data || []).filter((p: any) => p.aktif || (p.isten_cikis && p.isten_cikis >= bas))
  const ids = personeller.map((p: any) => p.id)

  let hareketler: any[] = [], izinler: any[] = []
  if (ids.length) {
    const from = yerelGunBasi(bas, -1), to = yerelGunBasi(bit, 2)
    hareketler = await sayfala<any>((a, b) => { let q = sb.from('personel_hareketleri').select('personel_id,zaman,yon').gte('zaman', from).lt('zaman', to).order('zaman', { ascending: true }).range(a, b); if (opt.personelId) q = q.eq('personel_id', opt.personelId); return q })
    const ir = await sb.from('personel_izinleri').select('personel_id,tur,baslangic,bitis').lte('baslangic', bit).gte('bitis', bas)
    if (ir.error) throw new PersonelHata(ir.error.message, 500)
    izinler = ir.data || []
  }
  const satirlar = hesaplaPuantaj({ personeller, vardiyalar: (vardR.data || []) as Vardiya[], hareketler, izinler, tatiller: (tatR.data || []) as any, ayar, bas, bit, simdi: opt.simdi })
  return { satirlar, ayar, vardiyalar: (vardR.data || []) as Vardiya[], tatiller: tatR.data || [] }
}
