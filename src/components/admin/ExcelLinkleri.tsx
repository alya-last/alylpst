import { FileSpreadsheet } from 'lucide-react'

// Yapay zekanın cevabında geçen Excel yollarını (/api/admin/...) indirme düğmesine çevirir.
export function excelLinkleri(t: string) {
  const o: { href: string; etiket: string }[] = []
  for (const m of t.matchAll(/\/api\/admin\/(pos-ekstre|fuar-excel|ai-excel)(\?[\w=&-]*)?/g)) if (!o.some(x => x.href === m[0])) o.push({ href: m[0], etiket: m[1] === 'pos-ekstre' ? 'POS ekstresini Excel indir' : m[1] === 'fuar-excel' ? 'Fuar listesini Excel indir' : 'Excel dosyasını indir' })
  return o
}

export default function ExcelDugmeleri({ metin }: { metin: string }) {
  return <>{excelLinkleri(metin).map(l => <div key={l.href} style={{ marginTop: 8 }}><a className="adm-btn" style={{ textDecoration: 'none', display: 'inline-flex' }} href={l.href}><FileSpreadsheet size={13} />{l.etiket}</a></div>)}</>
}
