'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { muh } from '@/lib/muhasebe-client'
import { fmt, fmtK, fmtDate, fmtPct, csvDownload, todayISO } from '@/lib/fmt'
import { DONEMLER, donemAralik, pctDelta, sonAylar, AGING, CHART_COLORS, type Donem } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Card, Tabs, Money, Badge, Empty, Skeleton } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { TrendChart, Donut, BarList, StackBar } from '@/components/admin/erp/charts'
import { Download, Printer, Scale, TrendingUp, TrendingDown, Percent, Receipt, Users2, Wallet, BarChart3 } from 'lucide-react'

type DonemO = Donem | 'ozel'
const sum = (a: any[], f: (x: any) => number) => a.reduce((s, x) => s + (+f(x) || 0), 0)

function yazdirTablo(baslik: string, sub: string, basliklar: string[], satirlar: (string | number)[][]) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${baslik}</title><style>
    body{font-family:Arial,sans-serif;color:#0b0e0b;padding:36px;max-width:900px;margin:0 auto}h1{font-size:19px;margin:0}.muted{color:#6b7366;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:7px 6px;font-size:12.5px;border-bottom:1px solid #ddd;text-align:left}th{color:#6b7366;font-size:10.5px;text-transform:uppercase}
    td:not(:first-child),th:not(:first-child){text-align:right}.header{border-bottom:2px solid #e55f28;padding-bottom:12px;margin-bottom:8px}@media print{body{padding:0}}</style></head><body>
    <div class="header"><h1>ALYA PLASTİK — ${baslik}</h1><p class="muted">${sub} · ${new Date().toLocaleDateString('tr-TR')}</p></div>
    <table><thead><tr>${basliklar.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${satirlar.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
  const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
}

// Tüm raporlar veritabanında hesaplanır (rpc_*); yalnızca seçili sekmenin özeti çekilir — milyonlarca kayıtta da hızlıdır.
export default function RaporlarPage() {
  const [rapor, setRapor] = useState('kz')
  const [donem, setDonem] = useState<DonemO>('yil')
  const [ozel, setOzel] = useState({ from: todayISO().slice(0, 8) + '01', to: todayISO() })
  const [veri, setVeri] = useState<any>(null)
  const [hata, setHata] = useState('')

  const R = useMemo(() => {
    if (donem !== 'ozel') return donemAralik(donem)
    const gun = Math.max(1, Math.round((+new Date(ozel.to) - +new Date(ozel.from)) / 86400000) + 1)
    const pTo = new Date(new Date(ozel.from).getTime() - 86400000), pFrom = new Date(pTo.getTime() - (gun - 1) * 86400000)
    return { from: ozel.from, to: ozel.to, pFrom: pFrom.toISOString().slice(0, 10), pTo: pTo.toISOString().slice(0, 10) }
  }, [donem, ozel])
  const label = donem === 'ozel' ? `${fmtDate(R.from)} – ${fmtDate(R.to)}` : DONEMLER.find(d => d.v === donem)?.l

  useEffect(() => {
    setVeri(null); setHata('')
    const p = rapor === 'kz' ? muh.rpc('rpc_finans_ozet', { p_from: R.from, p_to: R.to, p_pfrom: R.pFrom, p_pto: R.pTo })
      : rapor === 'nakit' ? muh.rpc('rpc_kasa_akis', { p_from: R.from, p_to: R.to })
      : rapor === 'kdv' ? muh.rpc('rpc_kdv_ozet', { p_from: R.from, p_to: R.to })
      : rapor === 'yas' ? muh.rpc('rpc_yaslandirma', {})
      : muh.rpc('rpc_satis_analiz', { p_from: R.from, p_to: R.to })
    p.then(setVeri).catch(e => setHata(e.message || 'Rapor alınamadı'))
  }, [rapor, R.from, R.to, R.pFrom, R.pTo])

  const aylar = useMemo(() => sonAylar(12), [])
  const seri = (rows: any[] | undefined, f: string) => { const m = new Map<string, any>((rows || []).map(x => [x.ay, x])); return aylar.map(a => +(m.get(a.key)?.[f] || 0)) }
  const delta = (c: number, p: number) => (R.pFrom ? pctDelta(c, p) : null)

  /* ── K/Z ── */
  const kz = rapor === 'kz' && veri ? veri : null
  const gelir = +(kz?.donem?.gelir || 0), gider = +(kz?.donem?.gider || 0), pGelir = +(kz?.onceki?.gelir || 0), pGider = +(kz?.onceki?.gider || 0)
  const gelirKat: [string, { c: number; p: number }][] = (kz?.kat_gelir || []).map((x: any) => [x.k, { c: +x.c, p: +x.p }])
  const giderKat: [string, { c: number; p: number }][] = (kz?.kat_gider || []).map((x: any) => [x.k, { c: +x.c, p: +x.p }])
  const aylikGelir = seri(kz?.aylik, 'gelir'), aylikGider = seri(kz?.aylik, 'gider')

  /* ── Nakit ── */
  const nk = rapor === 'nakit' && veri ? veri : null
  const hesapAkis = (nk?.hesaplar || []).map((h: any) => { const gir = +h.gir, cik = +h.cik; return { ad: h.ad, gir, cik, net: gir - cik, kapanis: +h.kapanis, acilis: +h.kapanis - (gir - cik) } })

  /* ── Yaşlandırma ── */
  const yasSatirlar: any[] = rapor === 'yas' && Array.isArray(veri) ? veri : []
  const yasToplam = (yon: string) => AGING.map(a => ({ label: a.l, value: sum(yasSatirlar.filter(x => x.yon === yon), x => x[a.k]), color: a.color }))

  const exportKz = () => csvDownload(`kar-zarar-${todayISO()}.csv`, [...gelirKat.map(([k, v]) => ({ Tür: 'Gelir', Kategori: k, Tutar: v.c, 'Önceki dönem': v.p })), ...giderKat.map(([k, v]) => ({ Tür: 'Gider', Kategori: k, Tutar: -v.c, 'Önceki dönem': -v.p }))])
  const tabs = [{ v: 'kz', l: 'Kâr / Zarar' }, { v: 'nakit', l: 'Nakit Akışı' }, { v: 'kdv', l: 'KDV' }, { v: 'yas', l: 'Yaşlandırma' }, { v: 'satis', l: 'Satış Analizi' }]
  const tarihsiz = rapor === 'yas'

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Finansal Raporlar" />
      <Page>
        <PageHead title="Raporlar" sub={`${tarihsiz ? 'Güncel durum' : label} · nakit bazlı · virman, kur farkı ve iç düzeltmeler kâr/zarara dahil değil`}
          actions={tarihsiz ? undefined : <>
            <Tabs tabs={[...DONEMLER.map(d => ({ v: d.v, l: d.l })), { v: 'ozel', l: 'Özel' }]} value={donem} onChange={v => setDonem(v as DonemO)} />
            {donem === 'ozel' && <><input type="date" className="adm-sel" value={ozel.from} onChange={e => setOzel(o => ({ ...o, from: e.target.value }))} /><input type="date" className="adm-sel" value={ozel.to} onChange={e => setOzel(o => ({ ...o, to: e.target.value }))} /></>}
          </>} />
        <Yardim sayfa="raporlar" sekme={rapor} />
        <div style={{ marginBottom: 16 }}><Tabs tabs={tabs} value={rapor} onChange={setRapor} /></div>

        {hata && <div className="adm-card" style={{ padding: 14, color: 'var(--adm-red)', fontSize: 13 }}>{hata}</div>}
        {!veri && !hata ? <KpiGrid>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="adm-kpi"><Skeleton h={10} w={80} /><Skeleton h={24} w={120} style={{ marginTop: 14 }} /></div>)}</KpiGrid> : veri && <>

          {/* ══ KÂR / ZARAR ══ */}
          {kz && <>
            <KpiGrid min={200}>
              <Kpi label="Gelir" value={fmtK(gelir)} Icon={TrendingUp} color="var(--adm-green)" delta={delta(gelir, pGelir)} sub={R.pFrom ? 'önceki döneme göre' : undefined} />
              <Kpi label="Gider" value={fmtK(gider)} Icon={TrendingDown} color="var(--adm-red)" delta={delta(gider, pGider) == null ? null : -delta(gider, pGider)!} sub={R.pFrom ? 'önceki döneme göre' : undefined} />
              <Kpi label="Net Kâr / Zarar" value={fmtK(gelir - gider)} Icon={Scale} color={gelir - gider >= 0 ? 'var(--adm-green)' : 'var(--adm-red)'} delta={delta(gelir - gider, pGelir - pGider)} />
              <Kpi label="Kâr Marjı" value={fmtPct(gelir ? ((gelir - gider) / gelir) * 100 : 0)} Icon={Percent} color="var(--adm-blue)" />
            </KpiGrid>
            <Card title="Gelir Tablosu" right={<><button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={exportKz}><Download size={13} />CSV</button><button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => yazdirTablo('Gelir Tablosu', label || '', ['Kalem', 'Tutar', 'Önceki dönem', 'Değişim'], [['GELİRLER', '', '', ''], ...gelirKat.map(([k, v]) => [k, fmt(v.c), fmt(v.p), fmtPct(pctDelta(v.c, v.p))]), ['Toplam gelir', fmt(gelir), fmt(pGelir), ''], ['GİDERLER', '', '', ''], ...giderKat.map(([k, v]) => [k, fmt(v.c), fmt(v.p), fmtPct(pctDelta(v.c, v.p))]), ['Toplam gider', fmt(gider), fmt(pGider), ''], ['NET KÂR/ZARAR', fmt(gelir - gider), fmt(pGelir - pGider), '']])}><Printer size={13} />Yazdır</button></>}>
              <table className="adm-tbl">
                <thead><tr><th>Kalem</th><th style={{ textAlign: 'right' }}>Bu dönem</th><th style={{ textAlign: 'right' }}>Önceki dönem</th><th style={{ textAlign: 'right' }}>Değişim</th><th style={{ textAlign: 'right' }}>Pay</th></tr></thead>
                <tbody>
                  <tr><td colSpan={5} style={{ background: 'var(--adm-green2)', fontWeight: 700, color: 'var(--adm-green)', fontSize: 11.5, letterSpacing: '.05em' }}>GELİRLER</td></tr>
                  {gelirKat.map(([k, v]) => <tr key={k}><td style={{ paddingLeft: 24 }}>{k}</td><td style={{ textAlign: 'right' }}><Money v={v.c} bold={false} /></td><td style={{ textAlign: 'right', color: 'var(--adm-tx3)' }}>{fmt(v.p)}</td><td style={{ textAlign: 'right' }}>{R.pFrom ? <Badge tone={v.c >= v.p ? 'green' : 'red'}>{fmtPct(pctDelta(v.c, v.p))}</Badge> : '—'}</td><td style={{ textAlign: 'right', color: 'var(--adm-tx3)' }}>{fmtPct(gelir ? (v.c / gelir) * 100 : 0)}</td></tr>)}
                  <tr><td><b>Toplam Gelir</b></td><td style={{ textAlign: 'right' }}><Money v={gelir} tone="green" /></td><td style={{ textAlign: 'right' }}>{fmt(pGelir)}</td><td /><td /></tr>
                  <tr><td colSpan={5} style={{ background: 'var(--adm-red2)', fontWeight: 700, color: 'var(--adm-red)', fontSize: 11.5, letterSpacing: '.05em' }}>GİDERLER</td></tr>
                  {giderKat.map(([k, v]) => <tr key={k}><td style={{ paddingLeft: 24 }}>{k}</td><td style={{ textAlign: 'right' }}><Money v={v.c} bold={false} /></td><td style={{ textAlign: 'right', color: 'var(--adm-tx3)' }}>{fmt(v.p)}</td><td style={{ textAlign: 'right' }}>{R.pFrom ? <Badge tone={v.c <= v.p ? 'green' : 'red'}>{fmtPct(pctDelta(v.c, v.p))}</Badge> : '—'}</td><td style={{ textAlign: 'right', color: 'var(--adm-tx3)' }}>{fmtPct(gider ? (v.c / gider) * 100 : 0)}</td></tr>)}
                  <tr><td><b>Toplam Gider</b></td><td style={{ textAlign: 'right' }}><Money v={gider} tone="red" /></td><td style={{ textAlign: 'right' }}>{fmt(pGider)}</td><td /><td /></tr>
                </tbody>
                <tfoot><tr><td>NET KÂR / ZARAR</td><td style={{ textAlign: 'right' }}><Money v={gelir - gider} tone="auto" size={14} /></td><td style={{ textAlign: 'right' }}>{fmt(pGelir - pGider)}</td><td colSpan={2} /></tr></tfoot>
              </table>
              {gelirKat.length + giderKat.length === 0 && <Empty title="Bu dönemde kayıt yok" />}
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16, marginTop: 16 }}>
              <Card title="Gider Dağılımı" pad={18}>{giderKat.length === 0 ? <Empty title="Gider yok" /> : <Donut data={giderKat.slice(0, 7).map(([k, v], i) => ({ label: k, value: v.c, color: CHART_COLORS[i] }))} center={{ top: 'Toplam', bottom: fmtK(gider) }} />}</Card>
              <Card title="Aylık Net (12 ay)" pad={16}><TrendChart type="area" allowNegative labels={aylar.map(a => a.label)} series={[{ name: 'Net', color: '#2f7dd6', data: aylikGelir.map((g, i) => g - aylikGider[i]) }]} height={200} /></Card>
            </div>
          </>}

          {/* ══ NAKİT AKIŞI ══ */}
          {nk && <>
            <KpiGrid min={200}>
              <Kpi label="Toplam Nakit" value={fmtK(sum(hesapAkis, h => h.kapanis))} Icon={Wallet} color="var(--adm-blue)" sub={`${hesapAkis.length} hesap`} />
              <Kpi label="Dönem Girişi" value={fmtK(sum(hesapAkis, h => h.gir))} Icon={TrendingUp} color="var(--adm-green)" sub="virman dahil, hesaplar arası" />
              <Kpi label="Dönem Çıkışı" value={fmtK(sum(hesapAkis, h => h.cik))} Icon={TrendingDown} color="var(--adm-red)" />
              <Kpi label="Net Nakit Değişimi" value={fmtK(sum(hesapAkis, h => h.net))} Icon={Scale} color={sum(hesapAkis, h => h.net) >= 0 ? 'var(--adm-green)' : 'var(--adm-red)'} />
            </KpiGrid>
            <Card title="12 Aylık Nakit Hareketi (hesaba bağlı işlemler)" pad={16} style={{ marginBottom: 16 }}>
              <TrendChart type="bar" labels={aylar.map(a => a.label)} series={[{ name: 'Giriş', color: '#14b088', data: seri(nk.aylik, 'g') }, { name: 'Çıkış', color: '#e14b4b', data: seri(nk.aylik, 'c') }]} />
            </Card>
            <Card title="Hesap Bazlı Hareket" right={<button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => csvDownload('nakit-akisi.csv', hesapAkis.map((h: any) => ({ Hesap: h.ad, Açılış: h.acilis, Giriş: h.gir, Çıkış: h.cik, Kapanış: h.kapanis })))}><Download size={13} />CSV</button>}>
              <table className="adm-tbl"><thead><tr><th>Hesap</th><th style={{ textAlign: 'right' }}>Açılış</th><th style={{ textAlign: 'right' }}>Giriş</th><th style={{ textAlign: 'right' }}>Çıkış</th><th style={{ textAlign: 'right' }}>Net</th><th style={{ textAlign: 'right' }}>Kapanış</th></tr></thead>
                <tbody>{hesapAkis.map((h: any) => <tr key={h.ad}><td><b>{h.ad}</b></td><td style={{ textAlign: 'right' }}>{fmt(h.acilis)}</td><td style={{ textAlign: 'right' }}><Money v={h.gir} tone="green" bold={false} /></td><td style={{ textAlign: 'right' }}><Money v={h.cik} tone="red" bold={false} /></td><td style={{ textAlign: 'right' }}><Money v={h.net} tone="auto" /></td><td style={{ textAlign: 'right' }}><Money v={h.kapanis} /></td></tr>)}</tbody>
                {hesapAkis.length > 0 && <tfoot><tr><td>Toplam</td><td style={{ textAlign: 'right' }}>{fmt(sum(hesapAkis, h => h.acilis))}</td><td style={{ textAlign: 'right' }}>{fmt(sum(hesapAkis, h => h.gir))}</td><td style={{ textAlign: 'right' }}>{fmt(sum(hesapAkis, h => h.cik))}</td><td style={{ textAlign: 'right' }}>{fmt(sum(hesapAkis, h => h.net))}</td><td style={{ textAlign: 'right' }}>{fmt(sum(hesapAkis, h => h.kapanis))}</td></tr></tfoot>}
              </table>
              {hesapAkis.length === 0 && <Empty title="Kasa/banka hesabı yok" />}
            </Card>
          </>}

          {/* ══ KDV ══ */}
          {rapor === 'kdv' && veri.oran && <>
            <KpiGrid min={210}>
              <Kpi label="Hesaplanan KDV" value={fmtK(+veri.hes)} Icon={Receipt} color="var(--adm-blue)" sub={`${veri.satis_adet} satış faturası`} />
              <Kpi label="İndirilecek KDV" value={fmtK(+veri.ind)} Icon={Receipt} color="var(--adm-amber)" sub={`${veri.alis_adet} alış faturası`} />
              <Kpi label={+veri.hes - +veri.ind >= 0 ? 'Ödenecek KDV' : 'Devreden KDV'} value={fmtK(Math.abs(+veri.hes - +veri.ind))} Icon={Scale} color={+veri.hes - +veri.ind >= 0 ? 'var(--adm-red)' : 'var(--adm-green)'} sub="Hesaplanan − İndirilecek" />
            </KpiGrid>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16 }}>
              <Card title="Aylık KDV (12 ay)" pad={16}><TrendChart type="bar" labels={aylar.map(a => a.label)} series={[{ name: 'Hesaplanan', color: '#2f7dd6', data: seri(veri.aylik, 'h') }, { name: 'İndirilecek', color: '#c9821c', data: seri(veri.aylik, 'i') }]} height={210} /></Card>
              <Card title="KDV Oranına Göre">
                {veri.oran.length === 0 ? <Empty title="Bu dönemde onaylı fatura yok" /> : <table className="adm-tbl"><thead><tr><th>Oran</th><th style={{ textAlign: 'right' }}>Satış matrahı</th><th style={{ textAlign: 'right' }}>Hesaplanan</th><th style={{ textAlign: 'right' }}>İndirilecek</th></tr></thead>
                  <tbody>{veri.oran.map((v: any) => <tr key={v.o}><td><Badge tone="blue">%{v.o}</Badge></td><td style={{ textAlign: 'right' }}>{fmt(+v.matrah)}</td><td style={{ textAlign: 'right' }}>{fmt(+v.h)}</td><td style={{ textAlign: 'right' }}>{fmt(+v.i)}</td></tr>)}</tbody></table>}
              </Card>
            </div>
          </>}

          {/* ══ YAŞLANDIRMA ══ */}
          {rapor === 'yas' && Array.isArray(veri) && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16, marginBottom: 16 }}>
              <Card title="Alacak Yaşlandırma (müşteri)" pad={18}><StackBar parts={yasToplam('alacak')} /></Card>
              <Card title="Borç Yaşlandırma (tedarikçi)" pad={18}><StackBar parts={yasToplam('borc')} /></Card>
            </div>
            <Card title="Cari Bazlı Yaşlandırma" right={<button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => csvDownload('yaslandirma.csv', yasSatirlar.map(x => ({ Cari: x.ad, Yön: x.yon === 'alacak' ? 'Alacak' : 'Borç', ...Object.fromEntries(AGING.map(a => [a.l, x[a.k]])) })))}><Download size={13} />CSV</button>}>
              {yasSatirlar.length === 0 ? <Empty title="Açık fatura yok" sub="Onaylanmış ve tamamı ödenmemiş fatura bulunmuyor" /> : (
                <div style={{ overflow: 'auto' }}><table className="adm-tbl">
                  <thead><tr><th>Cari</th><th>Yön</th>{AGING.map(a => <th key={a.k} style={{ textAlign: 'right' }}>{a.l}</th>)}<th style={{ textAlign: 'right' }}>Toplam</th></tr></thead>
                  <tbody>{yasSatirlar.map(x => (
                    <tr key={x.ad + x.yon}><td><b>{x.ad}</b></td><td><Badge tone={x.yon === 'alacak' ? 'green' : 'red'}>{x.yon === 'alacak' ? 'Alacak' : 'Borç'}</Badge></td>
                      {AGING.map(a => <td key={a.k} style={{ textAlign: 'right', color: +x[a.k] && a.k !== 'guncel' ? a.color : undefined, fontWeight: +x[a.k] && a.k !== 'guncel' ? 700 : 400 }}>{+x[a.k] ? fmt(+x[a.k]) : '—'}</td>)}
                      <td style={{ textAlign: 'right' }}><b>{fmt(sum(AGING, a => x[a.k]))}</b></td></tr>))}</tbody>
                </table></div>)}
            </Card>
          </>}

          {/* ══ SATIŞ ANALİZİ ══ */}
          {rapor === 'satis' && veri.top_musteri && <>
            <KpiGrid min={200}>
              <Kpi label="Satış (KDV dahil)" value={fmtK(+veri.toplam)} Icon={BarChart3} color="var(--adm-green)" sub={`${veri.adet} fatura`} />
              <Kpi label="Ort. Fatura" value={fmtK(+veri.adet ? +veri.toplam / +veri.adet : 0)} Icon={Receipt} color="var(--adm-blue)" />
              <Kpi label="Aktif Müşteri" value={veri.musteri} Icon={Users2} color="var(--adm-ac)" sub="bu dönemde fatura kesilen" />
            </KpiGrid>
            <Card title="Aylık Satış (12 ay)" pad={16} style={{ marginBottom: 16 }}><TrendChart type="area" labels={aylar.map(a => a.label)} series={[{ name: 'Satış', color: '#14b088', data: seri(veri.aylik, 'v') }]} height={200} /></Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap: 16 }}>
              <Card title="En Çok Satın Alan Müşteriler" pad={18}>{veri.top_musteri.length === 0 ? <Empty title="Veri yok" /> : <BarList items={veri.top_musteri.map((x: any, i: number) => ({ label: x.ad, value: +x.v, color: CHART_COLORS[i % 10] }))} />}</Card>
              <Card title="En Çok Satan Ürünler" pad={18}>{veri.top_urun.length === 0 ? <Empty title="Veri yok" /> : <BarList items={veri.top_urun.map((x: any) => ({ label: x.ad, value: +x.v, sub: `${x.q} adet` }))} color="var(--adm-blue)" />}</Card>
            </div>
          </>}
        </>}
      </Page>
    </div>
  )
}
