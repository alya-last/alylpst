import type { SupabaseClient } from '@supabase/supabase-js'

/** Yönetici onaylı düzeltmeleri yapay zekanın sistem mesajına eklenecek metne çevirir (yoksa boş). */
export async function hafizaBlogu(sb: SupabaseClient): Promise<string> {
  try {
    const r: any = await sb.from('ai_hafiza').select('soru,dogru_cevap').eq('durum', 'aktif').order('updated_at', { ascending: false }).limit(40)
    const l: { soru: string; dogru_cevap: string }[] = r?.data || []
    if (!l.length) return ''
    const t = (s: string, n: number) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)
    return `\n\nALYA HAFIZASI (yönetici onaylı düzeltmeler; benzer soruda bu yönlendirmeye uy. Buradaki rakamlar eski olabilir: güncel rakamı HER ZAMAN araçtan al, hafızadan alma):\n${l.map(x => `- Soru: "${t(x.soru, 200)}" → Doğru yaklaşım: ${t(x.dogru_cevap, 1500)}`).join('\n')}`
  } catch { return '' }
}
