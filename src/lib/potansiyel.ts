// n8n'den (Google Maps tarayıcısı vb.) gelen potansiyel müşteri kayıtlarını normalleştirir.
// Alan adları esnek: title/baslik, phone/telefon, emails[0]/email/eposta, website, address/adres, categoryName/kategori, url/harita_url.
export type Aday = { baslik: string; telefon: string | null; eposta: string | null; website: string | null; adres: string | null; kategori: string | null; harita_url: string | null }

const temiz = (v: unknown, n: number): string | null => {
  if (v == null || typeof v === 'object') return null
  const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, n) : null
}
const httpUrl = (v: unknown, n: number): string | null => {
  const s = temiz(v, n); if (!s) return null
  const m = /^https?:\/\/[^\s<>"']+$/i.test(s) ? s : /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s<>"']*)?$/i.test(s) ? 'https://' + s : null
  return m && m.length <= n ? m : null
}
const eposta = (v: unknown): string | null => {
  const ilk = Array.isArray(v) ? v.find(x => typeof x === 'string' && x.trim()) : v
  const s = temiz(ilk, 200)?.toLowerCase() ?? null
  return s && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s) ? s : null
}
const al = (o: any, ...k: string[]) => { for (const x of k) if (o?.[x] != null && o[x] !== '') return o[x]; return undefined }

export function adayYap(o: any): Aday | null {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  const baslik = temiz(al(o, 'baslik', 'title', 'name', 'ad'), 300)
  if (!baslik) return null
  return {
    baslik,
    telefon: temiz(al(o, 'telefon', 'phone', 'phoneUnformatted'), 60),
    eposta: eposta(al(o, 'eposta', 'email', 'emails')),
    website: httpUrl(al(o, 'website', 'web', 'site'), 500),
    adres: temiz(al(o, 'adres', 'address'), 500),
    kategori: temiz(al(o, 'kategori', 'categoryName', 'category'), 200),
    harita_url: httpUrl(al(o, 'harita_url', 'url', 'maps_url'), 1000),
  }
}

/** Gövde: tek nesne, dizi ya da {items|veriler|data:[...]} olabilir. */
export function adaylar(body: any): { adaylar: Aday[]; gecersiz: number } {
  const liste: any[] = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : Array.isArray(body?.veriler) ? body.veriler : Array.isArray(body?.data) ? body.data : [body]
  const out: Aday[] = []; let gecersiz = 0
  for (const x of liste.slice(0, 500)) { const a = adayYap(x?.json && typeof x.json === 'object' ? x.json : x); a ? out.push(a) : gecersiz++ }
  return { adaylar: out, gecersiz }
}

/** Yalnızca güvenli (http/https) bağlantıları arayüzde link yapmak için. */
export const guvenliHttp = (u?: string | null) => (typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u) ? u : null)
