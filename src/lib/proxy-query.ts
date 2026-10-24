// Sunucu tarafı: /api/erp ve /api/muhasebe proxy'lerinin ortak sorgu uygulayıcısı.
// Aynı filtre birden fazla kez verilebilir (eq=a:1&eq=b:2). Alan adları doğrulanır.
const FIELD = /^[a-zA-Z0-9_.]+$/

function split(s: string): [string, string] | null {
  const i = s.indexOf(':')
  if (i < 1) return null
  const f = s.slice(0, i)
  return FIELD.test(f) ? [f, s.slice(i + 1)] : null
}

export function applyQuery(q: any, sp: URLSearchParams) {
  for (const s of sp.getAll('eq'))  { const p = split(s); if (p) q = q.eq(p[0], p[1]) }
  for (const s of sp.getAll('neq')) { const p = split(s); if (p) q = q.neq(p[0], p[1]) }
  for (const s of sp.getAll('gte')) { const p = split(s); if (p) q = q.gte(p[0], p[1]) }
  for (const s of sp.getAll('lte')) { const p = split(s); if (p) q = q.lte(p[0], p[1]) }
  for (const s of sp.getAll('gt'))  { const p = split(s); if (p) q = q.gt(p[0], p[1]) }
  for (const s of sp.getAll('lt'))  { const p = split(s); if (p) q = q.lt(p[0], p[1]) }
  for (const s of sp.getAll('in'))  { const p = split(s); if (p) q = q.in(p[0], p[1].split('|')) }
  for (const s of sp.getAll('ilike')) { const p = split(s); if (p) q = q.ilike(p[0], `%${p[1].replace(/[%,()]/g, ' ')}%`) }
  for (const s of sp.getAll('is'))  { const p = split(s); if (p) q = q.is(p[0], p[1] === 'null' ? null : p[1] === 'true') }

  // Çoklu sıralama: ord=alan:asc|desc (yeni) — eski order/order_asc parametresi de desteklenir
  const ords = sp.getAll('ord')
  if (ords.length) {
    for (const o of ords) { const p = split(o); if (p) q = q.order(p[0], { ascending: p[1] === 'asc' }) }
  } else if (sp.get('order') && FIELD.test(sp.get('order')!)) {
    q = q.order(sp.get('order')!, { ascending: sp.get('order_asc') === 'true' })
  }

  // Çok kolonlu arama: search=terim&searchIn=alan1,alan2  → alan ilike %terim% (OR)
  const term = (sp.get('search') || '').replace(/[,()%*\\:]/g, ' ').trim()
  const fields = (sp.get('searchIn') || '').split(',').filter(f => FIELD.test(f))
  if (term && fields.length) q = q.or(fields.map(f => `${f}.ilike.%${term}%`).join(','))

  const limRaw = Number(sp.get('limit')), offRaw = Number(sp.get('offset'))
  const limit = sp.get('limit') && Number.isFinite(limRaw) && limRaw > 0 ? Math.min(Math.floor(limRaw), 1000) : null
  const offset = sp.get('offset') && Number.isFinite(offRaw) ? Math.max(Math.floor(offRaw), 0) : 0
  if (offset && limit) q = q.range(offset, offset + limit - 1)
  else if (limit) q = q.limit(limit)
  return q
}

// created_by / updated_by kolonu OLMAYAN tablolar — proxy bu alanları eklerse PostgREST "column not found" hatası verir.
const NO_CREATED_BY = new Set([
  'depolar', 'hammadde_lotlari', 'ihracat_detaylari', 'kalip_bakim_kayitlari', 'kalite_kontrol_kayitlari', 'recete_kalemleri',
  'satinalma_siparisi_kalemleri', 'satis_siparisi_kalemleri', 'uretim_hareketleri', 'roller', 'fiyat_listesi_kalemleri', 'iskonto_kademeleri',
])
const NO_UPDATED_BY = new Set([...NO_CREATED_BY, 'banka_ekstre_kayitlari', 'fire_kayitlari', 'stok_hareketleri'])

export const withCreatedBy = (table: string, d: any, uid: string) =>
  NO_CREATED_BY.has(table) ? d : Array.isArray(d) ? d.map(x => ({ ...x, created_by: uid })) : { ...d, created_by: uid }
export const withUpdatedBy = (table: string, d: any, uid: string) =>
  NO_UPDATED_BY.has(table) ? d : { ...d, updated_by: uid }
