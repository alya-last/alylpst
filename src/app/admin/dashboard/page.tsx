'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { muh } from '@/lib/muhasebe-client'
import { erp } from '@/lib/erp-client'
import { web } from '@/lib/web-data'
import { useModuller } from '@/lib/use-moduller'
import { byId, SIPARIS_ACIK } from '@/lib/uretim-utils'
import { fmt, fmtK, fmtInt, fmtN, fmtDate, todayISO, daysBetween } from '@/lib/fmt'
import { sum, pctDelta, sonAylar, iso } from '@/lib/muh-utils'
import { Page, Kpi, KpiGrid, Card, Badge, Money, Empty, Skeleton } from '@/components/admin/erp/ui'
import { TrendChart } from '@/components/admin/erp/charts'
import AiOzet from '@/components/admin/AiOzet'
import {
  Wallet, HandCoins, Scale, Factory, AlertTriangle, ClipboardList, Boxes, MessageSquare, Eye, ChevronRight, CheckCircle2, Circle, ScanLine, Receipt, Plus, PackageSearch, Activity, Sparkles, ArrowRight, Truck, Users, WifiOff,
} from 'lucide-react'

type Alert = { tone: 'red' | 'amber' | 'blue'; text: string; href: string; mod: string }

export default function AdminDashboardPage() {
  const { has, email, ready } = useModuller()
  const A = { fin: has('muhasebe'), stok: has('stok'), uretim: has('uretim'), satis: has('satis'), satin: has('satinalma'), kalite: has('kalite'), sevk: has('sevkiyat'), web: has('dashboard'), bordro: has('bordro') }

  // Dashboard büyük tabloları asla tümüyle çekmez: finans/ziyaret özetleri veritabanında (rpc) hesaplanır,
  // operasyon verileri yalnızca açık/güncel kayıtlarla sınırlı sorgulanır.
  const [d, setD] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const g = (k: string): any[] => d[k] || []
  const [fin, setFin] = useState<any>(null)
  const [web_, setWeb] = useState<any>(null)
  const [cariSayi, setCariSayi] = useState(0)
  const [bordroOnceki, setBordroOnceki] = useState<any>(null)
  const [finHata, setFinHata] = useState(false)
  const [webHata, setWebHata] = useState(false)

  useEffect(() => {
    if (!ready) return
    const gunOnce = (n: number) => { const t = new Date(); t.setDate(t.getDate() - n); return t.toISOString() }
    const ilerle = async () => {
      const ops: Promise<any>[] = []; const keys: string[] = []
      const add = (k: string, p: Promise<any>) => { keys.push(k); ops.push(p.then(r => (Array.isArray(r) ? r : r?.data || [])).catch(() => [])) }
      add('products', muh.from('products').select('id,name,code').limit(1000)); add('variants', muh.from('product_variants').select('id,product_id,stock'))
      if (A.stok || A.uretim || A.satin || A.kalite) add('hammaddeler', erp.from('hammaddeler').select('id,kod,ad,mevcut_stok,min_stok,aktif,ortalama_maliyet').limit(1000))
      if (A.uretim) { add('makineler', erp.from('makineler').select('*')); add('kaliplar', erp.from('kaliplar').select('*')); add('receteler', erp.from('urun_receteleri').select('id,urun_id,aktif').limit(1000)); add('hareketler', erp.from('uretim_hareketleri').select('tarih,uretilen_adet,fire_adet').gte('tarih', gunOnce(14)).limit(1000)) }
      if (A.uretim || A.satis || A.kalite) { add('emirler', erp.from('uretim_emirleri').select('*').in('durum', ['planlandi', 'uretimde', 'durduruldu']).limit(1000)); add('emirlerBitmis', erp.from('uretim_emirleri').select('id,no,urun_id,durum,uretilen_miktar,bitis').eq('durum', 'tamamlandi').gte('bitis', gunOnce(90)).limit(1000)) }
      if (A.satis || A.sevk) { add('siparisler', erp.from('satis_siparisleri').select('*').in('durum', SIPARIS_ACIK).limit(1000)) }
      if (A.satin) add('satinalma', erp.from('satinalma_siparisleri').select('*').in('durum', ['beklemede', 'onaylandi', 'yolda']).limit(1000))
      if (A.kalite) add('kalite', erp.from('kalite_kontrol_kayitlari').select('uretim_emri_id,kontrol_tipi').gte('tarih', gunOnce(120)).limit(1000))
      if (A.fin) add('fiyatListeleri', erp.from('fiyat_listeleri').select('id').limit(50))
      if (A.sevk) add('sevkiyatlar', erp.from('sevkiyatlar').select('id,no,tarih,durum,cari_id').in('durum', ['hazirlaniyor', 'yola_cikti']).limit(500))
      const res = await Promise.all(ops)
      const out: Record<string, any[]> = {}; keys.forEach((k, i) => { out[k] = res[i] })
      // açık siparişlerin kalemleri (yalnızca açık siparişler için)
      if ((A.satis || A.sevk) && out.siparisler?.length) {
        const ids = out.siparisler.map((s: any) => s.id); const kal: any[] = []
        for (let i = 0; i < ids.length; i += 80) { const r: any = await erp.from('satis_siparisi_kalemleri').select('siparis_id,miktar,birim_fiyat').in('siparis_id', ids.slice(i, i + 80)); kal.push(...(r.data || [])) }
        out.siparisKalemleri = kal
        const cids = Array.from(new Set(out.siparisler.map((x: any) => x.cari_id).filter(Boolean)))
        if (cids.length) { const c: any = await muh.from('cari_hesaplar').select('id,ad').in('id', cids.slice(0, 200)); out.cariler = c.data || [] }
      }
      if (A.satin && out.satinalma?.length) {
        const ids = out.satinalma.map((s: any) => s.id); const kal: any[] = []
        for (let i = 0; i < ids.length; i += 80) { const r: any = await erp.from('satinalma_siparisi_kalemleri').select('siparis_id,miktar,birim_fiyat,teslim_alinan_miktar').in('siparis_id', ids.slice(i, i + 80)); kal.push(...(r.data || [])) }
        out.satinalmaKalemleri = kal
      }
      setD(out); setLoading(false)
    }
    ilerle().catch(() => setLoading(false))

    if (A.fin) {
      muh.from('cari_hesaplar').select('id', { count: 'exact', head: true }).then((r: any) => setCariSayi(r.count || 0)).catch(() => {})
      const t = new Date(); const bas = new Date(t.getFullYear(), t.getMonth(), 1), pBas = new Date(t.getFullYear(), t.getMonth() - 1, 1), pSon = new Date(t.getFullYear(), t.getMonth(), 0)
      muh.rpc('rpc_finans_ozet', { p_from: iso(bas), p_to: iso(t), p_pfrom: iso(pBas), p_pto: iso(pSon) }).then(setFin).catch(() => { setFinHata(true); setFin({}) })
    }
    if (A.web) {
      Promise.all([web.rpc('rpc_ziyaret_ozet', { p_days: 14 }), web.from('contact_submissions').select('id,name,email,status,created_at,subject').order('created_at', { ascending: false }).limit(50), web.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new')])
        .then(([z, b, n]: any) => setWeb({ ziyaret: z.data, basvurular: b.data || [], yeni: n.count || 0 })).catch(() => { setWebHata(true); setWeb({ ziyaret: null, basvurular: [], yeni: 0 }) })
    }
    if (A.bordro) {
      const t = new Date(); const oncekiAyBas = iso(new Date(t.getFullYear(), t.getMonth() - 1, 1))
      web.from('bordro_donemleri').select('donem,durum').eq('donem', oncekiAyBas).maybeSingle().then(({ data }: any) => setBordroOnceki(data || null), () => setBordroOnceki(null))
    }
  }, [ready]) // eslint-disable-line

  const bugun = todayISO(), ay = bugun.slice(0, 7)
  const isim = email.split('@')[0]
  const saatSel = new Date().getHours() < 12 ? 'Günaydın' : new Date().getHours() < 18 ? 'İyi günler' : 'İyi akşamlar'

  /* ── Finans (rpc_finans_ozet çıktısı) ── */
  const F = useMemo(() => {
    if (!fin || !fin.donem) return null
    const aylar = sonAylar(12); const m = new Map<string, any>((fin.aylik || []).map((a: any) => [a.ay, a]))
    return {
      nakit: +fin.kasa?.toplam || 0, nakitAdet: fin.kasa?.adet || 0, alacak: +fin.cari?.alacak || 0, borc: +fin.cari?.borc || 0,
      gelir: +fin.donem.gelir, gider: +fin.donem.gider, net: +fin.donem.gelir - +fin.donem.gider, netOnceki: +fin.onceki.gelir - +fin.onceki.gider,
      aylar, gelirSeri: aylar.map(a => +(m.get(a.key)?.gelir || 0)), giderSeri: aylar.map(a => +(m.get(a.key)?.gider || 0)),
      gecikmis: { adet: +fin.fatura?.gecikmis_adet || 0, tutar: +fin.fatura?.gecikmis_tutar || 0 }, taslak: +fin.fatura?.taslak || 0,
      cekGecik: +fin.cek?.gecmis_adet || 0, karsiliksiz: +fin.cek?.karsiliksiz_adet || 0, negatif: fin.negatif_kasa || [], vadeler: (fin.vadeler || []).slice(0, 6),
    }
  }, [fin])

  /* ── Operasyon ── */
  const cari = useMemo(() => byId(g('cariler')), [d]) // eslint-disable-line
  const urun = useMemo(() => byId(g('products')), [d]) // eslint-disable-line
  const openS = g('siparisler').filter((s: any) => SIPARIS_ACIK.includes(s.durum))
  const sTutar = (s: any) => sum(g('siparisKalemleri').filter((k: any) => k.siparis_id === s.id), (k: any) => (+k.miktar || 0) * (+k.birim_fiyat || 0))
  const gecS = openS.filter((s: any) => s.teslim_tarihi && s.teslim_tarihi < bugun)
  const hazirBekleyen = g('siparisler').filter((s: any) => s.durum === 'hazir')
  const kritik = g('hammaddeler').filter((h: any) => h.aktif !== false && (+h.mevcut_stok || 0) <= (+h.min_stok || 0))
  // Koli stoğu: min. stok girilmemişse 300 adedin altı uyarı (koli kartları 730 01 ile başlar)
  const KOLI_ESIK = 300
  const azKoli = g('hammaddeler').filter((h: any) => h.aktif !== false && String(h.kod || '').startsWith('730 01') && (+h.mevcut_stok || 0) <= (+h.min_stok || 0) === false && (+h.mevcut_stok || 0) < ((+h.min_stok || 0) > 0 ? +h.min_stok : KOLI_ESIK)).sort((a: any, b: any) => (+a.mevcut_stok || 0) - (+b.mevcut_stok || 0))
  const tukenMamul = g('variants').filter((v: any) => (+v.stock || 0) <= 0)
  const uretimde = g('emirler').filter((e: any) => e.durum === 'uretimde')
  const bugunH = g('hareketler').filter((h: any) => (h.tarih || '').startsWith(bugun))
  const bakimKalip = g('kaliplar').filter((k: any) => k.sonraki_bakim && daysBetween(bugun, k.sonraki_bakim) <= 14)
  const arizaMakine = g('makineler').filter((m: any) => m.durum === 'arizali')
  const gecEmir = g('emirler').filter((e: any) => ['planlandi', 'uretimde', 'durduruldu'].includes(e.durum) && g('siparisler').find((s: any) => s.id === e.siparis_id)?.teslim_tarihi < bugun)
  const gecSatin = g('satinalma').filter((s: any) => ['beklemede', 'onaylandi', 'yolda'].includes(s.durum) && s.beklenen_teslim && s.beklenen_teslim < bugun)
  const kontrolBekleyen = g('emirlerBitmis').filter((e: any) => +e.uretilen_miktar > 0 && !g('kalite').some((k: any) => k.uretim_emri_id === e.id && k.kontrol_tipi === 'son_kontrol'))
  const satinP = useMemo(() => {
    const ks = g('satinalmaKalemleri'); return g('satinalma').reduce((s: number, o: any) => {
      const kalemler = ks.filter((k: any) => k.siparis_id === o.id)
      const kalanTutar = sum(kalemler, (k: any) => Math.max((+k.miktar || 0) - (+k.teslim_alinan_miktar || 0), 0) * (+k.birim_fiyat || 0))
      return s + kalanTutar * (+o.kur || 1)
    }, 0)
  }, [d]) // eslint-disable-line
  const sevkBekleyen = g('sevkiyatlar').filter((s: any) => s.durum === 'hazirlaniyor')
  const bordroAyAdi = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1]
  const bordroUyari = A.bordro && new Date().getDate() > 5 && bordroOnceki?.durum !== 'muhasebelesti'
  const yeniSayi = web_?.yeni || 0
  const bugunZiyaret = +(web_?.ziyaret?.bugun || 0)
  const ziyaret14 = useMemo(() => { const m = new Map<string, number>(((web_?.ziyaret?.gunluk) || []).map((x: any) => [x.g, +x.v])); return Array.from({ length: 14 }, (_, i) => { const t = new Date(); t.setDate(t.getDate() - (13 - i)); const k = iso(t); return { l: `${k.slice(8)}.${k.slice(5, 7)}`, v: m.get(k) || 0 } }) }, [web_])
  const uretim14 = useMemo(() => Array.from({ length: 14 }, (_, i) => { const t = new Date(); t.setDate(t.getDate() - (13 - i)); const k = iso(t); const h = g('hareketler').filter((x: any) => (x.tarih || '').startsWith(k)); return { l: `${k.slice(8)}.${k.slice(5, 7)}`, u: sum(h, (x: any) => x.uretilen_adet), f: sum(h, (x: any) => x.fire_adet) } }), [d]) // eslint-disable-line

  const alerts: Alert[] = []
  if (F) {
    if (F.gecikmis.adet) alerts.push({ tone: 'red', text: `${F.gecikmis.adet} faturanın vadesi geçmiş (${fmtK(F.gecikmis.tutar)})`, href: '/admin/dashboard/muhasebe/faturalar', mod: 'muhasebe' })
    if (F.cekGecik) alerts.push({ tone: 'red', text: `${F.cekGecik} çek/senetin vadesi geçmiş, portföyde`, href: '/admin/dashboard/muhasebe/cek-senet', mod: 'muhasebe' })
    if (F.karsiliksiz) alerts.push({ tone: 'red', text: `${F.karsiliksiz} karşılıksız çek/senet kaydı var`, href: '/admin/dashboard/muhasebe/cek-senet', mod: 'muhasebe' })
    F.negatif.forEach((k: any) => alerts.push({ tone: 'red', text: `${k.ad} hesabı eksi bakiyede (${fmt(k.bakiye)})`, href: '/admin/dashboard/muhasebe/kasa-banka', mod: 'muhasebe' }))
    if (F.taslak) alerts.push({ tone: 'blue', text: `${F.taslak} taslak fatura onay bekliyor`, href: '/admin/dashboard/muhasebe/faturalar', mod: 'muhasebe' })
  }
  if (A.stok && kritik.length) alerts.push({ tone: 'red', text: `${kritik.length} hammadde kritik seviyede: ${kritik.slice(0, 3).map((h: any) => h.ad).join(', ')}${kritik.length > 3 ? '…' : ''}`, href: '/admin/dashboard/stok/hammadde', mod: 'stok' })
  if (A.stok && azKoli.length) alerts.push({ tone: 'amber', text: `${azKoli.length} koli azalıyor, yeni koli gerekebilir: ${azKoli.slice(0, 3).map((h: any) => `${String(h.ad).replace(/^Koli \(Baskılı\) - /, '')} (${+h.mevcut_stok})`).join(', ')}${azKoli.length > 3 ? '…' : ''}`, href: '/admin/dashboard/stok/hammadde', mod: 'stok' })
  if (A.satis && gecS.length) alerts.push({ tone: 'red', text: `${gecS.length} satış siparişinin termini geçmiş`, href: '/admin/dashboard/satis/siparisler', mod: 'satis' })
  if (A.satis && hazirBekleyen.length) alerts.push({ tone: 'amber', text: `${hazirBekleyen.length} sipariş hazır, sevk bekliyor`, href: '/admin/dashboard/sevkiyat', mod: 'sevkiyat' })
  if (A.uretim && arizaMakine.length) alerts.push({ tone: 'red', text: `${arizaMakine.length} makine arızalı: ${arizaMakine.map((m: any) => m.ad).join(', ')}`, href: '/admin/dashboard/uretim/makine', mod: 'uretim' })
  if (A.uretim && bakimKalip.length) alerts.push({ tone: 'amber', text: `${bakimKalip.length} kalıbın bakımı yaklaşıyor/geçmiş`, href: '/admin/dashboard/uretim/kalip', mod: 'uretim' })
  if (A.uretim && gecEmir.length) alerts.push({ tone: 'amber', text: `${gecEmir.length} üretim emri sipariş terminini aşmış durumda`, href: '/admin/dashboard/uretim/emirler', mod: 'uretim' })
  if (A.satin && gecSatin.length) alerts.push({ tone: 'amber', text: `${gecSatin.length} satınalma siparişinin teslimi gecikti`, href: '/admin/dashboard/satinalma/siparisler', mod: 'satinalma' })
  if (A.kalite && kontrolBekleyen.length) alerts.push({ tone: 'amber', text: `${kontrolBekleyen.length} tamamlanan emrin son kalite kontrolü girilmemiş`, href: '/admin/dashboard/kalite/kontrol', mod: 'kalite' })
  if (A.web && yeniSayi) alerts.push({ tone: 'blue', text: `${yeniSayi} yeni başvuru yanıt bekliyor`, href: '/admin/dashboard/basvurular', mod: 'dashboard' })
  if (bordroUyari) alerts.push({ tone: 'amber', text: `${bordroAyAdi} ayı bordrosu henüz onaylanıp muhasebeye işlenmedi`, href: '/admin/dashboard/personel', mod: 'bordro' })
  alerts.sort((a, b) => ({ red: 0, amber: 1, blue: 2 }[a.tone] - { red: 0, amber: 1, blue: 2 }[b.tone]))

  // Kurulum kontrol listesi
  const adimlar = [
    { l: 'Kasa / banka hesabı ekle', ok: (F?.nakitAdet || 0) > 0, href: '/admin/dashboard/muhasebe/kasa-banka', mod: A.fin },
    { l: 'İlk müşteri / tedarikçi carisini ekle', ok: cariSayi > 0, href: '/admin/dashboard/muhasebe/cari', mod: A.fin },
    { l: 'Ürünlere stok varyantı ekle', ok: g('variants').length > 0, href: '/admin/dashboard/varyantlar', mod: true },
    { l: 'Hammaddeleri stok kartı olarak gir (maliyetiyle)', ok: g('hammaddeler').some((h: any) => +h.ortalama_maliyet > 0), href: '/admin/dashboard/stok/hammadde', mod: A.stok },
    { l: 'Makine ve kalıpları tanımla', ok: g('makineler').length > 0 && g('kaliplar').length > 0, href: '/admin/dashboard/uretim/makine', mod: A.uretim },
    { l: 'Ürün reçetesi (BOM) oluştur', ok: g('receteler').length > 0, href: '/admin/dashboard/uretim/recete', mod: A.uretim },
    { l: 'Fiyat listesi oluştur', ok: g('fiyatListeleri').length > 0, href: '/admin/dashboard/muhasebe/fiyat-listeleri', mod: A.fin },
  ].filter(a => a.mod)
  const tamam = adimlar.filter(a => a.ok).length

  const yukleniyor = !ready || loading || (A.fin && !fin)
  const hizli = [
    A.fin && { l: 'Yeni Fatura', href: '/admin/dashboard/muhasebe/faturalar', Icon: Receipt }, A.satis && { l: 'Yeni Sipariş', href: '/admin/dashboard/satis/siparisler', Icon: ClipboardList },
    A.uretim && { l: 'Üretim Emri', href: '/admin/dashboard/uretim/emirler', Icon: Factory }, A.stok && { l: 'Barkod Terminali', href: '/admin/dashboard/stok/barkod', Icon: ScanLine },
    A.uretim && { l: 'Canlı Üretim', href: '/admin/dashboard/uretim/canli', Icon: Activity }, A.satin && { l: 'Satınalma', href: '/admin/dashboard/satinalma/siparisler', Icon: PackageSearch },
  ].filter(Boolean) as any[]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Dashboard" />
      <Page>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.4px' }}>{saatSel}{isim ? `, ${isim}` : ''} 👋</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--adm-tx3)' }}>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Alya Plastik ERP{(finHata || webHata) && <span style={{ color: 'var(--adm-amber)', marginLeft: 8 }}><WifiOff size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Bazı veriler yüklenemedi</span>}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{hizli.map((h: any) => <Link key={h.href + h.l} href={h.href} className="adm-chip" style={{ textDecoration: 'none' }}><h.Icon size={13} />{h.l}</Link>)}</div>
        </div>

        {yukleniyor ? <KpiGrid>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="adm-kpi"><Skeleton h={10} w={80} /><Skeleton h={24} w={120} style={{ marginTop: 14 }} /></div>)}</KpiGrid> : (
          <>
            <KpiGrid min={210}>
              {A.fin && F && <>
                <Kpi label="Nakit Pozisyonu" value={fmtK(F.nakit)} Icon={Wallet} color="var(--adm-blue)" sub={`${F.nakitAdet} hesap`} />
                <Kpi label="Bu Ay Net" value={fmtK(F.net)} Icon={Scale} color={F.net >= 0 ? 'var(--adm-green)' : 'var(--adm-red)'} delta={pctDelta(F.net, F.netOnceki)} sub={`Gelir ${fmtK(F.gelir)}`} spark={F.gelirSeri.map((v: number, i: number) => v - F.giderSeri[i])} />
                <Kpi label="Alacak / Borç" value={fmtK(F.alacak)} Icon={HandCoins} color="var(--adm-amber)" sub={`Borç ${fmtK(F.borc)}`} />
              </>}
              {A.satis && <Kpi label="Açık Sipariş" value={openS.length} Icon={ClipboardList} color="var(--adm-ac)" sub={fmtK(sum(openS, sTutar)) + ' (KDV hariç)'} />}
              {A.uretim && <Kpi label="Üretimde" value={uretimde.length} Icon={Factory} color="var(--adm-blue)" sub={`bugün ${fmtInt(sum(bugunH, (h: any) => h.uretilen_adet))} adet`} />}
              {A.stok && <Kpi label="Kritik Stok" value={kritik.length} Icon={Boxes} color={kritik.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub={kritik.length ? 'hammadde min. altında' : 'Sorun yok'} />}
              {A.satin && g('satinalma').length > 0 && <Kpi label="Açık Satınalma" value={g('satinalma').length} Icon={PackageSearch} color="var(--adm-amber)" sub={fmtK(satinP) + ' bekleyen teslimat'} />}
              {A.sevk && <Kpi label="Sevkiyat Bekleyen" value={sevkBekleyen.length} Icon={Truck} color={sevkBekleyen.length ? 'var(--adm-amber)' : 'var(--adm-green)'} sub={sevkBekleyen.length ? 'yola çıkmamış' : 'Sorun yok'} />}
              {A.web && web_ && <Kpi label="Yeni Başvuru" value={yeniSayi} Icon={MessageSquare} color="var(--adm-green)" sub={`bugün ${bugunZiyaret} ziyaret`} />}
            </KpiGrid>

            <AiOzet />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16, marginBottom: 16 }}>
              <Card title={<><AlertTriangle size={14} style={{ color: alerts.some(a => a.tone === 'red') ? 'var(--adm-red)' : 'var(--adm-amber)' }} />Dikkat Gerektirenler {alerts.length ? `(${alerts.length})` : ''}</>}>
                {alerts.length === 0 ? <Empty icon={<CheckCircle2 size={28} style={{ color: 'var(--adm-green)' }} />} title="Dikkat gerektiren bir durum yok" sub="Tüm göstergeler normal" /> : alerts.slice(0, 9).map((a, i) => (
                  <Link key={i} href={a.href} className="adm-row" style={{ textDecoration: 'none', color: 'inherit', padding: '10px 18px' }}>
                    <Badge tone={a.tone}>{a.tone === 'red' ? 'Acil' : a.tone === 'amber' ? 'Yakın' : 'Bilgi'}</Badge><span style={{ flex: 1, fontSize: 13 }}>{a.text}</span><ChevronRight size={14} style={{ color: 'var(--adm-tx3)' }} />
                  </Link>))}
              </Card>

              {tamam < adimlar.length ? (
                <Card title={<><Sparkles size={14} style={{ color: 'var(--adm-ac)' }} />Kurulum Kontrol Listesi</>} right={<span style={{ fontSize: 12, fontWeight: 700 }}>{tamam}/{adimlar.length}</span>}>
                  <div style={{ padding: '4px 18px 0' }}><div style={{ height: 6, borderRadius: 4, background: 'var(--adm-s2)', overflow: 'hidden' }}><div style={{ width: `${(tamam / Math.max(adimlar.length, 1)) * 100}%`, height: '100%', background: 'var(--adm-ac)', transition: 'width .5s' }} /></div></div>
                  {adimlar.map(a => (
                    <Link key={a.l} href={a.href} className="adm-row" style={{ textDecoration: 'none', color: 'inherit', padding: '9px 18px', opacity: a.ok ? 0.55 : 1 }}>
                      {a.ok ? <CheckCircle2 size={16} style={{ color: 'var(--adm-green)' }} /> : <Circle size={16} style={{ color: 'var(--adm-tx3)' }} />}
                      <span style={{ flex: 1, fontSize: 13, textDecoration: a.ok ? 'line-through' : 'none' }}>{a.l}</span>{!a.ok && <ArrowRight size={14} style={{ color: 'var(--adm-ac)' }} />}
                    </Link>))}
                </Card>
              ) : A.uretim ? (
                <Card title={<><Activity size={14} />Hatta Çalışan Emirler</>} right={<Link href="/admin/dashboard/uretim/canli" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Canlı →</Link>}>
                  {uretimde.length === 0 ? <Empty title="Şu anda hatta emir yok" /> : uretimde.slice(0, 6).map((e: any) => (
                    <div key={e.id} className="adm-row" style={{ padding: '10px 18px' }}><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5 }}>{e.no}</b><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{urun[e.urun_id]?.name}</div></div>
                      <div style={{ width: 90 }}><div style={{ height: 5, borderRadius: 3, background: 'var(--adm-s2)', overflow: 'hidden' }}><div style={{ width: `${Math.min((+e.uretilen_miktar / (+e.planlanan_miktar || 1)) * 100, 100)}%`, height: '100%', background: 'var(--adm-blue)' }} /></div><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', textAlign: 'right' }}>%{fmtN((+e.uretilen_miktar / (+e.planlanan_miktar || 1)) * 100, 0)}</div></div></div>))}
                </Card>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16, marginBottom: 16 }}>
              {A.fin && F && <Card title="Gelir / Gider — Son 12 Ay" right={<Link href="/admin/dashboard/muhasebe/raporlar" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Raporlar →</Link>} pad={16}><TrendChart type="bar" height={200} labels={F.aylar.map((a: any) => a.label)} series={[{ name: 'Gelir', color: '#14b088', data: F.gelirSeri }, { name: 'Gider', color: '#e14b4b', data: F.giderSeri }]} /></Card>}
              {A.uretim && <Card title="Üretim — Son 14 Gün" right={<Link href="/admin/dashboard/uretim/emirler" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Emirler →</Link>} pad={16}><TrendChart type="bar" height={200} labels={uretim14.map(x => x.l)} series={[{ name: 'Üretilen', color: '#2f7dd6', data: uretim14.map(x => x.u) }, { name: 'Fire', color: '#e14b4b', data: uretim14.map(x => x.f) }]} format={n => fmtInt(n)} /></Card>}
              {A.web && web_ && <Card title="Site Ziyareti — Son 14 Gün" right={<Link href="/admin/dashboard/analytics" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Analitik →</Link>} pad={16}>
                {!(web_.ziyaret?.toplam > 0) ? <Empty icon={<Eye size={28} />} title="Henüz ziyaret verisi yok" sub="Site ziyaretleri artık otomatik kaydediliyor" /> : <TrendChart type="area" height={200} labels={ziyaret14.map(x => x.l)} series={[{ name: 'Ziyaret', color: '#8b5cf6', data: ziyaret14.map(x => x.v) }]} format={n => fmtInt(n)} />}</Card>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 16 }}>
              {A.fin && F && <Card title="Yaklaşan Vadeler" right={F.vadeler.length > 0 ? <span style={{ fontSize: 12, fontWeight: 700 }}>{fmtK(sum(F.vadeler, (v: any) => v.giris ? v.tutar : -v.tutar))}</span> : <Link href="/admin/dashboard/muhasebe/genel" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Finans →</Link>}>
                {F.vadeler.length === 0 ? <Empty title="Yaklaşan vade yok" /> : F.vadeler.map((v: any, i: number) => { const gg = daysBetween(v.tarih, new Date()); return (
                  <div key={i} className="adm-row" style={{ padding: '9px 18px' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{v.t}</div><div style={{ fontSize: 11, color: gg > 0 ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>{v.cari ? `${v.cari} · ` : ''}{fmtDate(v.tarih)}{gg > 0 ? ` · ${gg} gün gecikmiş` : ''}</div></div><Money v={v.tutar} tone={v.giris ? 'green' : 'red'} size={12.5} /></div>) })}
              </Card>}
              {A.satis && <Card title="Açık Siparişler (termine göre)" right={<Link href="/admin/dashboard/satis/siparisler" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Tümü →</Link>}>
                {openS.length === 0 ? <Empty title="Açık sipariş yok" /> : [...openS].sort((a: any, b: any) => (a.teslim_tarihi || '9999').localeCompare(b.teslim_tarihi || '9999')).slice(0, 6).map((s: any) => (
                  <div key={s.id} className="adm-row" style={{ padding: '9px 18px' }}><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5 }}>{s.no}</b><div style={{ fontSize: 11, color: s.teslim_tarihi && s.teslim_tarihi < bugun ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>{cari[s.cari_id]?.ad || '—'}{s.teslim_tarihi ? ` · ${fmtDate(s.teslim_tarihi)}` : ''}</div></div><Money v={sTutar(s)} size={12.5} /></div>))}
              </Card>}
              {A.web && web_ && <Card title="Son Başvurular" right={<Link href="/admin/dashboard/basvurular" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Tümü →</Link>}>
                {web_.basvurular.length === 0 ? <Empty icon={<MessageSquare size={28} />} title="Başvuru yok" /> : web_.basvurular.slice(0, 6).map((b: any) => (
                  <Link key={b.id} href="/admin/dashboard/basvurular" className="adm-row" style={{ textDecoration: 'none', color: 'inherit', padding: '9px 18px' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{b.name}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.subject || b.email}</div></div><Badge tone={(b.status || 'new') === 'new' ? 'ac' : (b.status === 'replied' ? 'green' : 'muted')}>{{ new: 'Yeni', read: 'Okundu', replied: 'Yanıtlandı', archived: 'Arşiv' }[(b.status || 'new') as string]}</Badge></Link>))}
              </Card>}
              {A.sevk && <Card title="Sevkiyat Bekleyen" right={<Link href="/admin/dashboard/sevkiyat" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Tümü →</Link>}>
                {sevkBekleyen.length === 0 ? <Empty icon={<Truck size={28} />} title="Bekleyen sevkiyat yok" /> : [...sevkBekleyen].sort((a: any, b: any) => (a.tarih || '').localeCompare(b.tarih || '')).slice(0, 6).map((s: any) => (
                  <Link key={s.id} href="/admin/dashboard/sevkiyat" className="adm-row" style={{ textDecoration: 'none', color: 'inherit', padding: '9px 18px' }}><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5 }}>{s.no}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{cari[s.cari_id]?.ad || '—'}{s.tarih ? ` · ${fmtDate(s.tarih)}` : ''}</div></div><Badge tone="amber">Hazırlanıyor</Badge></Link>))}
              </Card>}
              {bordroUyari && <Card title="Bordro" right={<Link href="/admin/dashboard/personel" style={{ fontSize: 12, color: 'var(--adm-ac)' }}>Personel →</Link>}>
                <div className="adm-row" style={{ padding: '9px 18px' }}><Users size={16} style={{ color: 'var(--adm-amber)', marginRight: 8 }} /><span style={{ fontSize: 13 }}>{bordroAyAdi} ayı bordrosu henüz onaylanmadı</span></div>
              </Card>}
            </div>
          </>
        )}
      </Page>
    </div>
  )
}
