import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { istemciIp } from '@/lib/rate-limit'
import { yoneticiOlayi } from '@/lib/olay'

// GERİ DÖNÜŞÜ OLMAYAN işlem: veritabanı yapısını (tablolar dahil), depolama dosyalarını/kovalarını, tüm giriş hesaplarını
// ve (GITHUB_TOKEN tanımlıysa) GitHub deposunu siler.
// Yalnızca TAM YETKİLİ (*) yönetici; sunucu tarafında "imha et" yazılı onayı da aranır.
export const maxDuration = 60

const ONAY = 'imha et'
const ONAY_VERI = 'verileri sil'
const KORUNAN = new Set(['admin_profiles', 'roller']) // girişi kilitlememek için

async function yetkili() {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { hata: NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 }) }
  const { data: profile } = await sb.from('admin_profiles').select('role_id').eq('id', user.id).single()
  const { data: role } = profile?.role_id ? await sb.from('roller').select('moduller').eq('id', profile.role_id).single() : { data: null }
  if (!((role?.moduller || []) as string[]).includes('*')) return { hata: NextResponse.json({ error: 'Bu işlem için tam yetki gerekir' }, { status: 403 }) }
  return { user, admin: createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }
}


// OpenAPI şemasından tablo + birincil anahtar listesi (görünümler hariç)
async function tabloListesi(): Promise<{ ad: string; sutun: string }[]> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' })
  const j: any = await r.json()
  const defs = j.definitions || j.components?.schemas || {}
  const out: { ad: string; sutun: string }[] = []
  for (const [ad, d] of Object.entries<any>(defs)) {
    if (ad.startsWith('v_') || ad.startsWith('rpc_')) continue // görünümler silinemez
    const props = d?.properties || {}
    const pk = Object.keys(props).find(k => String(props[k]?.description || '').includes('<pk/>')) || Object.keys(props)[0]
    if (pk) out.push({ ad, sutun: pk })
  }
  return out
}

// Yabancı anahtar sırası bilinmediği için birkaç tur dener; her turda silinebilenler silinir
async function tablolariBosalt(admin: any, koru: Set<string> = new Set()) {
  let liste = (await tabloListesi()).filter(t => !koru.has(t.ad))
  const gorulen = new Set<string>()
  for (let tur = 0; tur < 10 && liste.length; tur++) {
    const kalan: typeof liste = []
    for (const t of liste) {
      const { error } = await admin.from(t.ad).delete().not(t.sutun, 'is', null)
      if (error) { kalan.push(t); continue }
      const { count } = await admin.from(t.ad).select('*', { count: 'exact', head: true })
      if (count) kalan.push(t); else gorulen.add(t.ad)
    }
    liste = kalan
  }
  return { tablo: gorulen.size, kalan: liste.map(t => t.ad) }
}

async function kovaYollari(admin: any, kova: string, onek = '', out: string[] = []) {
  for (let off = 0; ; off += 1000) {
    const { data, error } = await admin.storage.from(kova).list(onek, { limit: 1000, offset: off })
    if (error) throw new Error(`${kova}: ${error.message}`)
    if (!data?.length) break
    for (const o of data) {
      const yol = onek ? `${onek}/${o.name}` : o.name
      if (o.id === null) await kovaYollari(admin, kova, yol, out)
      else out.push(yol)
    }
    if (data.length < 1000) break
  }
  return out
}

export async function POST(req: NextRequest) {
  const y = await yetkili(); if (y.hata) return y.hata
  const { user, admin } = y as any
  const body = await req.json().catch(() => ({}))
  const sadeceVeri = body?.kapsam === 'veri'
  const gerekli = sadeceVeri ? ONAY_VERI : ONAY
  if (String(body?.onay || '').trim().toLocaleLowerCase('tr-TR') !== gerekli)
    return NextResponse.json({ error: `Onay için "${gerekli}" yazılmalı` }, { status: 400 })

  // Yalnızca tablo verileri: giriş yetkisi (admin_profiles, roller) korunur ki panele girmeye devam edilebilsin.
  // Dosyalara, hesaplara, tablo yapısına ve GitHub'a dokunulmaz.
  if (sadeceVeri) {
    try {
      await yoneticiOlayi(user.email || user.id, 'veriler_silindi', 'Tüm tablo verileri silindi', istemciIp(req)).catch(() => {})
      const bos = await tablolariBosalt(admin, KORUNAN)
      if (bos.kalan.length) return NextResponse.json({ ok: false, tablo: bos.tablo, hatalar: [`Boşaltılamayan tablolar: ${bos.kalan.join(', ')}`] }, { status: 207 })
      return NextResponse.json({ ok: true, tablo: bos.tablo, hatalar: [] })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Veriler silinemedi' }, { status: 500 })
    }
  }

  const sonuc: any = { tablo: 0, dosya: 0, kullanici: 0, github: false, yapiKaldi: false, hatalar: [] as string[] }
  try {
    // Önce bildirim (bildirim ayarları tablolarla birlikte silineceği için en başta)
    await yoneticiOlayi(user.email || user.id, 'sistem_imha_edildi', 'Veritabanı, dosyalar, hesaplar ve GitHub deposu silindi', istemciIp(req)).catch(() => {})

    // 1) Veritabanı yapısı + veriler
    const { data: n, error: e1 } = await admin.rpc('imha_verileri')
    if (e1) {
      // Veritabanı fonksiyonu yoksa: tabloları panelin kendi silme yoluyla (service-role) tek tek boşalt. Yapı (boş tablolar) kalır.
      const bos = await tablolariBosalt(admin)
      if (bos.kalan.length) {
        return NextResponse.json({ error: `Tablolar tamamen boşaltılamadı, dosya ve hesaplara dokunulmadı: ${bos.kalan.join(', ')}` }, { status: 500 })
      }
      sonuc.tablo = bos.tablo
      sonuc.yapiKaldi = true
    } else sonuc.tablo = Number(n) || 0


    // 2) Depolama dosyaları ve kovalar
    const { data: kovalar } = await admin.storage.listBuckets()
    for (const k of kovalar || []) {
      try {
        const yollar = await kovaYollari(admin, k.name)
        for (let i = 0; i < yollar.length; i += 100) {
          const { error } = await admin.storage.from(k.name).remove(yollar.slice(i, i + 100))
          if (error) sonuc.hatalar.push(`${k.name}: ${error.message}`)
          else sonuc.dosya += Math.min(100, yollar.length - i)
        }
        const { error: kerr } = await admin.storage.deleteBucket(k.name)
        if (kerr) sonuc.hatalar.push(`${k.name} kovası: ${kerr.message}`)
      } catch (e: any) { sonuc.hatalar.push(e?.message || `${k.name} silinemedi`) }
    }

    // 3) Giriş hesapları — işlemi yapan en son silinir
    const idler: string[] = []
    for (let sayfa = 1; ; sayfa++) {
      const { data, error } = await admin.auth.admin.listUsers({ page: sayfa, perPage: 200 })
      if (error) { sonuc.hatalar.push(`Kullanıcı listesi: ${error.message}`); break }
      const u = data?.users || []
      idler.push(...u.map((x: any) => x.id))
      if (u.length < 200) break
    }
    for (const id of [...idler.filter(i => i !== user.id), ...idler.filter(i => i === user.id)]) {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) sonuc.hatalar.push(`Kullanıcı ${id}: ${error.message}`)
      else sonuc.kullanici++
    }

    // 4) GitHub deposu — en son (Vercel ortam değişkeni GITHUB_TOKEN: repo silme yetkili)
    const repo = process.env.GITHUB_REPO || 'plastikalya5-ai/alyatest'
    const gh = process.env.GITHUB_TOKEN
    if (!gh) sonuc.hatalar.push('GitHub deposu silinmedi: Vercel’de GITHUB_TOKEN tanımlı değil')
    else {
      const r = await fetch(`https://api.github.com/repos/${repo}`, { method: 'DELETE', headers: { Authorization: `Bearer ${gh}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
      if (r.status === 204) sonuc.github = true
      else sonuc.hatalar.push(`GitHub deposu silinemedi (${r.status}): ${(await r.text().catch(() => '')).slice(0, 160)}`)
    }
  } catch (e: any) {
    sonuc.hatalar.push(e?.message || 'Beklenmeyen hata')
  }
  return NextResponse.json({ ok: sonuc.hatalar.length === 0, ...sonuc }, { status: sonuc.hatalar.length ? 207 : 200 })
}
