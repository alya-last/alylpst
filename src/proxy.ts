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

export async function proxy(request: NextRequest) {
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
  matcher: ['/admin/:path*', '/api/:path*'],
}
