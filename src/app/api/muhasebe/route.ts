import { NextRequest, NextResponse, after } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { applyQuery } from '@/lib/proxy-query'
import { encryptField, decryptField } from '@/lib/field-crypto'

// Muhasebe modülüne ait tablolar — sadece bunlara erişilebilir.
// Gerçek yetki kontrolü RLS (private.has_module) tarafından yapılır; bu allowlist ek bir savunma katmanı.
const TABLES = new Set([
  'cari_hesaplar','faturalar','fatura_kalemleri','islemler','muhasebe_kategoriler',
  'kasa_banka_hesaplari','doviz_kurlari','cek_senet','product_variants','products',
])

// Salt-okunur görünümler — sadece GET (yetki alttaki tabloların RLS'inden gelir)
const READONLY_VIEWS = new Set(['v_cari_ozet','v_islemler_liste','v_kasa_hareket','v_faturalar_liste','cari_eski_hareketler'])

// Alan-seviyesi şifrelenecek hassas kimlik alanları (tablo -> kolonlar)
const ENCRYPTED_FIELDS: Record<string,string[]> = {
  cari_hesaplar: ['vergi_no'],
}

function decryptRow(table:string, row:any) {
  const fields = ENCRYPTED_FIELDS[table]
  if (!fields || !row) return row
  const out = {...row}
  for (const f of fields) if (out[f] != null) out[f] = decryptField(out[f])
  return out
}
function encryptPayload(table:string, payload:any) {
  const fields = ENCRYPTED_FIELDS[table]
  if (!fields) return payload
  const out = {...payload}
  for (const f of fields) if (out[f] != null) out[f] = encryptField(out[f])
  return out
}

async function requireSession() {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  return { sb, user }
}

export async function GET(req: NextRequest) {
  const { sb, user } = await requireSession()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const table = sp.get('table') || ''
  const select = sp.get('select') || '*'
  const count = sp.get('count')
  if (!table || !(TABLES.has(table) || READONLY_VIEWS.has(table)))
    return NextResponse.json({ error: 'Geçersiz tablo' }, { status: 400 })

  const tot = sp.get('total')
  let q: any = sb.from(table).select(select, count==='true' ? { count: 'exact', head: true } : tot ? { count: tot === 'estimated' ? 'estimated' : 'exact' } : undefined)
  q = applyQuery(q, sp)
  const { data, error, count:cnt } = await q
  if (error) return NextResponse.json({error:error.message},{status:500})
  const decrypted = Array.isArray(data) ? data.map((row:any)=>decryptRow(table,row)) : data
  return NextResponse.json({ data: decrypted, count: cnt })
}

export async function POST(req: NextRequest) {
  const { sb, user } = await requireSession()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })

  const body = await req.json()
  if (body.rpc) {
    if (!/^rpc_[a-z_]+$/.test(body.rpc)) return NextResponse.json({ error: 'Geçersiz fonksiyon' }, { status: 400 })
    const r = await sb.rpc(body.rpc, body.args || {})
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
    return NextResponse.json({ data: r.data })
  }
  const { table, op, data, id } = body
  if (!table || !TABLES.has(table))
    return NextResponse.json({ error: 'Geçersiz tablo' }, { status: 400 })
  if ((op === 'update' || op === 'delete') && !id)
    return NextResponse.json({ error: 'Kayıt id gerekli' }, { status: 400 })

  let r: any
  if (op === 'insert') {
    const enc = Array.isArray(data) ? data.map((d:any)=>encryptPayload(table,d)) : encryptPayload(table,data)
    const payload = Array.isArray(enc) ? enc.map(d=>({...d, created_by:user.id})) : { ...enc, created_by: user.id }
    r = await sb.from(table).insert(payload).select()
  } else if (op === 'update') {
    const enc = encryptPayload(table, data)
    r = await sb.from(table).update({ ...enc, updated_by: user.id }).eq('id', id).select()
  } else if (op === 'delete') {
    r = await sb.from(table).delete().eq('id', id)
  } else if (op === 'upsert') {
    const enc = Array.isArray(data) ? data.map((d:any)=>encryptPayload(table,d)) : encryptPayload(table,data)
    const payload = Array.isArray(enc) ? enc.map(d=>({...d, created_by:user.id})) : { ...enc, created_by: user.id }
    r = await sb.from(table).upsert(payload).select()
  } else {
    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
  }
  if (r?.error) return NextResponse.json({ error: r.error.message }, { status: 500 })

  const recordId = id || r?.data?.[0]?.id
  // Kullanıcıyı bekletmeden yanıt dönülür; log kaydı after() ile yanıttan SONRA yazılır
  // (Vercel'de waitUntil ile fonksiyon log bitene kadar canlı tutulur, log hatası ana işlemi etkilemez).
  after(async () => { try { await sb.from('admin_activity').insert({ action: op, table_name: table, record_id: recordId, user_id: user.id }) } catch {} })

  const decrypted = Array.isArray(r?.data) ? r.data.map((row:any)=>decryptRow(table,row)) : r?.data
  return NextResponse.json({ ok: true, data: decrypted })
}
