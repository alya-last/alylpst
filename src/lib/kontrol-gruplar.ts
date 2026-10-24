// Stok / Üretim / Satış-Lojistik / Kalite menü grupları için otomatik kontrol (uyarı) ve rehber ayarları.
// Her grubun veritabanında rpc_<grup>_kontrol() fonksiyonu vardır; uyarı kodu → düzeltme sayfası eşlemesi burada.
export type GrupId = 'stok' | 'uretim' | 'satis' | 'kalite'

const SAYFA_KURALLARI: Record<GrupId, [RegExp, string][]> = {
  stok: [[/^hareket_/, 'stok/hareketler'], [/^varyant_/, 'stok/barkod'], [/./, 'stok/hammadde']],
  uretim: [[/^emir_/, 'uretim/emirler'], [/^makine_/, 'uretim/makine'], [/^kalip_/, 'uretim/kalip'], [/^recete_/, 'uretim/recete']],
  satis: [[/^siparis_/, 'satis/siparisler'], [/^teklif_/, 'satis/teklifler'], [/^sevk_/, 'sevkiyat'], [/^sa_/, 'satinalma/siparisler'], [/^talep_/, 'satinalma/talepler'], [/^ret_/, 'satinalma/iade-ret'], [/^ihracat_/, 'satis/ihracat-evraklari']],
  kalite: [[/^kk_/, 'kalite/kontrol'], [/^fire_/, 'kalite/fire'], [/^kalip_/, 'uretim/kalip'], [/^makine_/, 'uretim/makine']],
}

export const GRUPLAR: Record<GrupId, { ad: string; rpc: string; yollar: string[] }> = {
  stok: { ad: 'Stok / Depo', rpc: 'rpc_stok_kontrol', yollar: ['/stok'] },
  uretim: { ad: 'Üretim', rpc: 'rpc_uretim_kontrol', yollar: ['/uretim'] },
  satis: { ad: 'Satış / Lojistik', rpc: 'rpc_satis_kontrol', yollar: ['/satis', '/satinalma', '/sevkiyat'] },
  kalite: { ad: 'Kalite & Bakım', rpc: 'rpc_kalite_kontrol', yollar: ['/kalite'] },
}

export function grupBul(pathname: string): GrupId | null {
  for (const g of Object.keys(GRUPLAR) as GrupId[]) if (GRUPLAR[g].yollar.some(y => pathname.includes('/admin/dashboard' + y))) return g
  return null
}

export function kontrolYol(grup: GrupId, kod: string, id: string | null) {
  const s = SAYFA_KURALLARI[grup].find(([re]) => re.test(kod))?.[1] || ''
  return `/admin/dashboard/${s}${id ? `?ac=${id}` : ''}`
}
