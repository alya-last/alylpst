'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { web } from '@/lib/web-data'
import { fmtDateTime } from '@/lib/fmt'
import { Page, PageHead, Card, useToast } from '@/components/admin/erp/ui'
import { BookOpen, UploadCloud, Trash2, ExternalLink, FileText } from 'lucide-react'

const MAX_BOYUT = 150 * 1024 * 1024 // 150MB

function boyutGoster(b?: number) {
  if (!b) return ''
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(b / 1024)} KB`
}

export default function AdminKatalogPage() {
  const toast = useToast()
  const [katalog, setKatalog] = useState<{ url: string; boyut?: number; guncellenme: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [ilerleme, setIlerleme] = useState(0)
  const dosyaRef = useRef<HTMLInputElement>(null)

  async function yukle() {
    const { data } = await web.from('settings').select('value').eq('key', 'katalog').maybeSingle()
    setKatalog(data?.value ?? null); setLoading(false)
  }
  useEffect(() => { yukle() }, [])

  async function dosyaSec(dosya: File) {
    if (!/\.pdf$/i.test(dosya.name)) return toast.show('Yalnızca PDF dosyası yüklenebilir', true)
    if (dosya.size > MAX_BOYUT) return toast.show('Dosya çok büyük (150MB üstü)', true)
    setYukleniyor(true); setIlerleme(0)
    try {
      const imza = await fetch('/api/admin/katalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eylem: 'imza', dosyaAdi: dosya.name, boyut: dosya.size }) }).then(r => r.json())
      if (imza.error) throw new Error(imza.error)
      const up = await web.storage.from('katalog-dosyalari').uploadToSignedUrl(imza.path, imza.token, dosya)
      if (up.error) throw new Error(up.error.message)
      setIlerleme(100)
      const kaydet = await fetch('/api/admin/katalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eylem: 'kaydet', path: imza.path, boyut: dosya.size }) }).then(r => r.json())
      if (kaydet.error) throw new Error(kaydet.error)
      setKatalog(kaydet.deger)
      toast.show('Katalog güncellendi — sitede /katalog adresinde görünecek')
    } catch (e) { toast.show(e instanceof Error ? e.message : String(e), true) }
    setYukleniyor(false); setIlerleme(0)
    if (dosyaRef.current) dosyaRef.current.value = ''
  }

  async function kaldir() {
    if (!confirm('Katalog PDF\'i kaldırılsın mı? Site üzerindeki /katalog sayfası boş görünecek.')) return
    setYukleniyor(true)
    try {
      const r = await fetch('/api/admin/katalog', { method: 'DELETE' }).then(x => x.json())
      if (r.error) throw new Error(r.error)
      setKatalog(null); toast.show('Katalog kaldırıldı')
    } catch (e) { toast.show(e instanceof Error ? e.message : String(e), true) }
    setYukleniyor(false)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Katalog" />
      <Page>
        <PageHead title="PDF Katalog" sub="Sitedeki /katalog sayfasında sayfaları çevrilebilen dijital katalog — buradan güncellenen PDF anında yayına girer" />

        <Card title={<><BookOpen size={14} />Mevcut katalog</>} style={{ marginBottom: 16 }}>
          <div style={{ padding: 16 }}>
            {loading ? <p style={{ fontSize: 13, color: 'var(--adm-tx3)' }}>Yükleniyor…</p> : katalog ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={22} style={{ color: 'var(--adm-red)' }} /></div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>katalog.pdf {katalog.boyut ? <span style={{ fontWeight: 400, color: 'var(--adm-tx3)', fontSize: 12 }}>· {boyutGoster(katalog.boyut)}</span> : null}</div>
                  <div style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>Son güncelleme: {fmtDateTime(katalog.guncellenme)}</div>
                </div>
                <a href="/katalog" target="_blank" rel="noopener noreferrer" className="adm-btn-ghost" style={{ textDecoration: 'none' }}><ExternalLink size={13} />Sitede Gör</a>
                <button className="adm-btn-danger" disabled={yukleniyor} onClick={kaldir}><Trash2 size={13} />Kaldır</button>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--adm-tx3)' }}>Henüz bir katalog PDF'i yüklenmedi. Yüklenene kadar sitedeki /katalog sayfası boş görünür.</p>
            )}
          </div>
        </Card>

        <Card title={<><UploadCloud size={14} />{katalog ? 'Katalogu Değiştir' : 'Katalog Yükle'}</>}>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', margin: '0 0 12px', lineHeight: 1.6 }}>PDF dosyası yükle — her sayfa sitede çevrilebilir bir kitap gibi gösterilir. En fazla 150MB. Yeni dosya yüklendiğinde eskisinin yerini alır.</p>
            <input ref={dosyaRef} type="file" accept="application/pdf" disabled={yukleniyor}
              onChange={e => { const f = e.target.files?.[0]; if (f) dosyaSec(f) }}
              className="adm-inp" style={{ padding: 8 }} />
            {yukleniyor && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--adm-tx3)' }}>{ilerleme === 100 ? 'Kaydediliyor…' : 'Yükleniyor…'}</div>}
          </div>
        </Card>

        <p style={{ fontSize: 12, color: 'var(--adm-tx3)', marginTop: 16 }}>Ana sayfadaki &quot;Kataloğa Bak&quot; düğmesi bu sayfaya (<Link href="/katalog" target="_blank" style={{ color: 'var(--adm-ac)', fontWeight: 600 }}>/katalog</Link>) yönlendirir.</p>
      </Page>
      {toast.node}
    </div>
  )
}
