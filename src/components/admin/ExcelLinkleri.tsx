'use client'
import { FileSpreadsheet, Image as ImageIcon } from 'lucide-react'

// Yapay zekanın cevabında geçen Excel yollarını (/api/admin/...) indirme düğmesine çevirir.
export function excelLinkleri(t: string) {
  const o: { href: string; etiket: string }[] = []
  for (const m of t.matchAll(/\/api\/admin\/(pos-ekstre|fuar-excel|ai-excel|satis-excel|stok-excel|gelir-tablosu)(\?[\w=&-]*)?/g)) {
    if (m[1] === 'gelir-tablosu' && !/format=xlsx/.test(m[0])) continue // görüntü olarak gösterilir
    if (!o.some(x => x.href === m[0])) o.push({ href: m[0], etiket: m[1] === 'pos-ekstre' ? 'POS ekstresini Excel indir' : m[1] === 'fuar-excel' ? 'Fuar listesini Excel indir' : m[1] === 'satis-excel' ? 'Satış listesini Excel indir' : m[1] === 'stok-excel' ? 'Stok listesini Excel indir (depo fişi şablonu)' : m[1] === 'gelir-tablosu' ? 'Gelir tablosunu Excel indir' : 'Excel dosyasını indir' })
  }
  return o
}
export function gorselLinkleri(t: string) {
  const o: string[] = []
  for (const m of t.matchAll(/\/api\/admin\/gelir-tablosu\?ay=\d{4}-\d{2}(?!&format)/g)) if (!o.includes(m[0])) o.push(m[0])
  return o
}

// SVG görüntüyü tarayıcıda PNG'ye çevirip indirir (ek kütüphane gerekmez).
async function pngIndir(href: string) {
  const svg = await (await fetch(href, { credentials: 'same-origin' })).text()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  const img = new Image(); img.src = url; await img.decode()
  const k = 2, c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k
  const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  c.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `gelir-tablosu-${href.slice(-7)}.png`; a.click() }, 'image/png')
}

export default function ExcelDugmeleri({ metin }: { metin: string }) {
  return <>
    {gorselLinkleri(metin).map(h => <div key={h} style={{ marginTop: 8 }}>
      <img src={h} alt="Gelir tablosu" style={{ width: '100%', maxWidth: 680, background: '#fff', border: '1px solid var(--adm-bdr)', borderRadius: 6 }} />
      <div style={{ marginTop: 6 }}><button type="button" className="adm-btn" style={{ display: 'inline-flex' }} onClick={() => pngIndir(h).catch(() => window.open(h, '_blank'))}><ImageIcon size={13} />Görüntüyü indir (PNG)</button></div>
    </div>)}
    {excelLinkleri(metin).map(l => <div key={l.href} style={{ marginTop: 8 }}><a className="adm-btn" style={{ textDecoration: 'none', display: 'inline-flex' }} href={l.href}><FileSpreadsheet size={13} />{l.etiket}</a></div>)}
  </>
}
