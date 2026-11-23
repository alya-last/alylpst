import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// CSRF'e karşı ek koruma: tarayıcıdan başka bir siteden gelen yazma (POST/PUT/PATCH/DELETE) istekleri reddedilir.
// Origin başlığı yoksa (sunucudan sunucuya, cron vb.) dokunulmaz; bunlar kendi anahtarlarıyla yetkilendirilir.
function ayniKaynakDegil(request: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false
  const origin = request.headers.get('origin')
  if (!origin) return false
  try { return new URL(origin).host !== (request.headers.get('x-forwarded-host') || request.headers.get('host')) } catch { return true }
}


// --- Ziyaretçi dili: ana sayfa ("/") ilk açılışta tarayıcı diline (Accept-Language), olmazsa ülkeye göre /en, /ru, /zh'e yönlenir. ---
// Kullanıcı dil menüsünden seçim yaptığında "dil" çerezi yazılır (YHeader) ve bir daha otomatik yönlendirme yapılmaz.
const DESTEKLI = ['tr', 'en', 'ru', 'zh'] as const
type DilKodu = (typeof DESTEKLI)[number]
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|lighthouse|pagespeed|headless|preview|whatsapp|telegram/i
const RU_ULKE = new Set(['RU', 'BY', 'KZ', 'KG', 'UZ', 'TJ', 'AM', 'AZ', 'MD'])
const ZH_ULKE = new Set(['CN', 'HK', 'MO', 'TW', 'SG'])

function tarayiciDili(al: string | null): DilKodu | null {
  if (!al) return null
  let en: { d: DilKodu; q: number } | null = null
  for (const parca of al.split(',')) {
    const [etiket, ...ek] = parca.trim().split(';')
    const k = etiket.trim().toLowerCase().split('-')[0]
    if (!(DESTEKLI as readonly string[]).includes(k)) continue
    const qs = ek.map(x => x.trim()).find(x => x.startsWith('q='))
    const q = qs ? parseFloat(qs.slice(2)) : 1
    if (!Number.isNaN(q) && q > 0 && (!en || q > en.q)) en = { d: k as DilKodu, q }
  }
  return en ? en.d : null
}

function ziyaretciDili(request: NextRequest): DilKodu {
  const ac = tarayiciDili(request.headers.get('accept-language'))
  if (ac) return ac
  const ulke = (request.headers.get('x-vercel-ip-country') || '').toUpperCase()
  if (!ulke || ulke === 'TR') return 'tr'
  if (RU_ULKE.has(ulke)) return 'ru'
  if (ZH_ULKE.has(ulke)) return 'zh'
  return 'en'
}

function dilYonlendirme(request: NextRequest): NextResponse | null {
  if (request.method !== 'GET' || request.nextUrl.pathname !== '/') return null
  if (request.cookies.get('dil')) return null // kullanıcı kendi seçtiyse dokunma
  if (request.nextUrl.searchParams.size > 0) return null // kategori filtresi vb. paylaşılan bağlantılar bozulmasın
  if (BOT.test(request.headers.get('user-agent') || '')) return null // arama motoru Türkçe sayfayı görsün
  const dil = ziyaretciDili(request)
  if (dil === 'tr') return null
  const url = request.nextUrl.clone()
  url.pathname = `/${dil}`
  const yanit = NextResponse.redirect(url, 307)
  yanit.headers.set('Vary', 'Accept-Language, Cookie')
  return yanit
}

export async function proxy(request: NextRequest) {
  const dilYanit = dilYonlendirme(request)
  if (dilYanit) return dilYanit
  if (request.nextUrl.pathname === '/') return NextResponse.next()
  if (request.nextUrl.pathname.startsWith('/api/') && ayniKaynakDegil(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı' }, { status: 403 })
  }
  if (request.nextUrl.pathname.startsWith('/api/') && !/^\/api\/(admin|muhasebe|erp)\//.test(request.nextUrl.pathname)) return NextResponse.next()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = path.startsWith('/admin/dashboard')
  const isLogin = path === '/admin/login'

  // İki adımlı doğrulaması açık kullanıcı, kodu girmeden (aal2 olmadan) panele alınmaz; kod adımı için giriş sayfasına yönlendirilir.
  // (Veri erişimi ayrıca veritabanında zorunludur: aal1 oturum hiçbir yetkili veriyi okuyamaz.)
  let kodBekliyor = false
  if (user && user.factors?.some(f => f.status === 'verified' && f.factor_type === 'totp')) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    kodBekliyor = aal?.currentLevel !== 'aal2'
  }

  if (isProtected && (!user || kodBekliyor)) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  if (isLogin && user && !kodBekliyor) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/', '/admin/:path*', '/api/:path*'],
}
