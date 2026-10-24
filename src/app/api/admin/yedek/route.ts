import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { istemciIp } from '@/lib/rate-limit'
import { yoneticiOlayi } from '@/lib/olay'
import vercelJson from '../../../../../vercel.json'

// Tam veri yedeği (taşıma için): yalnızca TAM YETKİLİ (*) yönetici. Tüm public tabloları sayfa sayfa,
// kullanıcı listesini ve depolama dosyalarını (imzalı bağlantılarla) döner. Service-role anahtarı istemciye gitmez.
// Tablo adları her istekte veritabanının kendi şema listesiyle doğrulanır; rastgele tabloya erişim verilmez.
export const maxDuration = 60

const SAYFA = 1000
const MAX_BAYT = 3_500_000 // Vercel yanıt sınırının (4,5 MB) altında kalmak için bir sayfanın en fazla boyutu

// OpenAPI şeması okunamazsa kullanılan yedek liste (public şemadaki tablolar)
const YEDEK_TABLOLAR = [
  'products', 'settings', 'contact_submissions', 'categories', 'admin_profiles', 'site_visits', 'redirects', 'product_variants',
  'content_blocks', 'notification_settings', 'admin_activity', 'cari_hesaplar', 'faturalar', 'fatura_kalemleri', 'islemler',
  'muhasebe_kategoriler', 'kasa_banka_hesaplari', 'cek_senet', 'roller', 'depolar', 'hammaddeler', 'hammadde_lotlari',
  'stok_hareketleri', 'makineler', 'kaliplar', 'kalip_bakim_kayitlari', 'urun_receteleri', 'recete_kalemleri', 'satis_siparisleri',
  'satis_siparisi_kalemleri', 'satinalma_siparisleri', 'satinalma_siparisi_kalemleri', 'uretim_emirleri', 'uretim_hareketleri',
  'sevkiyatlar', 'ihracat_detaylari', 'kalite_kontrol_kayitlari', 'fire_kayitlari', 'fiyat_listeleri', 'fiyat_listesi_kalemleri',
  'iskonto_kademeleri', 'banka_ekstre_kayitlari', 'rate_limit_kayitlari', 'site_visits_gunluk', 'muhasebe_mevzuat',
  'muhasebe_ai_sohbetleri', 'vardiyalar', 'personel', 'personel_hareketleri', 'personel_izinleri', 'resmi_tatiller', 'personel_kiosklari',
  'personel_ayarlari', 'sosyal_gonderiler', 'satinalma_talepleri', 'satinalma_teklifleri', 'ihracat_evraklari', 'teklifler',
  'teklif_kalemleri', 'satinalma_talep_kalemleri', 'satinalma_teklif_fiyatlari', 'satinalma_ret_kayitlari', 'gelenveriler',
  'doviz_kurlari', 'ai_ses_oturumlari', 'bordro_parametreleri', 'bordro_maas_bilgileri', 'bordro_donemleri', 'bordro_kalemleri',
  'personel_odemeleri', 'cari_eski_hareketler', 'ai_hafiza', 'mevzuat_haberleri', 'mevzuat_tarama', 'kira_plani', 'ihracat_gecmis',
  'kdv_iade_hareket', 'kredi_karti_satislari', 'pos_tahsilat', 'fuar', 'fuar_odeme', 'ai_excel', 'satis_adetleri', 'satis_cari',
  'gramaj_ek', 'cari_ibanlar',
]

// Sistemin çalışması için gereken ortam değişkenleri — yalnızca AD ve "tanımlı mı" bilgisi döner, değerler asla dönmez
const ENV_ADLARI = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'FIELD_ENCRYPTION_KEY', 'CRON_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
  'N8N_WHATSAPP_WEBHOOK_URL', 'N8N_WEBHOOK_SECRET', 'N8N_LEAD_API_TOKEN', 'N8N_SOSYAL_API_TOKEN', 'N8N_SOSYAL_WEBHOOK_URL', 'N8N_SOSYAL_WEBHOOK_SECRET',
  'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'OPENAI_MODEL_GORSEL', 'OPENAI_IMAGE_MODEL',
  'OPENAI_REALTIME_MODEL', 'OPENAI_REALTIME_MODEL_YUKSEK', 'OPENAI_REALTIME_VOICE',
]

type Meta = { ad: string; pk: string[] }

async function yetkili() {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { hata: NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 }) }
  const { data: profile } = await sb.from('admin_profiles').select('role_id').eq('id', user.id).single()
  const { data: role } = profile?.role_id ? await sb.from('roller').select('moduller').eq('id', profile.role_id).single() : { data: null }
  if (!((role?.moduller || []) as string[]).includes('*')) return { hata: NextResponse.json({ error: 'Veri yedeği için tam yetki gerekir' }, { status: 403 }) }
  return { user, admin: createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
}

// PostgREST kök adresi şemayı (tablolar + birincil anahtarlar) OpenAPI olarak verir — tablo listesi buradan dinamik alınır
async function tabloMeta(): Promise<Meta[]> {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' })
    if (r.ok) {
      const j: any = await r.json()
      const defs = j.definitions || j.components?.schemas
      if (defs && typeof defs === 'object') {
        const out: Meta[] = []
        for (const [ad, d] of Object.entries<any>(defs)) {
          if (ad.startsWith('v_') || ad.startsWith('rpc_')) continue // görünümler (v_*) başka tablolardan türetilir; yedeğe gerek yok
          const props = d?.properties || {}
          const pk = Object.keys(props).filter(k => String(props[k]?.description || '').includes('<pk/>'))
          out.push({ ad, pk })
        }
        if (out.length) return out.sort((a, b) => a.ad.localeCompare(b.ad))
      }
    }
  } catch { /* yedek listeye düş */ }
  return YEDEK_TABLOLAR.map(ad => ({ ad, pk: [] })).sort((a, b) => a.ad.localeCompare(b.ad))
}

async function kovaDosyalari(admin: any, kova: string, onek = '', out: { yol: string; boyut: number | null }[] = []) {
  for (let off = 0; ; off += 1000) {
    const { data, error } = await admin.storage.from(kova).list(onek, { limit: 1000, offset: off, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`${kova}: ${error.message}`)
    if (!data?.length) break
    for (const o of data) {
      const yol = onek ? `${onek}/${o.name}` : o.name
      if (o.id === null) await kovaDosyalari(admin, kova, yol, out) // klasör
      else out.push({ yol, boyut: o.metadata?.size ?? null })
      if (out.length > 20000) return out
    }
    if (data.length < 1000) break
  }
  return out
}

export async function GET(req: NextRequest) {
  const y = await yetkili(); if (y.hata) return y.hata
  const { admin } = y as any
  const sp = new URL(req.url).searchParams
  const islem = sp.get('islem')

  try {
    if (islem === 'liste') {
      const meta = await tabloMeta()
      const tablolar: { ad: string; satir: number | null; hata?: string }[] = []
      for (let i = 0; i < meta.length; i += 8) {
        await Promise.all(meta.slice(i, i + 8).map(async m => {
          const { count, error } = await admin.from(m.ad).select('*', { count: 'exact', head: true })
          tablolar.push({ ad: m.ad, satir: error ? null : count ?? 0, ...(error ? { hata: error.message } : {}) })
        }))
      }
      tablolar.sort((a, b) => a.ad.localeCompare(b.ad))
      const { data: kovalar } = await admin.storage.listBuckets()
      return NextResponse.json({ tablolar, kovalar: (kovalar || []).map((k: any) => ({ ad: k.name, acik: !!k.public })) })
    }

    if (islem === 'tablo') {
      const ad = sp.get('ad') || ''
      const m = (await tabloMeta()).find(x => x.ad === ad)
      if (!m) return NextResponse.json({ error: 'Geçersiz tablo' }, { status: 400 })
      const bas = Math.max(0, Math.floor(Number(sp.get('bas')) || 0))
      const sorgu = (sirala: boolean) => {
        let q = admin.from(ad).select('*').range(bas, bas + SAYFA - 1)
        if (sirala) for (const c of (m.pk.length ? m.pk : ['id'])) q = q.order(c, { ascending: true })
        return q
      }
      let { data, error } = await sorgu(true)
      if (error) ({ data, error } = await sorgu(false)) // sıralanacak kolon yoksa sırasız dene
      if (error) return NextResponse.json({ error: `${ad}: ${error.message}` }, { status: 500 })
      const rows: any[] = data || []
      let boyut = 0, n = 0
      for (const r of rows) { const b = JSON.stringify(r).length; if (n > 0 && boyut + b > MAX_BAYT) break; boyut += b; n++ }
      return NextResponse.json({ rows: rows.slice(0, n), sonraki: bas + n, bitti: n === rows.length && rows.length < SAYFA })
    }

    if (islem === 'kullanicilar') {
      const list: any[] = []
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
        if (error) throw new Error(error.message)
        list.push(...data.users)
        if (data.users.length < 200) break
      }
      return NextResponse.json({
        kullanicilar: list.map((u: any) => ({
          id: u.id, email: u.email, phone: u.phone || null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at, banned_until: u.banned_until || null,
          app_metadata: u.app_metadata, user_metadata: u.user_metadata,
        })),
      })
    }

    if (islem === 'sema') {
      // Veritabanı yapısı: public.yedek_sema_olustur() (supabase/yedek_sema_fonksiyonu.sql) okuyup SQL metni üretir
      const { data, error } = await admin.rpc('yedek_sema_olustur')
      if (error) throw new Error(`Şema üretilemedi: ${error.message} — supabase/yedek_sema_fonksiyonu.sql dosyasının veritabanında kurulu olması gerekir`)
      return NextResponse.json({ sql: data })
    }

    if (islem === 'sistem') {
      let supabaseRef: string | null = null
      try { supabaseRef = new URL(process.env.SUPABASE_URL || '').hostname.split('.')[0] } catch { /* yok */ }
      return NextResponse.json({
        zaman: new Date().toISOString(),
        env: ENV_ADLARI.map(ad => ({ ad, tanimli: !!process.env[ad] })),
        supabase: { url: process.env.SUPABASE_URL || null, proje: supabaseRef },
        vercel: {
          ortam: process.env.VERCEL_ENV || null, bolge: process.env.VERCEL_REGION || null,
          repo: process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : null,
          dal: process.env.VERCEL_GIT_COMMIT_REF || null, commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
        },
        zamanlanmisGorevler: (vercelJson as any).crons || [],
      })
    }

    if (islem === 'dosyalar') {
      const { data: kovalar, error } = await admin.storage.listBuckets()
      if (error) throw new Error(error.message)
      const out: { kova: string; yol: string; boyut: number | null; url: string | null }[] = []
      for (const k of kovalar || []) {
        const dosyalar = await kovaDosyalari(admin, k.name)
        for (let i = 0; i < dosyalar.length; i += 100) {
          const grup = dosyalar.slice(i, i + 100)
          const { data: imzali } = await admin.storage.from(k.name).createSignedUrls(grup.map(d => d.yol), 3600)
          grup.forEach((d, j) => out.push({ kova: k.name, yol: d.yol, boyut: d.boyut, url: imzali?.[j]?.signedUrl || null }))
        }
      }
      return NextResponse.json({ dosyalar: out })
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Yedek alınamadı' }, { status: 500 })
  }
}

// Yedek indirme başlarken yöneticilere güvenlik bildirimi gider (tüm verinin dışarı alındığından haberdar olunması için)
export async function POST(req: NextRequest) {
  const y = await yetkili(); if (y.hata) return y.hata
  const { user } = y as any
  const body = await req.json().catch(() => ({}))
  if (body?.islem !== 'basla') return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
  await yoneticiOlayi(user.email || user.id, 'yedek_alindi', body?.dosyalar ? 'Veri + dosyalar' : 'Yalnızca veri', istemciIp(req))
  return NextResponse.json({ ok: true })
}
