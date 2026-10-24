// Hazır (sabit) cevaplar: sık sorulan, yanlış anlaşılması maliyetli sorular için
// yapay zekaya hiç gitmeden, doğrudan kayıtlardan üretilir. Aynı soru her seferinde aynı rakamı verir.
// Bu dosyadaki "saf" fonksiyonlar (niyet bulma, biçimlendirme) scripts/ai-test.mts ile test edilir.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Niyet = 'cek_genel' | 'cek_takas' | 'cek_elde' | 'cek_karsiliksiz' | 'kasa_banka' | 'kira_duzeni'

const tr = (s: string) => s.toLocaleLowerCase('tr').replace(/[?!.,;:()"']/g, ' ').replace(/\s+/g, ' ').trim()

// Bu sözcüklerden biri varsa soru "kişi/tarih/ayrıntı" içeriyor demektir: serbest yoruma (yapay zeka) bırak
const AYRINTI = /vadesi|vade tarihi|bu hafta|haftaya|bu ay|gelecek|geçen|gecen|kimden|kime |hangi cari|firma|müşteri|musteri|tedarik|ekstre|neden|niye|karşılaştır|karsilastir|tahmin|öner|(^| )yorum(la|u)?( |$)/

/** Sorunun hangi hazır cevaba karşılık geldiğini bulur; emin değilse null (yapay zekaya bırakılır). */
export function soruNiyeti(soru: string): Niyet | null {
  const t = tr(soru)
  if (!t || t.split(' ').length > 18) return null
  if (AYRINTI.test(t)) return null
  if (/excel|dosya|indir/.test(t)) return null // dosya isteği: yapay zeka excel_olustur ile hazırlar
  // Kira ödeme DÜZENİ (kime, hangi gün, ne kadar banka/elden); belirli bir ay/tutar sorusu değildir
  if (/kira/.test(t) && /nasıl|nasil|düzen|duzen|plan|elden|bankadan|banka/.test(t)) return 'kira_duzeni'
  const cek = /(^|\s)(çek|cek|senet|evrak)/.test(t)
  if (cek) {
    if (/karşılıksız|karsiliksiz/.test(t)) return 'cek_karsiliksiz'
    const takas = /takas|bankada|tahsilde|tahsile|garanti/.test(t)
    const elde = /elde|elimiz|elimde|elinizde|kasamız|kasamiz|portföy|portfoy|kalan/.test(t)
    const durum = /durum|özet|ozet|genel|toplam|kaç|kac/.test(t)
    if (takas && /durum|özet|ozet|genel/.test(t)) return 'cek_genel'
    if (takas) return 'cek_takas'
    if (elde) return 'cek_elde'
    if (durum) return 'cek_genel'
    return null
  }
  if (/kasa|banka|hesap/.test(t) && !/cari|müşteri|musteri|tedarik|borç|borc|alacak/.test(t) && /(bakiye|ne kadar|kaç|kac|durum|toplam|var)/.test(t)) return 'kasa_banka'
  return null
}

export type CekSatir = { tip?: string | null; yon?: string | null; no?: string | null; banka?: string | null; tutar?: number | string | null; vade_tarihi?: string | null; durum?: string | null; aciklama?: string | null; resmiyet?: string | null; cari?: string | null }

const yuvarla = (n: number) => Math.round(n * 100) / 100
const para = (n: number) => yuvarla(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
const tarihTr = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('.') : '—')
const tipAd = (x: CekSatir) => (/senet/i.test(x.tip || '') ? 'Senet' : 'Çek')

export const bankadaMi = (x: CekSatir) => x.yon === 'alinan' && x.durum === 'ciro_edildi' && /takas|tahsile/i.test(x.aciklama || '')
export const eldeMi = (x: CekSatir) => x.yon === 'alinan' && x.durum === 'portfoyde'

/** "4 çek + 1 senet" biçiminde adet metni */
export function adetMetni(l: CekSatir[]) {
  const c = l.filter(x => tipAd(x) === 'Çek').length, s = l.length - c
  const p = [c ? `${c} çek` : '', s ? `${s} senet` : ''].filter(Boolean)
  return p.length ? p.join(' + ') : '0'
}
const toplam = (l: CekSatir[]) => yuvarla(l.reduce((t, x) => t + (+(x.tutar as any) || 0), 0))
const vadeSirala = (l: CekSatir[]) => [...l].sort((a, b) => (a.vade_tarihi || '').localeCompare(b.vade_tarihi || ''))

function listeSatirlari(l: CekSatir[]) {
  return vadeSirala(l).map(x => `• ${tarihTr(x.vade_tarihi)} · ${tipAd(x)} · ${x.cari || '—'}${x.banka && x.banka !== 'SENET' ? ' · ' + x.banka : ''}${x.resmiyet === 'resmi' ? ' · resmi' : x.resmiyet === 'gayri_resmi' ? ' · gayrı resmi' : ''} · ${para(+(x.tutar as any) || 0)}`)
}

export function cekYaniti(niyet: Exclude<Niyet, 'kasa_banka' | 'kira_duzeni'>, rows: CekSatir[]): string {
  const alinan = rows.filter(x => x.yon === 'alinan')
  const elde = rows.filter(eldeMi), banka = rows.filter(bankadaMi)
  const kars = rows.filter(x => x.durum === 'karsiliksiz')
  const not = '\n\n(Bu rakamlar doğrudan çek/senet kayıtlarından alınmıştır.)'
  if (niyet === 'cek_elde') return `ELİMİZDE (portföy): ${adetMetni(elde)} — toplam ${para(toplam(elde))}\n${listeSatirlari(elde).join('\n') || '(yok)'}\n\nBankada tahsilde olanlar elde sayılmaz; onları sormak için "takastakiler" diyebilirsiniz.${not}`
  if (niyet === 'cek_takas') return `BANKADA TAHSİLDE (Garanti Bankası takas): ${adetMetni(banka)} — toplam ${para(toplam(banka))}\n${listeSatirlari(banka).join('\n') || '(yok)'}\n\nBunlar elde değildir, vadesi gelince hesaba geçer.${not}`
  if (niyet === 'cek_karsiliksiz') return `KARŞILIKSIZ: ${adetMetni(kars)} — toplam ${para(toplam(kars))}\n${listeSatirlari(kars).join('\n') || '(yok)'}${not}`
  // genel durum
  const ciro = alinan.filter(x => x.durum === 'ciro_edildi' && !bankadaMi(x))
  const tahsil = alinan.filter(x => x.durum === 'tahsil_edildi')
  const verilen = rows.filter(x => x.yon === 'verilen')
  const odenen = verilen.filter(x => x.durum === 'odendi'), iptal = verilen.filter(x => x.durum === 'iptal')
  return [
    `ÇEK/SENET DURUMU (toplam ${rows.length} kayıt)`,
    '',
    `ALINAN ÇEK/SENETLER (${alinan.length} kayıt, ${para(toplam(alinan))})`,
    `• Elimizde (portföy): ${adetMetni(elde)} — ${para(toplam(elde))}`,
    `• Bankada tahsilde (Garanti takas): ${adetMetni(banka)} — ${para(toplam(banka))}`,
    `• Karşılıksız çıkan: ${adetMetni(kars)} — ${para(toplam(kars))}`,
    `• Tahsil edilen: ${adetMetni(tahsil)} — ${para(toplam(tahsil))}`,
    `• Tedarikçiye ciro edilen: ${adetMetni(ciro)} — ${para(toplam(ciro))}`,
    '',
    `VERİLEN ÇEKLER (${verilen.length} kayıt, ${para(toplam(verilen))})`,
    `• Ödenen: ${adetMetni(odenen)} — ${para(toplam(odenen))}`,
    ...(iptal.length ? [`• İptal: ${adetMetni(iptal)} — ${para(toplam(iptal))}`] : []),
    '',
    `ELİMİZDEKİLER (vade sırasıyla)`, ...listeSatirlari(elde),
    '',
    `BANKADA TAHSİLDE (vade sırasıyla)`, ...listeSatirlari(banka),
  ].join('\n') + not
}

export type HesapSatir = { ad: string; tip?: string | null; para_birimi?: string | null; bakiye?: number | string | null; aktif?: boolean | null }
export function kasaYaniti(rows: HesapSatir[]): string {
  const l = rows.filter(h => h.aktif !== false)
  const pb = (h: HesapSatir) => h.para_birimi || 'TRY'
  const sirali = [...l].sort((a, b) => pb(a).localeCompare(pb(b)) || a.ad.localeCompare(b.ad, 'tr'))
  const f = (n: number, p: string) => yuvarla(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (p === 'TRY' ? 'TL' : p)
  const tp: Record<string, number> = {}; l.forEach(h => { tp[pb(h)] = (tp[pb(h)] || 0) + (+(h.bakiye as any) || 0) })
  return [
    'KASA / BANKA BAKİYELERİ',
    ...sirali.map(h => `• ${h.ad} (${pb(h)}): ${f(+(h.bakiye as any) || 0, pb(h))}`),
    '',
    'TOPLAM (para birimleri ayrı, TL ile toplanmaz)',
    ...Object.entries(tp).map(([p, n]) => `• ${p === 'TRY' ? 'TL' : p}: ${f(n, p)}`),
    '',
    '(Bu rakamlar doğrudan hesap kayıtlarından alınmıştır.)',
  ].join('\n')
}

export type KiraSatir = { ev_sahibi: string; odeme_gunu: number | string; banka: number | string; elden: number | string; not_?: string | null; aktif?: boolean | null }
export function kiraYaniti(rows: KiraSatir[]): string {
  const l = rows.filter(x => x.aktif !== false).sort((a, b) => (+a.odeme_gunu) - (+b.odeme_gunu) || a.ev_sahibi.localeCompare(b.ev_sahibi, 'tr'))
  if (!l.length) return 'Kira ödeme düzeni kaydı bulunamadı.'
  const n = (v: any) => +v || 0
  const tB = yuvarla(l.reduce((t, x) => t + n(x.banka), 0)), tE = yuvarla(l.reduce((t, x) => t + n(x.elden), 0))
  return [
    'KİRA ÖDEME DÜZENİ (aylık)',
    'Her ev sahibine kira kısmen bankadan (Garanti TL hesabı, havale), kısmen elden nakit ödenir.',
    '',
    ...l.map(x => `• ${x.ev_sahibi} — ayın ${x.odeme_gunu}'inde: banka ${para(n(x.banka))} + elden ${para(n(x.elden))} = ${para(n(x.banka) + n(x.elden))}${x.not_ ? `\n   (${x.not_})` : ''}`),
    '',
    `TOPLAM: banka ${para(tB)} + elden ${para(tE)} = ${para(tB + tE)} / ay`,
    '',
    '(Kiralar her yıl Ocak ayında değişir; bu düzen kayıtlı kira planından alınmıştır.)',
  ].join('\n')
}

/** Soru hazır cevaba uyuyorsa cevabı üretir; uymuyorsa null (yapay zekaya devredilir). Hata olursa da null. */
export async function hazirCevap(sb: SupabaseClient, soru: string): Promise<{ yanit: string; araclar: string[] } | null> {
  const n = soruNiyeti(soru)
  if (!n) return null
  try {
    if (n === 'kira_duzeni') {
      const r: any = await sb.from('kira_plani').select('ev_sahibi,odeme_gunu,banka,elden,not_,aktif').limit(50)
      if (r.error || !r.data?.length) return null
      return { yanit: kiraYaniti(r.data), araclar: ['hazir_kira_plani'] }
    }
    if (n === 'kasa_banka') {
      const r: any = await sb.from('kasa_banka_hesaplari').select('ad,tip,para_birimi,bakiye,aktif').limit(500)
      if (r.error || !r.data?.length) return null
      return { yanit: kasaYaniti(r.data), araclar: ['hazir_kasa_banka'] }
    }
    const [c, h]: any[] = await Promise.all([
      sb.from('cek_senet').select('tip,yon,no,banka,tutar,vade_tarihi,durum,aciklama,cari_id,resmiyet').limit(2000),
      sb.from('cari_hesaplar').select('id,ad').limit(5000),
    ])
    if (c.error || !c.data) return null
    const ad = new Map<string, string>((h.data || []).map((x: any) => [x.id, x.ad]))
    const rows: CekSatir[] = c.data.map((x: any) => ({ ...x, cari: ad.get(x.cari_id) || null }))
    return { yanit: cekYaniti(n, rows), araclar: ['hazir_cek_senet'] }
  } catch { return null }
}
