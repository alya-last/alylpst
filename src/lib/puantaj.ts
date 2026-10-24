// Puantaj hesap motoru — saf (I/O'suz) ve deterministik. Tüm zamanlar Europe/Istanbul (UTC+3, DST yok) alınır.
// Gece vardiyalarını doğru günlere atar; süre, geç kalma, erken çıkış, fazla mesai, devamsızlık, izin ve tatil hesaplar.

export type Vardiya = { id: string; ad: string; baslangic: string; bitis: string; mola_dk: number; gec_tolerans_dk: number; fazla_mesai_esik_dk: number }
export type PersonelK = { id: string; sicil_no: string; ad_soyad: string; departman?: string | null; vardiya_id: string | null; ise_giris?: string | null; isten_cikis?: string | null; aktif?: boolean }
export type Hareket = { personel_id: string; zaman: string; yon: 'giris' | 'cikis' }
export type Izin = { personel_id: string; tur: string; baslangic: string; bitis: string }
export type Tatil = { tarih: string; ad: string; yarim_gun: boolean }
export type Ayar = { haftalik_normal_saat: number; hafta_tatili: number; calisma_gunleri: number[]; unutulan_cikis_saat?: number }

export type GunDurum = 'calisti' | 'eksik' | 'icerde' | 'devamsiz' | 'gelmedi' | 'izinli' | 'tatil' | 'yarim_tatil' | 'hafta_tatili' | 'tatilde_calisti' | 'kapsam_disi' | 'gelecek'
export type GunKaydi = {
  tarih: string; durum: GunDurum; giris: string | null; cikis: string | null
  calisilan_dk: number; gec_dk: number; erken_cikis_dk: number; fazla_mesai_dk: number; tatil_calisma_dk: number
  izin_tur?: string; tatil_ad?: string; uyarilar: string[]
}
export type PersonelOzet = {
  calisilan_gun: number; calisilan_dk: number; fazla_mesai_dk: number; tatil_calisma_dk: number
  gec_gun: number; gec_dk: number; erken_cikis_dk: number; devamsiz_gun: number; eksik_kayit_gun: number
  izin_gun: Record<string, number>; haftalik: { hafta: string; dk: number; fazla_dk: number }[]; haftalik_fazla_dk: number
}
export type PuantajSatiri = { personel: PersonelK; vardiya: Vardiya | null; gunler: GunKaydi[]; ozet: PersonelOzet }

const TZ_MS = 3 * 3600 * 1000
const yerelDk = (iso: string) => Math.floor((Date.parse(iso) + TZ_MS) / 60000)
const dkToTarih = (dk: number) => new Date(dk * 60000).toISOString().slice(0, 10)          // yerel dakika (UTC-gibi işlenir) → YYYY-MM-DD
const gunNo = (tarih: string) => Math.floor(Date.parse(tarih + 'T00:00:00Z') / 86400000)
const gunNoTarih = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)
export const saatDk = (s: string) => { const [h, m] = s.split(':'); return (+h) * 60 + (+m || 0) }
export const dkSaat = (dk: number) => `${String(Math.floor(dk / 60) % 24).padStart(2, '0')}:${String(dk % 60).padStart(2, '0')}`
const haftaGunu = (tarih: string) => new Date(tarih + 'T00:00:00Z').getUTCDay() // 0 = Pazar
const pazartesi = (tarih: string) => { const g = haftaGunu(tarih); return gunNoTarih(gunNo(tarih) - ((g + 6) % 7)) }

const ON_DK = 240      // vardiya başlangıcından ne kadar önceki girişler o vardiyaya sayılır
const SON_DK = 480     // vardiya bitişinden ne kadar sonraki çıkışlar o vardiyaya sayılır

function vardiyaAralik(v: Vardiya | null, gn: number) {
  if (!v) return null
  const bas = saatDk(v.baslangic); let bit = saatDk(v.bitis); if (bit <= bas) bit += 1440 // gece yarısını aşan vardiya
  const sure = bit - bas
  const on = ON_DK, son = Math.min(SON_DK, Math.max(0, 1439 - sure - on))
  return { start: gn * 1440 + bas, end: gn * 1440 + bit, wStart: gn * 1440 + bas - on, wEnd: gn * 1440 + bit + son, sure }
}

/** Bir hareketi hangi vardiya gününe ait olduğuna göre atar (gece vardiyaları için önceki/sonraki gün penceresi). */
export function vardiyaGunuAta(v: Vardiya | null, zaman: string): number {
  const m = yerelDk(zaman), takvim = Math.floor(m / 1440)
  if (!v) return takvim
  let en: { gn: number; d: number } | null = null
  for (const gn of [takvim - 1, takvim, takvim + 1]) {
    const a = vardiyaAralik(v, gn)!
    if (m >= a.wStart && m <= a.wEnd) { const d = Math.abs(m - a.start); if (!en || d < en.d) en = { gn, d } }
  }
  return en ? en.gn : takvim
}

export function hesaplaPuantaj(p: { personeller: PersonelK[]; vardiyalar: Vardiya[]; hareketler: Hareket[]; izinler: Izin[]; tatiller: Tatil[]; ayar: Ayar; bas: string; bit: string; simdi?: Date }): PuantajSatiri[] {
  const simdi = p.simdi || new Date()
  const simdiDk = yerelDk(simdi.toISOString()), bugun = dkToTarih(simdiDk)
  const vMap = new Map(p.vardiyalar.map(v => [v.id, v]))
  const tatilMap = new Map(p.tatiller.map(t => [t.tarih, t]))
  const hareketMap = new Map<string, Hareket[]>(); for (const h of p.hareketler) { (hareketMap.get(h.personel_id) || hareketMap.set(h.personel_id, []).get(h.personel_id)!).push(h) }
  const izinMap = new Map<string, Izin[]>(); for (const i of p.izinler) { (izinMap.get(i.personel_id) || izinMap.set(i.personel_id, []).get(i.personel_id)!).push(i) }
  const g0 = gunNo(p.bas), g1 = gunNo(p.bit)
  const haftalikNormalDk = (p.ayar.haftalik_normal_saat || 45) * 60

  return p.personeller.map(per => {
    const v = per.vardiya_id ? vMap.get(per.vardiya_id) || null : null
    const olaylar = (hareketMap.get(per.id) || []).slice().sort((a, b) => Date.parse(a.zaman) - Date.parse(b.zaman))
    const gunOlay = new Map<number, Hareket[]>(); for (const h of olaylar) { const gn = vardiyaGunuAta(v, h.zaman); (gunOlay.get(gn) || gunOlay.set(gn, []).get(gn)!).push(h) }
    const izinler = izinMap.get(per.id) || []
    const normalNet = v ? Math.max(0, vardiyaAralik(v, 0)!.sure - v.mola_dk) : 480
    const gunler: GunKaydi[] = []

    for (let gn = g0; gn <= g1; gn++) {
      const tarih = gunNoTarih(gn)
      const k: GunKaydi = { tarih, durum: 'calisti', giris: null, cikis: null, calisilan_dk: 0, gec_dk: 0, erken_cikis_dk: 0, fazla_mesai_dk: 0, tatil_calisma_dk: 0, uyarilar: [] }
      if ((per.ise_giris && tarih < per.ise_giris) || (per.isten_cikis && tarih > per.isten_cikis)) { k.durum = 'kapsam_disi'; gunler.push(k); continue }

      const ol = gunOlay.get(gn) || []
      // Aralık hesabı: giriş → çıkış çiftleri
      let acik: Hareket | null = null; let brut = 0, aralikSayisi = 0, ilkGiris: string | null = null, sonCikis: string | null = null
      for (const h of ol) {
        if (h.yon === 'giris') { if (!acik) { acik = h; if (!ilkGiris) ilkGiris = h.zaman } else k.uyarilar.push('Çift giriş kaydı') }
        else { if (acik) { brut += Math.max(0, yerelDk(h.zaman) - yerelDk(acik.zaman)); aralikSayisi++; sonCikis = h.zaman; acik = null } else k.uyarilar.push('Girişsiz çıkış kaydı') }
      }
      k.giris = ilkGiris; k.cikis = sonCikis
      const aralik = vardiyaAralik(v, gn)
      // Mola düşümü: tek aralıkla çalışıldıysa planlı mola düşülür; öğle çıkışı okutulduysa mola zaten dışarıda kalmıştır
      const net = brut - (v && aralikSayisi === 1 && brut >= 240 ? v.mola_dk : 0)
      k.calisilan_dk = Math.max(0, net)

      const tatil = tatilMap.get(tarih)
      const izin = izinler.find(i => tarih >= i.baslangic && tarih <= i.bitis)
      const hg = haftaGunu(tarih)
      const calismaGunu = p.ayar.calisma_gunleri.includes(hg) && hg !== p.ayar.hafta_tatili
      const gelecek = tarih > bugun

      if (tatil && !tatil.yarim_gun) { k.durum = ol.length ? 'tatilde_calisti' : 'tatil'; k.tatil_ad = tatil.ad; if (ol.length) k.tatil_calisma_dk = k.calisilan_dk }
      else if (izin) { k.durum = 'izinli'; k.izin_tur = izin.tur; if (ol.length) k.uyarilar.push('İzinli günde giriş/çıkış kaydı var') }
      else if (!calismaGunu) { k.durum = ol.length ? 'tatilde_calisti' : 'hafta_tatili'; if (ol.length) k.tatil_calisma_dk = k.calisilan_dk }
      else if (gelecek) { k.durum = 'gelecek' }
      else {
        const yarim = !!(tatil && tatil.yarim_gun); if (yarim) k.tatil_ad = tatil!.ad
        if (!ol.length) {
          const bugunSurer = tarih === bugun
          if (yarim) k.durum = 'yarim_tatil'
          else if (bugunSurer && !aralik) k.durum = 'gelmedi'
          else if (bugunSurer && aralik && simdiDk < aralik.start + (v?.gec_tolerans_dk || 0)) k.durum = 'gelmedi'
          else if (bugunSurer && aralik && simdiDk <= aralik.wEnd) k.durum = 'gelmedi'
          else k.durum = 'devamsiz'
        } else if (acik) {
          const suruyor = !!aralik && simdiDk <= aralik.wEnd && tarih >= bugun.slice(0, 10) && simdiDk - yerelDk(acik.zaman) < (p.ayar.unutulan_cikis_saat || 16) * 60
          k.durum = suruyor ? 'icerde' : 'eksik'
          if (!suruyor) k.uyarilar.push('Çıkış kaydı yok')
        } else k.durum = 'calisti'

        if (aralik && ilkGiris && (k.durum === 'calisti' || k.durum === 'eksik' || k.durum === 'icerde')) {
          const gec = yerelDk(ilkGiris) - aralik.start
          if (gec > v!.gec_tolerans_dk) k.gec_dk = gec
          if (sonCikis && !acik) { const erken = aralik.end - yerelDk(sonCikis); if (erken > v!.gec_tolerans_dk) k.erken_cikis_dk = erken }
        }
        if (k.durum === 'calisti') {
          const hedef = yarim ? Math.round(normalNet / 2) : normalNet
          const fazla = k.calisilan_dk - hedef
          if (!yarim && fazla >= (v?.fazla_mesai_esik_dk ?? 30)) k.fazla_mesai_dk = fazla
        }
      }
      gunler.push(k)
    }

    // Özet
    const ozet: PersonelOzet = { calisilan_gun: 0, calisilan_dk: 0, fazla_mesai_dk: 0, tatil_calisma_dk: 0, gec_gun: 0, gec_dk: 0, erken_cikis_dk: 0, devamsiz_gun: 0, eksik_kayit_gun: 0, izin_gun: {}, haftalik: [], haftalik_fazla_dk: 0 }
    const hafta = new Map<string, number>()
    for (const k of gunler) {
      if (k.durum === 'calisti' || k.durum === 'eksik' || k.durum === 'icerde' || k.durum === 'tatilde_calisti') { if (k.calisilan_dk > 0 || k.durum === 'calisti') ozet.calisilan_gun++ }
      ozet.calisilan_dk += k.calisilan_dk; ozet.fazla_mesai_dk += k.fazla_mesai_dk; ozet.tatil_calisma_dk += k.tatil_calisma_dk
      if (k.gec_dk) { ozet.gec_gun++; ozet.gec_dk += k.gec_dk }
      ozet.erken_cikis_dk += k.erken_cikis_dk
      if (k.durum === 'devamsiz') ozet.devamsiz_gun++
      if (k.durum === 'eksik') ozet.eksik_kayit_gun++
      if (k.durum === 'izinli' && k.izin_tur) ozet.izin_gun[k.izin_tur] = (ozet.izin_gun[k.izin_tur] || 0) + 1
      if (k.calisilan_dk) { const w = pazartesi(k.tarih); hafta.set(w, (hafta.get(w) || 0) + k.calisilan_dk) }
    }
    for (const [w, dk] of Array.from(hafta.entries()).sort()) { const f = Math.max(0, dk - haftalikNormalDk); ozet.haftalik.push({ hafta: w, dk, fazla_dk: f }); ozet.haftalik_fazla_dk += f }
    return { personel: per, vardiya: v, gunler, ozet }
  })
}
