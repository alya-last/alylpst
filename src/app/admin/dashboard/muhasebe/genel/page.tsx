'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { muh } from '@/lib/muhasebe-client'
import { fmt, fmtK, fmtDate, daysBetween, fmtPct } from '@/lib/fmt'
import { DONEMLER, donemAralik, sonAylar, pctDelta, CHART_COLORS, AGING, type Donem } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Card, Tabs, Badge, Money, Empty, Skeleton } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { TrendChart, Donut, BarList, StackBar } from '@/components/admin/erp/charts'
import {
  TrendingUp, TrendingDown, Scale, Wallet, HandCoins, Landmark as Bank, AlertTriangle, CalendarClock, RefreshCw, ArrowUpRight, ArrowDownRight,
  Receipt, FileSignature, Users2, CheckCircle2, ChevronRight,
} from 'lucide-react'

// Tüm toplamlar veritabanında hesaplanır (rpc_finans_ozet) — kayıt sayısı milyonlara çıksa da sayfa anında açılır.
export default function MuhasebeGenelPage() {
  const [donem, setDonem] = useState<Donem>('bu_ay')
  const [secildi, setSecildi] = useState(false) // kullanıcı dönemi kendisi seçtiyse otomatik geçiş yapma
  const [grafik, setGrafik] = useState<'aylik' | 'net'>('aylik')
  const [loading, setLoading] = useState(true)
  const [hata, setHata] = useState('')
  const [o, setO] = useState<any>(null)
  const [son, setSon] = useState<any[]>([])
  const [kasalar, setKasalar] = useState<any[]>([])

  const R = useMemo(() => donemAralik(donem), [donem])
  const load = useCallback(async () => {
    setLoading(true); setHata('')
    try {
      const [ozet, s, k] = await Promise.all([
        muh.rpc('rpc_finans_ozet', { p_from: R.from, p_to: R.to, p_pfrom: R.pFrom, p_pto: R.pTo }),
        muh.from('islemler').select('id,tip,kategori,aciklama,tarih,tutar').order('tarih', { ascending: false }).order('created_at', { ascending: false }).limit(7),
        muh.all('kasa_banka_hesaplari', 'id,ad,tip,bakiye,aktif,para_birimi'),
      ])
      setO(ozet); setSon(s.data || []); setKasalar(k)
      // Varsayılan "Bu Ay"da hiç işlem yoksa (ay başı / veri henüz girilmedi) boş ekran yerine "Bu Yıl"a geç.
      if (donem === 'bu_ay' && !secildi && !(+(ozet?.donem?.gelir || 0)) && !(+(ozet?.donem?.gider || 0))) setDonem('yil')
    } catch (e: any) { setHata(e.message || 'Özet alınamadı') }
    setLoading(false)
  }, [R.from, R.to, R.pFrom, R.pTo, donem, secildi])
  useEffect(() => { load() }, [load])

  const aylar = useMemo(() => sonAylar(12), [])
  const aylikMap = useMemo(() => new Map<string, any>((o?.aylik || []).map((a: any) => [a.ay, a])), [o])
  const gelirSeri = aylar.map(a => +(aylikMap.get(a.key)?.gelir || 0)), giderSeri = aylar.map(a => +(aylikMap.get(a.key)?.gider || 0))

  const gelir = +(o?.donem?.gelir || 0), gider = +(o?.donem?.gider || 0)
  const pGelir = +(o?.onceki?.gelir || 0), pGider = +(o?.onceki?.gider || 0)
  const net = gelir - gider, pNet = pGelir - pGider, marj = gelir ? (net / gelir) * 100 : 0
  const f = o?.fatura || {}, cek = o?.cek || {}, cari = o?.cari || {}
  const aging = AGING.map(a => ({ label: a.l, value: +(o?.aging_alacak?.[a.k] || 0), color: a.color }))

  const giderKat = useMemo(() => {
    const e = (o?.kat_gider || []).filter((x: any) => +x.c > 0)
    const top = e.slice(0, 5).map((x: any, i: number) => ({ label: x.k, value: +x.c, color: CHART_COLORS[i] }))
    const rest = e.slice(5).reduce((s: number, x: any) => s + +x.c, 0); if (rest > 0) top.push({ label: 'Diğer', value: rest, color: '#94a3b8' })
    return top
  }, [o])
  const gelirKat = (o?.kat_gelir || []).filter((x: any) => +x.c > 0).slice(0, 6).map((x: any) => ({ label: x.k, value: +x.c, color: 'var(--adm-green)' }))

  const uyarilar: { tone: 'red' | 'amber' | 'blue'; text: string; href: string }[] = []
  if (o) {
    if (+f.gecikmis_adet) uyarilar.push({ tone: 'red', text: `${f.gecikmis_adet} faturanın vadesi geçmiş (${fmtK(+f.gecikmis_tutar)})`, href: '/admin/dashboard/muhasebe/faturalar' })
    if (+cek.gecmis_adet) uyarilar.push({ tone: 'red', text: `${cek.gecmis_adet} çek/senetin vadesi geçmiş, portföyde bekliyor`, href: '/admin/dashboard/muhasebe/cek-senet' })
    if (+cek.karsiliksiz_adet) uyarilar.push({ tone: 'red', text: `${cek.karsiliksiz_adet} karşılıksız çek/senet kaydı var`, href: '/admin/dashboard/muhasebe/cek-senet' })
    if (+cek.yedi_adet) uyarilar.push({ tone: 'amber', text: `${cek.yedi_adet} çek/senet 7 gün içinde vadesi doluyor (${fmtK(+cek.yedi_tutar)})`, href: '/admin/dashboard/muhasebe/cek-senet' })
    ;(o.negatif_kasa || []).forEach((k: any) => uyarilar.push({ tone: 'red', text: `${k.ad} hesabı eksi bakiyede (${fmt(k.bakiye, k.pb || 'TRY')})`, href: '/admin/dashboard/muhasebe/kasa-banka' }))
    if (+f.taslak) uyarilar.push({ tone: 'blue', text: `${f.taslak} taslak fatura onay bekliyor`, href: '/admin/dashboard/muhasebe/faturalar' })
    if (+o.kasa_iliskisiz) uyarilar.push({ tone: 'blue', text: `${o.kasa_iliskisiz} işlem kasa/banka hesabına bağlı değil — bakiyeleri etkilemiyor`, href: '/admin/dashboard/muhasebe/islemler' })
  }
  const donemLabel = donem === 'tumu' ? 'Tüm zamanlar' : DONEMLER.find(d => d.v === donem)?.l
  const cmp = donem === 'tumu' ? undefined : 'önceki döneme göre'

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Muhasebe — Genel Bakış" />
      <Page>
        <PageHead title="Finansal Durum" sub={`Nakit bazlı özet · ${donemLabel}${R.from ? ` (${fmtDate(R.from)} – ${fmtDate(R.to)})` : ''}`}
          actions={<>
            <Tabs tabs={DONEMLER.map(d => ({ v: d.v, l: d.l }))} value={donem} onChange={v => { setSecildi(true); setDonem(v as Donem) }} />
            <button className="adm-btn-ghost" onClick={load} title="Yenile"><RefreshCw size={14} style={loading ? { animation: 'admSpin 1s linear infinite' } : undefined} /></button>
          </>} />

        {hata && <div className="adm-card" style={{ padding: 14, marginBottom: 14, color: 'var(--adm-red)', fontSize: 13 }}>{hata}</div>}
        <Yardim sayfa="genel" />
        {loading && !o ? <KpiGrid>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="adm-kpi"><Skeleton h={10} w={80} /><Skeleton h={24} w={120} style={{ marginTop: 14 }} /></div>)}</KpiGrid> : o && (
          <>
            <KpiGrid min={210}>
              <Kpi label="Gelir" value={fmtK(gelir)} Icon={TrendingUp} color="var(--adm-green)" delta={cmp ? pctDelta(gelir, pGelir) : null} sub={cmp} spark={gelirSeri} />
              <Kpi label="Gider" value={fmtK(gider)} Icon={TrendingDown} color="var(--adm-red)" delta={cmp ? -pctDelta(gider, pGider) : null} sub={cmp} spark={giderSeri} />
              <Kpi label="Net Kâr / Zarar" value={fmtK(net)} Icon={Scale} color={net >= 0 ? 'var(--adm-green)' : 'var(--adm-red)'} delta={cmp ? pctDelta(net, pNet) : null} sub={`Marj ${fmtPct(marj)}`} />
              <Kpi label="Nakit Pozisyonu" value={fmtK(+o.kasa?.toplam)} Icon={Wallet} color="var(--adm-blue)" sub={o.kasa?.kur_eksik ? '⚠ döviz kuru girilmemiş (Kasa/Banka)' : `${o.kasa?.adet || 0} kasa/banka hesabı · TL karşılığı`} />
              <Kpi label="Toplam Alacak" value={fmtK(+cari.alacak)} Icon={HandCoins} color="var(--adm-amber)" sub={`${cari.alacak_adet || 0} müşteri/cari`} />
              <Kpi label="Toplam Borç" value={fmtK(+cari.borc)} Icon={Receipt} color="#8b5cf6" sub={`${cari.borc_adet || 0} tedarikçi/cari`} />
            </KpiGrid>

            <div style={{ marginBottom: 16 }}>
              {uyarilar.length === 0 ? (
                <div className="adm-card" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--adm-green)' }}><CheckCircle2 size={16} />Dikkat gerektiren bir durum yok.</div>
              ) : (
                <div className="adm-card">
                  <div className="adm-card-h"><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={14} style={{ color: 'var(--adm-amber)' }} />Dikkat Gerektirenler ({uyarilar.length})</span></div>
                  {uyarilar.map((u, i) => (
                    <Link key={i} href={u.href} className="adm-row" style={{ textDecoration: 'none', color: 'inherit', padding: '10px 20px' }}>
                      <Badge tone={u.tone}>{u.tone === 'red' ? 'Acil' : u.tone === 'amber' ? 'Yakın' : 'Bilgi'}</Badge>
                      <span style={{ flex: 1, fontSize: 13 }}>{u.text}</span><ChevronRight size={14} style={{ color: 'var(--adm-tx3)' }} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', gap: 16, marginBottom: 16 }}>
              <Card title="Son 12 Ay" right={<Tabs tabs={[{ v: 'aylik', l: 'Gelir / Gider' }, { v: 'net', l: 'Net' }]} value={grafik} onChange={v => setGrafik(v as any)} style={{ padding: 3 }} />} pad={16}>
                {grafik === 'aylik'
                  ? <TrendChart type="bar" labels={aylar.map(a => a.label)} series={[{ name: 'Gelir', color: '#14b088', data: gelirSeri }, { name: 'Gider', color: '#e14b4b', data: giderSeri }]} />
                  : <TrendChart type="area" allowNegative labels={aylar.map(a => a.label)} series={[{ name: 'Net', color: '#2f7dd6', data: gelirSeri.map((g, i) => g - giderSeri[i]) }]} />}
              </Card>
              <Card title="Alacak Yaşlandırma" right={<Link href="/admin/dashboard/muhasebe/raporlar" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Detaylı rapor →</Link>} pad={18}>
                {aging.reduce((s, a) => s + a.value, 0) === 0
                  ? <Empty icon={<CheckCircle2 size={28} />} title="Açık alacak faturası yok" sub="Onaylanmış, tahsil edilmemiş satış faturası bulunmuyor" />
                  : <>
                    <StackBar parts={aging} />
                    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--adm-bdr)', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--adm-tx3)' }}>Toplam açık alacak faturası</span><b>{fmt(+f.acik_alacak)}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 6 }}>
                      <span style={{ color: 'var(--adm-tx3)' }}>Ödenecek tedarikçi faturası</span><b>{fmt(+f.acik_borc)}</b>
                    </div>
                  </>}
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 16, marginBottom: 16 }}>
              <Card title="Gider Dağılımı" pad={18}>{giderKat.length === 0 ? <Empty title="Bu dönemde gider yok" /> : <Donut data={giderKat} center={{ top: 'Toplam', bottom: fmtK(gider) }} />}</Card>
              <Card title="Gelir Kaynakları" pad={18}>{gelirKat.length === 0 ? <Empty title="Bu dönemde gelir yok" /> : <BarList items={gelirKat} />}</Card>
              <Card title={<><CalendarClock size={14} />Yaklaşan Vadeler (30 gün)</>}>
                {(o.vadeler || []).length === 0 ? <Empty title="Yaklaşan vade yok" /> : (o.vadeler || []).map((v: any, i: number) => {
                  const g = daysBetween(v.tarih, new Date())
                  return (
                    <div key={i} className="adm-row" style={{ padding: '10px 16px' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: v.giris ? 'var(--adm-green2)' : 'var(--adm-red2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v.tur === 'cek' ? <FileSignature size={14} style={{ color: v.giris ? 'var(--adm-green)' : 'var(--adm-red)' }} /> : <Receipt size={14} style={{ color: v.giris ? 'var(--adm-green)' : 'var(--adm-red)' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.t}</div>
                        <div style={{ fontSize: 11, color: g > 0 ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>{v.cari || '—'} · {fmtDate(v.tarih)}{g > 0 ? ` · ${g} gün gecikmiş` : g === 0 ? ' · bugün' : ''}</div>
                      </div>
                      <Money v={+v.tutar} tone={v.giris ? 'green' : 'red'} size={12.5} />
                    </div>
                  )
                })}
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 16, marginBottom: 16 }}>
              <Card title={<><Bank size={14} />Kasa / Banka</>} right={<Link href="/admin/dashboard/muhasebe/kasa-banka" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Yönet →</Link>}>
                {kasalar.length === 0 ? <Empty title="Hesap tanımlı değil" sub="Kasa/Banka sayfasından hesap ekle" /> : kasalar.map(k => (
                  <div key={k.id} className="adm-row" style={{ padding: '10px 16px' }}>
                    <Badge tone={k.tip === 'banka' ? 'blue' : 'amber'}>{k.tip === 'banka' ? 'Banka' : 'Kasa'}</Badge>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{k.ad}</span><Money v={+k.bakiye} tone="auto" size={12.5} cur={k.para_birimi || 'TRY'} />
                  </div>
                ))}
              </Card>
              <Card title={<><Users2 size={14} />En Yüksek Bakiyeler</>} right={<Link href="/admin/dashboard/muhasebe/cari" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Cariler →</Link>}>
                {(o.top_alacak || []).length + (o.top_borc || []).length === 0 ? <Empty title="Açık bakiye yok" /> : (
                  <>
                    {(o.top_alacak || []).map((c: any) => <div key={c.id} className="adm-row" style={{ padding: '9px 16px' }}><span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{c.ad}</span><Badge tone="green">Alacak</Badge><Money v={+c.bakiye} tone="green" size={12.5} /></div>)}
                    {(o.top_borc || []).map((c: any) => <div key={c.id} className="adm-row" style={{ padding: '9px 16px' }}><span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{c.ad}</span><Badge tone="red">Borç</Badge><Money v={-c.bakiye} tone="red" size={12.5} /></div>)}
                  </>
                )}
              </Card>
              <Card title="Son İşlemler" right={<Link href="/admin/dashboard/muhasebe/islemler" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Tümü →</Link>}>
                {son.length === 0 ? <Empty title="Henüz işlem yok" /> : son.map(i => (
                  <div key={i.id} className="adm-row" style={{ padding: '9px 16px' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: i.tip === 'gelir' ? 'var(--adm-green2)' : 'var(--adm-red2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {i.tip === 'gelir' ? <ArrowUpRight size={14} style={{ color: 'var(--adm-green)' }} /> : <ArrowDownRight size={14} style={{ color: 'var(--adm-red)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.aciklama || i.kategori}</div>
                      <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{i.kategori} · {fmtDate(i.tarih)}</div>
                    </div>
                    <Money v={+i.tutar} tone={i.tip === 'gelir' ? 'green' : 'red'} sign={i.tip === 'gelir'} size={12.5} />
                  </div>
                ))}
              </Card>
            </div>
          </>
        )}
      </Page>
    </div>
  )
}
