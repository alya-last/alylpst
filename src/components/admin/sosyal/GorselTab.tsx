'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { web } from '@/lib/web-data'
import { Card, Field, FormGrid } from '@/components/admin/erp/ui'
import { Download, Upload } from 'lucide-react'

type Toast = { show: (m: string, err?: boolean) => void }
const FORMAT: Record<string, { l: string; w: number; h: number }> = {
  kare: { l: 'Kare (Instagram / Facebook) 1080×1080', w: 1080, h: 1080 },
  dikey: { l: 'Dikey (Instagram) 1080×1350', w: 1080, h: 1350 },
  hikaye: { l: 'Hikâye 1080×1920', w: 1080, h: 1920 },
  linkedin: { l: 'LinkedIn 1200×627', w: 1200, h: 627 },
}
const SABLON: Record<string, { l: string; bg: string; kart: string; yazi: string; alt: string; vurgu: string }> = {
  vitrin: { l: 'Vitrin (krem)', bg: '#e3ddcf', kart: '#ffffff', yazi: '#0b0e0b', alt: '#6b7366', vurgu: '#e55f28' },
  koyu: { l: 'Koyu', bg: '#0b0e0b', kart: '#161a16', yazi: '#f4f1ea', alt: '#a9b0a3', vurgu: '#e55f28' },
  turuncu: { l: 'Turuncu vurgu', bg: '#e55f28', kart: '#ffffff', yazi: '#ffffff', alt: '#fde3d6', vurgu: '#0b0e0b' },
}
const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif'

function satirla(c: CanvasRenderingContext2D, metin: string, maxW: number) {
  const out: string[] = []; let cur = ''
  for (const w of metin.split(/\s+/).filter(Boolean)) {
    const t = cur ? cur + ' ' + w : w
    if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = w } else cur = t
  }
  if (cur) out.push(cur)
  return out
}

function ciz(c: CanvasRenderingContext2D, W: number, H: number, s: { sablon: string; baslik: string; alt: string; etiket: string; alt_bilgi: string; kurulus: string }, img: ImageBitmap | null) {
  const T = SABLON[s.sablon]
  c.clearRect(0, 0, W, H); c.fillStyle = T.bg; c.fillRect(0, 0, W, H)
  const wide = W / H > 1.5, p = Math.round(Math.min(W, H) * 0.06)
  const marka = (x: number, y: number, size: number) => {
    c.textBaseline = 'top'; c.font = `900 ${size}px ${FONT}`; c.fillStyle = T.yazi; c.fillText('ALYA', x, y)
    const w = c.measureText('ALYA').width; c.fillStyle = T.vurgu; c.fillText('PLASTİK', x + w, y)
  }
  const yaziBlok = (x: number, y: number, maxW: number, bs: number, ciz = true) => {
    let cy = y
    if (s.etiket) { if (ciz) { c.font = `700 ${Math.round(bs * 0.42)}px ${FONT}`; c.fillStyle = T.vurgu; c.fillText(s.etiket.toLocaleUpperCase('tr-TR'), x, cy) } cy += bs * 0.75 }
    c.font = `900 ${bs}px ${FONT}`; c.fillStyle = T.yazi
    const satirlar = satirla(c, s.baslik, maxW).slice(0, 3)
    for (const l of satirlar) { if (ciz) c.fillText(l, x, cy); cy += bs * 1.12 }
    if (s.alt) { cy += bs * 0.25; c.font = `400 ${Math.round(bs * 0.48)}px Arial, sans-serif`; c.fillStyle = T.alt; for (const l of satirla(c, s.alt, maxW).slice(0, 3)) { if (ciz) c.fillText(l, x, cy); cy += bs * 0.62 } }
    return cy
  }
  const altBant = (x: number, y: number, w: number, size: number) => {
    c.fillStyle = T.vurgu; c.fillRect(x, y, Math.round(size * 2.2), Math.max(4, Math.round(size * 0.16)))
    c.font = `400 ${size}px Arial, sans-serif`; c.fillStyle = T.alt; c.fillText(s.alt_bilgi, x, y + size * 0.6, w)
  }
  const gorsel = (x: number, y: number, w: number, h: number) => {
    c.fillStyle = T.kart; c.fillRect(x, y, w, h)
    if (!img) { c.fillStyle = T.alt; c.font = `400 ${Math.round(w * 0.04)}px Arial, sans-serif`; c.textAlign = 'center'; c.fillText('Ürün görseli seçin', x + w / 2, y + h / 2); c.textAlign = 'left'; return }
    const r = Math.min((w * 0.86) / img.width, (h * 0.86) / img.height), iw = img.width * r, ih = img.height * r
    c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
  }

  if (wide) {
    marka(p, p, Math.round(H * 0.06))
    if (s.kurulus) { c.font = `700 ${Math.round(H * 0.03)}px ${FONT}`; c.fillStyle = T.alt; c.textAlign = 'right'; c.fillText(s.kurulus, W - p, p + 4); c.textAlign = 'left' }
    const gx = W * 0.5, gy = p + H * 0.14, gh = H - gy - p * 1.9
    gorsel(gx, gy, W - gx - p, gh)
    yaziBlok(p, gy + H * 0.02, gx - p * 2, Math.round(H * 0.085))
    altBant(p, H - p * 1.3, gx - p * 2, Math.round(H * 0.032))
  } else {
    marka(p, p, Math.round(W * 0.05))
    if (s.kurulus) { c.font = `700 ${Math.round(W * 0.026)}px ${FONT}`; c.fillStyle = T.alt; c.textAlign = 'right'; c.fillText(s.kurulus, W - p, p + W * 0.012); c.textAlign = 'left' }
    const story = H / W > 1.6
    const gy = p * 2.3, bs = Math.round(W * (story ? 0.075 : 0.062)), altY = H - p * (story ? 2.4 : 1.6)
    const metinH = yaziBlok(0, 0, W - p * 2, bs, false)
    const bosluk = altY - p * 0.7 - metinH - p * 0.9 - gy
    const gh = Math.round(Math.max(H * 0.3, Math.min(H * (story ? 0.5 : 0.56), bosluk)))
    gorsel(p, gy, W - p * 2, gh)
    yaziBlok(p, gy + gh + p * 0.9, W - p * 2, bs)
    altBant(p, H - p * (story ? 2.4 : 1.6), W - p * 2, Math.round(W * 0.028))
  }
}

export default function GorselTab({ toast, urunId, setUrunId }: { toast: Toast; urunId: string; setUrunId: (id: string) => void }) {
  const [urunler, setUrunler] = useState<any[]>([])
  const [site, setSite] = useState<any>(null)
  const [s, setS] = useState({ sablon: 'vitrin', format: 'kare', baslik: '', alt: 'Toptan ve ihracat için üretim', etiket: 'Toptan · İhracat', alt_bilgi: '', kurulus: '' })
  const [imgUrl, setImgUrl] = useState('')
  const [img, setImg] = useState<ImageBitmap | null>(null)
  const [hata, setHata] = useState('')
  const cv = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    web.from('products').select('id,name,code,image_url,images').order('name').limit(1500).then(({ data }) => setUrunler(data || []))
    web.from('settings').select('value').eq('key', 'site').maybeSingle().then(({ data }) => {
      const v = data?.value; setSite(v)
      setS(x => ({ ...x, alt_bilgi: [v?.export_email || v?.email, v?.phone].filter(Boolean).join('  ·  '), kurulus: v?.founded ? `${v.founded}'den beri` : '' }))
    })
  }, [])

  const urun = useMemo(() => urunler.find(u => u.id === urunId), [urunler, urunId])
  const gorseller: string[] = useMemo(() => Array.from(new Set([urun?.image_url, ...(urun?.images || [])].filter((x: any) => typeof x === 'string' && x))), [urun])
  useEffect(() => { if (urun) { setS(x => ({ ...x, baslik: urun.name })); setImgUrl(gorseller[0] || '') } }, [urunId, urunler]) // eslint-disable-line

  useEffect(() => {
    let iptal = false
    if (!imgUrl) { setImg(null); return }
    setHata('')
    ;(async () => {
      try {
        const r = await fetch(imgUrl, { mode: 'cors' }); if (!r.ok) throw new Error()
        const b = await createImageBitmap(await r.blob()); if (!iptal) setImg(b)
      } catch { if (!iptal) { setImg(null); setHata('Görsel okunamadı. “Kendi görselini yükle” ile cihazınızdan seçin.') } }
    })()
    return () => { iptal = true }
  }, [imgUrl])

  const F = FORMAT[s.format]
  useEffect(() => {
    const c = cv.current; if (!c) return
    c.width = F.w; c.height = F.h
    const ctx = c.getContext('2d'); if (ctx) ciz(ctx, F.w, F.h, s, img)
  }, [s, img, F])

  async function yukle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 15 * 1024 * 1024) return toast.show('PNG, JPG veya WebP (en fazla 15 MB) seçin', true)
    try { setImg(await createImageBitmap(f)); setImgUrl(''); setHata('') } catch { toast.show('Görsel açılamadı', true) }
  }
  function indir() {
    cv.current?.toBlob(b => {
      if (!b) return toast.show('Görsel oluşturulamadı', true)
      const a = document.createElement('a'); a.href = URL.createObjectURL(b)
      a.download = `alya-${(s.baslik || 'gorsel').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${s.format}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    }, 'image/png')
  }
  const set = (k: string, v: string) => setS(x => ({ ...x, [k]: v }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,380px) 1fr', gap: 18, alignItems: 'start' }}>
      <Card title="Görsel ayarları">
        <FormGrid cols={1}>
          <Field label="Ürün"><select className="adm-inp" value={urunId} onChange={e => setUrunId(e.target.value)}><option value="">— Seçin —</option>{urunler.map(u => <option key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</option>)}</select></Field>
          {gorseller.length > 1 && <Field label="Ürün fotoğrafı"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{gorseller.map((g, i) => <img key={g} src={g} alt="" onClick={() => setImgUrl(g)} style={{ width: 54, height: 54, objectFit: 'cover', cursor: 'pointer', border: g === imgUrl ? '2px solid var(--adm-ac)' : '1px solid var(--adm-bd)' }} />)}</div></Field>}
          <Field label="Kendi görselini yükle"><label className="adm-btn-ghost" style={{ cursor: 'pointer', display: 'inline-flex', gap: 6 }}><Upload size={13} />Dosya seç<input type="file" accept="image/png,image/jpeg,image/webp" onChange={yukle} style={{ display: 'none' }} /></label></Field>
          {hata && <p style={{ fontSize: 12, color: 'var(--adm-amber)', margin: 0 }}>{hata}</p>}
          <Field label="Boyut"><select className="adm-inp" value={s.format} onChange={e => set('format', e.target.value)}>{Object.entries(FORMAT).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></Field>
          <Field label="Şablon"><select className="adm-inp" value={s.sablon} onChange={e => set('sablon', e.target.value)}>{Object.entries(SABLON).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></Field>
          <Field label="Üst etiket"><input className="adm-inp" maxLength={40} value={s.etiket} onChange={e => set('etiket', e.target.value)} /></Field>
          <Field label="Başlık"><input className="adm-inp" maxLength={80} value={s.baslik} onChange={e => set('baslik', e.target.value)} /></Field>
          <Field label="Alt metin"><input className="adm-inp" maxLength={120} value={s.alt} onChange={e => set('alt', e.target.value)} /></Field>
          <Field label="Alt bilgi (iletişim)"><input className="adm-inp" maxLength={90} value={s.alt_bilgi} onChange={e => set('alt_bilgi', e.target.value)} /></Field>
          <Field label="Kuruluş notu"><input className="adm-inp" maxLength={30} value={s.kurulus} onChange={e => set('kurulus', e.target.value)} /></Field>
        </FormGrid>
        <button className="adm-btn" style={{ marginTop: 14 }} onClick={indir}><Download size={14} />PNG indir</button>
      </Card>
      <div>
        <canvas ref={cv} style={{ width: '100%', maxWidth: F.h > F.w ? 420 : 620, height: 'auto', border: '1px solid var(--adm-bd)', background: '#fff' }} />
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>Görsel tarayıcınızda oluşturulur ve indirilir; sunucuya yüklenmez. Ürün fotoğrafı arka plansız/beyaz zeminli ise en iyi sonucu verir. Telefon numarası ve metinleri paylaşmadan önce kontrol edin.</p>
      </div>
    </div>
  )
}
