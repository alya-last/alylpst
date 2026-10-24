// Kritik güvenlik/erişim kontrollerini doğrulayan basit duman testi.
// Çalıştırma: node scripts/smoke-test.mjs https://alyatest-alyis.vercel.app
// Yeni bağımlılık gerektirmez, sadece fetch kullanır.

const base = process.argv[2] || 'https://alyatest-alyis.vercel.app'
let fail = 0

async function check(name, fn) {
  try {
    const ok = await fn()
    console.log(`${ok ? '✓' : '✗'} ${name}`)
    if (!ok) fail++
  } catch (e) {
    console.log(`✗ ${name} — ${e.message}`)
    fail++
  }
}

await check('Ana sayfa açılıyor', async () => {
  const r = await fetch(base + '/')
  return r.status === 200
})

await check('/admin/dashboard oturumsuz erişimde login\'e yönleniyor', async () => {
  const r = await fetch(base + '/admin/dashboard', { redirect: 'manual' })
  return r.status === 307 || r.status === 302 || (r.headers.get('location')||'').includes('/admin/login')
})

await check('/api/muhasebe oturumsuz istekte 401 dönüyor', async () => {
  const r = await fetch(base + '/api/muhasebe?table=cari_hesaplar')
  return r.status === 401
})

await check('/api/erp oturumsuz istekte 401 dönüyor', async () => {
  const r = await fetch(base + '/api/erp?table=hammaddeler')
  return r.status === 401
})

await check('/api/webhooks/sosyal tokensız istekte 401/503 dönüyor (veri sızmıyor)', async () => {
  const r = await fetch(base + '/api/webhooks/sosyal', { headers: { Authorization: 'Bearer yanlis' } })
  const t = await r.text()
  return (r.status === 401 || r.status === 503) && !t.includes('gonderiler')
})

await check('/api/admin/sosyal-gonder oturumsuz istekte 401 dönüyor', async () => {
  const r = await fetch(base + '/api/admin/sosyal-gonder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  return r.status === 401
})

await check('/api/admin/olay oturumsuz istekte 401 dönüyor', async () => {
  const r = await fetch(base + '/api/admin/olay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ olay: 'sifre_degisti' }) })
  return r.status === 401
})

await check('/api/admin/satinalma-gonder oturumsuz istekte 401 dönüyor', async () => {
  const r = await fetch(base + '/api/admin/satinalma-gonder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  return r.status === 401
})

await check('/api/webhooks/potansiyel tokensız istekte 401/503 dönüyor (veri sızmıyor)', async () => {
  const r = await fetch(base + '/api/webhooks/potansiyel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x' }) })
  return r.status === 401 || r.status === 503
})

await check('sesli asistan uçları oturumsuz 401 dönüyor', async () => {
  const [a, b, c] = await Promise.all([fetch(base + '/api/admin/ses'), fetch(base + '/api/admin/ses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), fetch(base + '/api/admin/ses/arac', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })])
  return a.status === 401 && b.status === 401 && c.status === 401
})

await check('Permissions-Policy mikrofon/kameraya kendi sitesinde izin veriyor (sesli asistan, kiosk, barkod)', async () => {
  const r = await fetch(base + '/'); const h = r.headers.get('permissions-policy') || ''
  return /microphone=\(self\)/.test(h) && /camera=\(self\)/.test(h)
})

await check('dil sayfaları (en/ru/zh) açılıyor, tanımsız dil 404 dönüyor, sitemap hreflang içeriyor', async () => {
  const [en, ru, zh, de, sm] = await Promise.all(['/en', '/ru', '/zh', '/de', '/sitemap.xml'].map(p => fetch(base + p)))
  const [tEn, tRu, tZh, tSm] = await Promise.all([en.text(), ru.text(), zh.text(), sm.text()])
  return en.status === 200 && ru.status === 200 && zh.status === 200 && de.status === 404 && /Manufacturer/.test(tEn) && /Производитель/.test(tRu) && /塑料/.test(tZh) && /\/zh</.test(tSm)
})

await check('ürün sayfası açılıyor ve geçersiz adres 404 dönüyor', async () => {
  const [a, b] = await Promise.all([fetch(base + '/urun/ufo-saksi'), fetch(base + '/urun/olmayan-bir-urun-xyz')])
  return a.status === 200 && b.status === 404
})

await check('/api/db kaldırılmış (404 dönüyor)', async () => {
  const r = await fetch(base + '/api/db?table=cari_hesaplar')
  return r.status === 404
})

console.log(fail === 0 ? '\nTüm kontroller geçti ✓' : `\n${fail} kontrol başarısız ✗`)
process.exit(fail === 0 ? 0 : 1)
