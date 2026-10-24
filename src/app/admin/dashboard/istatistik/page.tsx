'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { webAll } from '@/lib/web-data'
import { useUretim } from '@/lib/uretim-utils'
import { fmtInt, fmtN } from '@/lib/fmt'
import { sum, CHART_COLORS } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Card, Empty } from '@/components/admin/erp/ui'
import { Donut, BarList } from '@/components/admin/erp/charts'
import { Package, Star, Sparkles, ImageOff, FileText, ScanLine, Layers, FlaskConical, CheckCircle2, Circle } from 'lucide-react'

export default function IstatistikPage() {
  const { d } = useUretim(['variants', 'receteler'])
  const [products, setProducts] = useState<any[]>([])
  const [cats, setCats] = useState<any[]>([])
  const [ok, setOk] = useState(false)
  useEffect(() => { Promise.all([webAll('products', '*'), webAll('categories', '*', q => q.order('sort_order'))]).then(([p, c]) => { setProducts(p); setCats(c); setOk(true) }) }, [])

  const katSay = useMemo(() => cats.map(c => ({ c, urun: products.filter(p => p.category === c.slug) })), [cats, products])
  const stokKat = useMemo(() => katSay.map(({ c, urun }) => ({ label: c.name, value: sum(d.variants.filter((v: any) => urun.some((p: any) => p.id === v.product_id)), (v: any) => v.stock) })).filter(x => x.value > 0), [katSay, d.variants])
  const kriter = [
    { l: 'Ana görseli var', i: ImageOff, f: (p: any) => !!p.image_url },
    { l: 'Açıklaması var', i: FileText, f: (p: any) => !!(p.description || '').trim() },
    { l: 'Barkodu var', i: ScanLine, f: (p: any) => !!p.barkod },
    { l: 'Stok varyantı var', i: Layers, f: (p: any) => d.variants.some((v: any) => v.product_id === p.id) },
    { l: 'Aktif reçetesi var', i: FlaskConical, f: (p: any) => d.receteler.some((r: any) => r.urun_id === p.id && r.aktif) },
    { l: 'Teknik özellik girilmiş', i: FileText, f: (p: any) => Object.keys(p.specs || {}).length > 0 },
  ]
  const skor = products.length ? kriter.reduce((s, k) => s + products.filter(k.f).length, 0) / (kriter.length * products.length) * 100 : 0
  const eksikler = products.map(p => ({ p, eksik: kriter.filter(k => !k.f(p)).map(k => k.l.replace(' var', '').replace(' girilmiş', '')) })).filter(x => x.eksik.length >= 3).slice(0, 8)

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="İstatistikler" />
      <Page>
        <PageHead title="Katalog İstatistikleri" sub="Ürün kataloğunun doluluk, dağılım ve veri kalitesi durumu" />
        <KpiGrid min={180}>
          <Kpi label="Ürün" value={products.length} Icon={Package} color="var(--adm-ac)" sub={`${cats.length} kategori`} />
          <Kpi label="Öne Çıkan" value={products.filter(p => p.is_featured).length} Icon={Star} color="var(--adm-amber)" />
          <Kpi label="Yeni" value={products.filter(p => p.is_new).length} Icon={Sparkles} color="var(--adm-green)" />
          <Kpi label="Katalog Sağlığı" value={`%${fmtN(skor, 0)}`} Icon={CheckCircle2} color={skor >= 80 ? 'var(--adm-green)' : skor >= 50 ? 'var(--adm-amber)' : 'var(--adm-red)'} sub="veri doluluk skoru" />
          <Kpi label="Toplam Mamul Stok" value={fmtInt(sum(d.variants, (v: any) => v.stock))} Icon={Layers} color="var(--adm-blue)" sub={`${d.variants.length} varyant`} />
        </KpiGrid>
        {!ok ? null : products.length === 0 ? <Card><Empty icon={<Package size={32} />} title="Henüz ürün yok" /></Card> : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap: 16, marginBottom: 16 }}>
            <Card title="Kategoriye Göre Ürün Sayısı" pad={18}><BarList items={katSay.map(({ c, urun }, i) => ({ label: `${c.icon || ''} ${c.name}`, value: urun.length, color: CHART_COLORS[i % 10] }))} format={v => `${v} ürün`} /></Card>
            <Card title="Kategoriye Göre Mamul Stok" pad={18}>{stokKat.length === 0 ? <Empty title="Stok verisi yok" sub="Varyant stokları girildiğinde görünür" /> : <Donut size={160} data={stokKat.map((x, i) => ({ ...x, color: CHART_COLORS[i % 10] }))} center={{ top: 'Toplam', bottom: fmtInt(sum(stokKat, x => x.value)) }} />}</Card>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap: 16 }}>
            <Card title="Veri Kalitesi Kontrolü" pad={0}>
              {kriter.map(k => { const n = products.filter(k.f).length, p = (n / products.length) * 100; return (
                <div key={k.l} className="adm-row" style={{ padding: '11px 18px' }}><k.i size={15} style={{ color: p === 100 ? 'var(--adm-green)' : 'var(--adm-tx3)' }} /><span style={{ flex: 1, fontSize: 13 }}>{k.l}</span>
                  <div style={{ width: 110, height: 6, borderRadius: 4, background: 'var(--adm-s2)', overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: p === 100 ? 'var(--adm-green)' : p >= 50 ? 'var(--adm-amber)' : 'var(--adm-red)' }} /></div><b style={{ fontSize: 12, width: 64, textAlign: 'right' }}>{n}/{products.length}</b></div>) })}
            </Card>
            <Card title="Eksiği Çok Olan Ürünler" right={<Link href="/admin/dashboard/urunler" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Ürünler →</Link>}>
              {eksikler.length === 0 ? <Empty icon={<CheckCircle2 size={28} style={{ color: 'var(--adm-green)' }} />} title="Tüm ürünlerin verisi büyük ölçüde tam" /> : eksikler.map(({ p, eksik }) => (
                <div key={p.id} className="adm-row" style={{ padding: '10px 18px' }}><Circle size={8} style={{ color: 'var(--adm-red)' }} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>Eksik: {eksik.join(', ')}</div></div></div>))}
            </Card>
          </div>
        </>}
      </Page>
    </div>
  )
}
