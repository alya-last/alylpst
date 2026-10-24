'use client'
import { useCallback, useEffect, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { Page, PageHead, Card, Badge, useToast } from '@/components/admin/erp/ui'
import { ZipYazici } from '@/lib/zip-yaz'
import { Download, FileArchive, AlertTriangle, RefreshCw, Database, FolderArchive } from 'lucide-react'

type Tablo = { ad: string; satir: number | null; hata?: string }
type Kova = { ad: string; acik: boolean }
type Sonuc = { tablo: number; satir: number; kullanici: number; dosya: number; sema: boolean; boyutMb: number; hatalar: string[] }

async function api(q: string) {
  const r = await fetch('/api/admin/yedek?' + q)
  const j = await r.json().catch(() => ({ error: 'Yanıt okunamadı' }))
  if (!r.ok) throw new Error(j.error || `Hata ${r.status}`)
  return j
}

const bekle = (ms: number) => new Promise(r => setTimeout(r, ms))

// Bir tablonun tüm satırlarını sayfa sayfa çeker (her sayfa en fazla 3 kez denenir)
async function tabloCek(ad: string, sayfa?: (n: number) => void): Promise<any[]> {
  const out: any[] = []
  let bas = 0
  for (;;) {
    let j: any
    for (let d = 0; d < 3; d++) {
      try { j = await api(`islem=tablo&ad=${encodeURIComponent(ad)}&bas=${bas}`); break } catch (e) { if (d === 2) throw e; await bekle(800) }
    }
    out.push(...j.rows)
    bas = j.sonraki
    sayfa?.(out.length)
    if (j.bitti || !j.rows.length) break
  }
  return out
}

function csvMetni(rows: any[]) {
  const cols: string[] = []
  const gorulen = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) if (!gorulen.has(k)) { gorulen.add(k); cols.push(k) }
  const esc = (v: any) => `"${(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/"/g, '""')}"`
  return '﻿' + [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n')
}

function indir(blob: Blob, ad: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = ad; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

const damga = () => new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')

export default function YedekPage() {
  const toast = useToast()
  const [liste, setListe] = useState<{ tablolar: Tablo[]; kovalar: Kova[] } | null>(null)
  const [hata, setHata] = useState('')
  const [yuk, setYuk] = useState(true)
  const [dosyalarDahil, setDosyalarDahil] = useState(true)
  const [calisiyor, setCalisiyor] = useState(false)
  const [adim, setAdim] = useState('')
  const [yuzde, setYuzde] = useState(0)
  const [sonuc, setSonuc] = useState<Sonuc | null>(null)
  const [tek, setTek] = useState('')
  const [sistem, setSistem] = useState<any>(null)

  const yukle = useCallback(async () => {
    setYuk(true); setHata('')
    api('islem=sistem').then(setSistem).catch(() => {})
    try { setListe(await api('islem=liste')) } catch (e: any) { setHata(e.message || 'Liste alınamadı') }
    setYuk(false)
  }, [])
  useEffect(() => { yukle() }, [yukle])

  const toplamSatir = (liste?.tablolar || []).reduce((t, x) => t + (x.satir || 0), 0)

  async function tamYedek() {
    if (!liste || calisiyor) return
    setCalisiyor(true); setSonuc(null); setYuzde(0)
    const zip = new ZipYazici()
    const hatalar: string[] = []
    const ozet: Record<string, number | null> = {}
    let satir = 0, dosyaSay = 0, bayt = 0, kullaniciSay = 0, semaVar = false
    try {
      await fetch('/api/admin/yedek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ islem: 'basla', dosyalar: dosyalarDahil }) })

      const n = liste.tablolar.length
      for (let i = 0; i < n; i++) {
        const t = liste.tablolar[i]
        setAdim(`Tablo ${i + 1}/${n}: ${t.ad}`); setYuzde(Math.round((i / n) * 60))
        try {
          const rows = await tabloCek(t.ad, c => setAdim(`Tablo ${i + 1}/${n}: ${t.ad} (${c.toLocaleString('tr-TR')} satır)`))
          zip.ekleMetin(`tablolar/${t.ad}.json`, JSON.stringify(rows))
          zip.ekleMetin(`tablolar/${t.ad}.csv`, csvMetni(rows))
          ozet[t.ad] = rows.length; satir += rows.length
          if (t.satir != null && rows.length !== t.satir) hatalar.push(`${t.ad}: beklenen ${t.satir} satır, alınan ${rows.length}`)
        } catch (e: any) { ozet[t.ad] = null; hatalar.push(`${t.ad}: ${e.message}`) }
      }

      setAdim('Kullanıcı listesi'); setYuzde(61)
      try {
        const k = await api('islem=kullanicilar')
        zip.ekleMetin('kullanicilar.json', JSON.stringify(k.kullanicilar, null, 1)); kullaniciSay = k.kullanicilar.length
      } catch (e: any) { hatalar.push(`kullanıcılar: ${e.message}`) }

      setAdim('Veritabanı yapısı (tablolar, ilişkiler, güvenlik kuralları, fonksiyonlar)'); setYuzde(61)
      try {
        const sm = await api('islem=sema')
        zip.ekleMetin('veritabani-yapisi.sql', sm.sql); semaVar = true
      } catch (e: any) { hatalar.push(`veritabanı yapısı: ${e.message}`) }

      setAdim('Sistem bilgisi'); setYuzde(62)
      try {
        const si = await api('islem=sistem')
        zip.ekleMetin('sistem.json', JSON.stringify(si, null, 1))
      } catch (e: any) { hatalar.push(`sistem bilgisi: ${e.message}`) }

      if (dosyalarDahil) {
        setAdim('Dosya listesi hazırlanıyor'); setYuzde(63)
        try {
          const { dosyalar } = await api('islem=dosyalar')
          for (let i = 0; i < dosyalar.length; i++) {
            const d = dosyalar[i]
            setAdim(`Dosya ${i + 1}/${dosyalar.length}: ${d.kova}/${d.yol}`); setYuzde(63 + Math.round((i / Math.max(dosyalar.length, 1)) * 32))
            try {
              if (!d.url) throw new Error('indirme bağlantısı alınamadı')
              const r = await fetch(d.url)
              if (!r.ok) throw new Error(`HTTP ${r.status}`)
              const b = new Uint8Array(await r.arrayBuffer())
              zip.ekle(`dosyalar/${d.kova}/${d.yol}`, b); dosyaSay++; bayt += b.length
            } catch (e: any) { hatalar.push(`dosya ${d.kova}/${d.yol}: ${e.message}`) }
          }
        } catch (e: any) { hatalar.push(`dosyalar: ${e.message}`) }
      }

      setAdim('ZIP dosyası hazırlanıyor'); setYuzde(97)
      zip.ekleMetin('ozet.json', JSON.stringify({ tarih: new Date().toISOString(), tablolar: ozet, kullanici: kullaniciSay, dosya: dosyaSay, veritabaniYapisi: semaVar, hatalar }, null, 1))
      zip.ekleMetin('OKU.txt', [
        'ALYA PANEL — SİSTEM YEDEĞİ', `Tarih: ${new Date().toLocaleString('tr-TR')}`, '',
        'İçerik:',
        '- veritabani-yapisi.sql : Veritabanının YAPISI (tablolar, ilişkiler, indeksler, güvenlik kuralları/RLS, fonksiyonlar, tetikleyiciler, görünümler, yetkiler, storage kovaları). Boş bir projede çalıştırılır.',
        '- tablolar/<ad>.json ve .csv : Tüm tabloların VERİSİ (tüm sütunlar; id ve ilişki alanları dahil)',
        '- kullanicilar.json : Giriş hesapları (id, e-posta, tarihler, metadata). ŞİFRELER YEDEKLENEMEZ.',
        '- dosyalar/<kova>/... : Depolama dosyaları (ürün görselleri, katalog vb.)',
        '- sistem.json : Gereken ortam değişkeni ADLARI (değerler yok), Supabase proje bilgisi, Vercel/GitHub bilgisi, zamanlanmış görevler',
        '- ozet.json : tablo satır sayıları ve alınamayan kayıtlar', '',
        'Taşıma sırası:',
        '1. Yeni Supabase projesi aç. SQL Editor’de önce veritabani-yapisi.sql dosyasını, sonra repodaki supabase/yedek_sema_fonksiyonu.sql dosyasını çalıştır.',
        '2. Kullanıcıları (kullanicilar.json) AYNI id’lerle oluştur — admin_profiles ve created_by gibi alanlar bu id’lere bağlıdır. Şifreler yeniden belirlenir.',
        '3. tablolar/*.json verilerini yükle (ilişkiler nedeniyle sıralı ya da session_replication_role = replica ile). Sonra veritabani-yapisi.sql sonundaki setval komutlarını çalıştır.',
        '4. dosyalar/ klasörünü aynı kova adlarıyla Storage’a yükle.',
        '5. Vercel’de projeyi GitHub reposuna bağla; sistem.json’daki ortam değişkenlerini yeni değerlerle gir.', '',
        'Dikkat:',
        '- FIELD_ENCRYPTION_KEY: cari vergi numaralarının bir kısmı bu anahtarla şifrelidir ("enc:v1:" ile başlar). Anahtar yoksa o alanlar okunamaz; yeniden girilmesi gerekir.',
        '- Bu yedek tüm cari, bordro ve muhasebe verisini içerir; güvenli bir yerde sakla.',
        '- Yükleme adımları (3. madde) için ayrıca bir yükleme betiği hazırlanabilir.',
      ].join('\n'))
      const blob = zip.bitir()
      indir(blob, `alya-yedek-${damga()}.zip`)
      setYuzde(100); setAdim('Tamamlandı')
      setSonuc({ tablo: n, satir, kullanici: kullaniciSay, dosya: dosyaSay, sema: semaVar, boyutMb: Math.round((blob.size / 1048576) * 10) / 10, hatalar })
    } catch (e: any) {
      toast.show(e.message || 'Yedek alınamadı', true); setAdim('Hata oluştu')
    }
    setCalisiyor(false)
  }

  async function tekTablo(ad: string, bicim: 'csv' | 'json') {
    if (tek) return
    setTek(ad + bicim)
    try {
      const rows = await tabloCek(ad)
      if (bicim === 'json') indir(new Blob([JSON.stringify(rows)], { type: 'application/json' }), `${ad}.json`)
      else indir(new Blob([csvMetni(rows)], { type: 'text/csv;charset=utf-8;' }), `${ad}.csv`)
      toast.show(`${ad}: ${rows.length.toLocaleString('tr-TR')} satır indirildi`)
    } catch (e: any) { toast.show(e.message || 'İndirilemedi', true) }
    setTek('')
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Sistem Yedeği" />
      <Page maxWidth={980}>
        <PageHead title="Sistem Yedeği (Taşıma)" sub="Veritabanı yapısı, tüm tablolar, kullanıcı listesi, yüklenen dosyalar ve sistem bilgisi — tek ZIP"
          actions={<button className="adm-btn-ghost" onClick={yukle} disabled={yuk || calisiyor}><RefreshCw size={14} />Yenile</button>} />

        {hata && <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--adm-red)', background: 'var(--adm-red2)', borderRadius: 10, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={15} />{hata}</div>}

        <Card title={<><FileArchive size={15} />Tam yedek</>} pad={16}>
          <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.6 }}>
            {yuk ? 'Tablolar sayılıyor…' : liste ? <>{liste.tablolar.length} tablo, toplam <b>{toplamSatir.toLocaleString('tr-TR')}</b> satır{liste.kovalar.length ? <>, {liste.kovalar.length} dosya klasörü</> : null}.</> : null}
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14 }}>
            <input type="checkbox" checked={dosyalarDahil} onChange={e => setDosyalarDahil(e.target.checked)} disabled={calisiyor} />
            Yüklenen dosyaları da ekle (ürün görselleri, katalog)
          </label>
          <button className="adm-btn" onClick={tamYedek} disabled={!liste || calisiyor}><Download size={14} />{calisiyor ? 'İndiriliyor…' : 'Tam yedeği indir (ZIP)'}</button>

          {(calisiyor || adim) && (
            <div style={{ marginTop: 16 }}>
              <div style={{ height: 8, borderRadius: 6, background: 'var(--adm-s2, rgba(128,128,128,.18))', overflow: 'hidden' }}>
                <div style={{ width: `${yuzde}%`, height: '100%', background: 'var(--adm-ac)', transition: 'width .25s' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--adm-tx3)', wordBreak: 'break-all' }}>%{yuzde} — {adim}</div>
            </div>
          )}

          {sonuc && (
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: sonuc.hatalar.length ? 'var(--adm-amber2, rgba(245,158,11,.12))' : 'var(--adm-green2, rgba(34,197,94,.12))', fontSize: 13, lineHeight: 1.6 }}>
              <b>{sonuc.hatalar.length ? 'Yedek indirildi ama bazı kayıtlar alınamadı' : 'Yedek indirildi'}</b>
              <div>{sonuc.tablo} tablo · {sonuc.satir.toLocaleString('tr-TR')} satır · {sonuc.kullanici} kullanıcı · {sonuc.dosya} dosya · veritabanı yapısı {sonuc.sema ? 'var' : 'YOK'} · {sonuc.boyutMb} MB</div>
              {sonuc.hatalar.length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5 }}>{sonuc.hatalar.slice(0, 12).map((h, i) => <li key={i}>{h}</li>)}{sonuc.hatalar.length > 12 && <li>…ve {sonuc.hatalar.length - 12} hata daha (ozet.json içinde)</li>}</ul>}
            </div>
          )}
        </Card>

        <div style={{ height: 14 }} />
        <Card title={<><AlertTriangle size={15} />Taşımadan önce bilmen gerekenler</>} pad={16}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            <li><b>Şifreler yedeklenemez.</b> Kullanıcı listesi gelir, ama yeni sistemde herkesin şifresi yeniden belirlenmelidir. Kullanıcılar aynı id’lerle oluşturulmalıdır (kayıtlar bu id’lere bağlı).</li>
            <li><b>Cari vergi numaraları</b> kısmen şifrelidir. Şifreleme anahtarı (<code>FIELD_ENCRYPTION_KEY</code>) bulunamazsa o alanlar okunamaz; yeniden girilir. Diğer veriler etkilenmez.</li>
            <li>İçindeki <b>veritabani-yapisi.sql</b> dosyası boş bir Supabase projesinde çalıştırılır; verileri yüklemeden önce kurulmalıdır. Üretilmiş bir dosyadır, taşımadan önce boş bir projede deneyin.</li>
            <li>Yedek dosyası tüm cari, bordro ve muhasebe verisini içerir; güvenli bir yerde sakla. İndirme anında yöneticilere bildirim gider.</li>
          </ul>
        </Card>

        <div style={{ height: 14 }} />
        <Card title={<><Database size={15} />Sistem bilgisi</>} pad={16}>
          {!sistem ? <span style={{ fontSize: 13, color: 'var(--adm-tx3)' }}>Yükleniyor…</span> : (
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div>Supabase projesi: <code>{sistem.supabase?.proje || '—'}</code> · Vercel ortamı: <code>{sistem.vercel?.ortam || '—'}</code>{sistem.vercel?.repo && <> · GitHub: <code>{sistem.vercel.repo}</code> ({sistem.vercel.dal || '—'}{sistem.vercel.commit ? ` @ ${String(sistem.vercel.commit).slice(0, 7)}` : ''})</>}</div>
              {sistem.zamanlanmisGorevler?.length > 0 && <div>Zamanlanmış görevler: {sistem.zamanlanmisGorevler.map((g: any) => <code key={g.path} style={{ marginRight: 8 }}>{g.path} ({g.schedule})</code>)}</div>}
              <div style={{ marginTop: 10, marginBottom: 4, fontWeight: 600 }}>Ortam değişkenleri <span style={{ fontWeight: 400, color: 'var(--adm-tx3)' }}>(yeni sistemde de girilmeli; değerler burada gösterilmez)</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(sistem.env || []).map((e: any) => <Badge key={e.ad} tone={e.tanimli ? 'green' : 'muted'}>{e.ad}{e.tanimli ? '' : ' · tanımsız'}</Badge>)}</div>
            </div>
          )}
        </Card>

        <div style={{ height: 14 }} />
        <Card title={<><Database size={15} />Tablolar</>} right={liste ? <Badge tone="muted">{liste.tablolar.length}</Badge> : null}>
          <div style={{ maxHeight: 460, overflow: 'auto' }}>
            <table className="adm-tbl compact">
              <thead><tr><th>Tablo</th><th style={{ textAlign: 'right', width: 90 }}>Satır</th><th style={{ width: 150 }}></th></tr></thead>
              <tbody>
                {(liste?.tablolar || []).map(t => (
                  <tr key={t.ad}>
                    <td><code style={{ fontSize: 12 }}>{t.ad}</code>{t.hata && <span style={{ color: 'var(--adm-red)', fontSize: 11, marginLeft: 8 }}>{t.hata}</span>}</td>
                    <td style={{ textAlign: 'right' }}>{t.satir == null ? '—' : t.satir.toLocaleString('tr-TR')}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="adm-btn-ghost" style={{ padding: '2px 9px', fontSize: 11.5 }} disabled={!!tek || calisiyor} onClick={() => tekTablo(t.ad, 'csv')}>{tek === t.ad + 'csv' ? '…' : 'CSV'}</button>{' '}
                      <button className="adm-btn-ghost" style={{ padding: '2px 9px', fontSize: 11.5 }} disabled={!!tek || calisiyor} onClick={() => tekTablo(t.ad, 'json')}>{tek === t.ad + 'json' ? '…' : 'JSON'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {liste && liste.kovalar.length > 0 && (
          <>
            <div style={{ height: 14 }} />
            <Card title={<><FolderArchive size={15} />Dosya klasörleri</>} pad={16}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{liste.kovalar.map(k => <Badge key={k.ad} tone={k.acik ? 'blue' : 'muted'}>{k.ad}{k.acik ? ' · herkese açık' : ''}</Badge>)}</div>
            </Card>
          </>
        )}
        <div style={{ height: 14 }} />
        <VeriSilKarti />
        <div style={{ height: 14 }} />
        <ImhaKarti />
      </Page>
      {toast.node}
    </div>
  )
}

// GERİ DÖNÜŞÜ YOK: tüm tablo verisi, yüklenen dosyalar ve tüm giriş hesapları silinir.
function ImhaKarti() {
  const [metin, setMetin] = useState('')
  const [calisiyor, setCalisiyor] = useState(false)
  const [sonuc, setSonuc] = useState<any>(null)
  const [hata, setHata] = useState('')
  const hazir = metin.trim().toLocaleLowerCase('tr-TR') === 'imha et'

  async function imhaEt() {
    if (!hazir || calisiyor) return
    if (!window.confirm('SON UYARI: Veritabanı, dosyalar, giriş hesapları (siz dahil) ve GitHub deposu KALICI olarak silinecek. Geri alınamaz. Yedeği aldığınızdan emin misiniz?')) return
    setCalisiyor(true); setHata(''); setSonuc(null)
    try {
      const r = await fetch('/api/admin/imha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ onay: metin }) })
      const j = await r.json().catch(() => ({ error: 'Yanıt okunamadı' }))
      if (r.status === 200 || r.status === 207) setSonuc(j)
      else setHata(j.error || `Hata ${r.status}`)
    } catch (e: any) { setHata(e?.message || 'İşlem başarısız') }
    setCalisiyor(false)
  }

  return (
    <Card title={<><AlertTriangle size={15} style={{ color: 'var(--adm-red)' }} />Tehlikeli Bölge — Her Şeyi İmha Et</>} pad={16} style={{ border: '1px solid var(--adm-red)' }}>
      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
        Bu işlem <b>geri alınamaz</b>. Veritabanının tamamı (tablolar, veriler, güvenlik kuralları, fonksiyonlar) silinir, yüklenen tüm dosyalar ve dosya klasörleri silinir, <b>tüm giriş hesapları (sizinki dahil)</b> silinir ve GitHub deposu (kodlar ve geçmişi) silinir. Sonrasında sistem çalışmaz; yeniden kurmak için yedek ve indirdiğiniz kod gerekir.</p>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--adm-tx3)' }}>Önce yukarıdan tam yedeği indirdiğinizden ve yeni sistemin çalıştığını doğruladığınızdan emin olun.</p>
      {sonuc ? (
        <div style={{ fontSize: 13 }}>
          <b>{sonuc.ok ? 'İmha tamamlandı.' : 'İmha kısmen tamamlandı.'}</b> {sonuc.tablo} tablo, {sonuc.dosya} dosya ve {sonuc.kullanici} hesap silindi; GitHub deposu {sonuc.github ? 'silindi' : 'silinmedi'}.{sonuc.yapiKaldi ? ' Tablo yapısı (boş tablolar) korundu; tamamen kaldırmak için Supabase projesini silin.' : ''}
          {sonuc.hatalar?.length > 0 && <ul style={{ color: 'var(--adm-red)' }}>{sonuc.hatalar.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>}
          <div style={{ marginTop: 8 }}><a href="/admin/login">Giriş sayfasına git</a></div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="adm-input" style={{ width: 220 }} placeholder='Onay için "imha et" yazın' value={metin} onChange={e => setMetin(e.target.value)} disabled={calisiyor} autoComplete="off" />
          <button type="button" className="adm-btn-primary" style={{ background: 'var(--adm-red)', opacity: hazir && !calisiyor ? 1 : 0.4 }} disabled={!hazir || calisiyor} onClick={imhaEt}>
            {calisiyor ? 'İmha ediliyor…' : 'HER ŞEYİ İMHA ET'}
          </button>
        </div>
      )}
      {hata && <div style={{ color: 'var(--adm-red)', fontSize: 13, marginTop: 8 }}>{hata}</div>}
    </Card>
  )
}

// Yalnızca tablo verilerini siler (dosya, hesap, tablo yapısı ve GitHub kalır; giriş yetkisi tabloları korunur)
function VeriSilKarti() {
  const [metin, setMetin] = useState('')
  const [calisiyor, setCalisiyor] = useState(false)
  const [sonuc, setSonuc] = useState<any>(null)
  const [hata, setHata] = useState('')
  const hazir = metin.trim().toLocaleLowerCase('tr-TR') === 'verileri sil'

  async function sil() {
    if (!hazir || calisiyor) return
    if (!window.confirm('Tüm tablolardaki veriler (cari, fatura, ürün, stok, personel, ayarlar vb.) KALICI olarak silinecek. Dosyalar, hesaplar ve roller kalır. Yedeği aldığınızdan emin misiniz?')) return
    setCalisiyor(true); setHata(''); setSonuc(null)
    try {
      const r = await fetch('/api/admin/imha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ onay: metin, kapsam: 'veri' }) })
      const j = await r.json().catch(() => ({ error: 'Yanıt okunamadı' }))
      if (r.status === 200 || r.status === 207) setSonuc(j)
      else setHata(j.error || `Hata ${r.status}`)
    } catch (e: any) { setHata(e?.message || 'İşlem başarısız') }
    setCalisiyor(false)
  }

  return (
    <Card title={<><AlertTriangle size={15} style={{ color: 'var(--adm-red)' }} />Sadece Verileri Sil</>} pad={16} style={{ border: '1px solid var(--adm-red)' }}>
      <p style={{ margin: '0 0 12px', fontSize: 13 }}>
        Tüm tabloların içindeki kayıtları <b>geri alınamaz</b> şekilde siler (cari, fatura, ürün, stok, personel, ayarlar…). <b>Dosyalar, giriş hesapları, tablo yapısı, GitHub</b> ve giriş yetkisi tabloları (yönetici profilleri, roller) <b>silinmez</b>; panele girmeye devam edersiniz.
      </p>
      {sonuc ? (
        <div style={{ fontSize: 13 }}>
          <b>{sonuc.ok ? 'Veriler silindi.' : 'Kısmen silindi.'}</b> {sonuc.tablo} tablo boşaltıldı.
          {sonuc.hatalar?.length > 0 && <ul style={{ color: 'var(--adm-red)' }}>{sonuc.hatalar.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="adm-input" style={{ width: 220 }} placeholder='Onay için "verileri sil" yazın' value={metin} onChange={e => setMetin(e.target.value)} disabled={calisiyor} autoComplete="off" />
          <button type="button" className="adm-btn-primary" style={{ background: 'var(--adm-red)', opacity: hazir && !calisiyor ? 1 : 0.4 }} disabled={!hazir || calisiyor} onClick={sil}>
            {calisiyor ? 'Siliniyor…' : 'VERİLERİ SİL'}
          </button>
        </div>
      )}
      {hata && <div style={{ color: 'var(--adm-red)', fontSize: 13, marginTop: 8 }}>{hata}</div>}
    </Card>
  )
}
