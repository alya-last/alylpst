export const DURUM: Record<string, { l: string; tone: any }> = {
  calisti: { l: 'Çalıştı', tone: 'green' }, icerde: { l: 'İçeride', tone: 'blue' }, eksik: { l: 'Çıkış kaydı yok', tone: 'amber' },
  devamsiz: { l: 'Devamsız', tone: 'red' }, gelmedi: { l: 'Henüz gelmedi', tone: 'muted' }, izinli: { l: 'İzinli', tone: 'blue' },
  tatil: { l: 'Resmî tatil', tone: 'muted' }, yarim_tatil: { l: 'Yarım gün tatil', tone: 'muted' }, hafta_tatili: { l: 'Hafta tatili', tone: 'muted' },
  tatilde_calisti: { l: 'Tatilde çalıştı', tone: 'ac' }, kapsam_disi: { l: '—', tone: 'muted' }, gelecek: { l: '', tone: 'muted' },
}
export const IZIN_TUR: Record<string, string> = { yillik: 'Yıllık izin', mazeret: 'Mazeret izni', rapor: 'Rapor', ucretsiz: 'Ücretsiz izin', idari: 'İdari izin' }
export const GUNLER = [{ v: 1, l: 'Pzt' }, { v: 2, l: 'Sal' }, { v: 3, l: 'Çar' }, { v: 4, l: 'Per' }, { v: 5, l: 'Cum' }, { v: 6, l: 'Cmt' }, { v: 0, l: 'Paz' }]
export const hm = (dk: number) => `${Math.floor(dk / 60)}:${String(dk % 60).padStart(2, '0')}`
export const saatTR = (iso: string | null | undefined) => iso ? new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(11, 16) : '—'
export const tarihTR = (t: string) => t ? t.split('-').reverse().join('.') : ''
export const bugunTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
export const hhmm = (t: string | null | undefined) => (t || '').slice(0, 5)

/** İzin gün sayısı: çalışma günlerinden hafta tatili ve resmî tatiller çıkarılır. */
export function izinGunu(bas: string, bit: string, calisma: number[], tatiller: { tarih: string; yarim_gun?: boolean }[]) {
  const tset = new Set(tatiller.filter(t => !t.yarim_gun).map(t => t.tarih)); let n = 0
  for (let t = Date.parse(bas + 'T00:00:00Z'); t <= Date.parse(bit + 'T00:00:00Z'); t += 86400000) {
    const d = new Date(t), iso = d.toISOString().slice(0, 10)
    if (calisma.includes(d.getUTCDay()) && !tset.has(iso)) n++
  }
  return n
}
