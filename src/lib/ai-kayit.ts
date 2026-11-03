import type { SupabaseClient } from '@supabase/supabase-js'

/** Soru + cevabı kullanıcının kendi oturumuyla (RLS) kaydeder; hata cevabı asla bozmaz. */
export async function soruKaydet(sb: SupabaseClient, k: { kanal: 'yazili' | 'muhasebe' | 'sesli'; soru: string; yanit: string; araclar?: string[]; dogrulanamayan?: string[] }): Promise<string | null> {
  try {
    const { data } = await sb.from('ai_soru_kayit').insert({
      kanal: k.kanal, soru: k.soru.slice(0, 2000), yanit: k.yanit.slice(0, 8000),
      araclar: (k.araclar || []).slice(0, 30), hazir_rapor: !(k.araclar || []).length,
      dogrulanamayan: k.dogrulanamayan || [],
    }).select('id').single()
    return data?.id ?? null
  } catch { return null }
}
