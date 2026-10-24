'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { muh } from '@/lib/muhasebe-client'
import { useAcParam } from '@/lib/ac-param'
import { fmt, fmtK, fmtDate, todayISO } from '@/lib/fmt'
import { sum, iso as _iso } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Money, Modal, Field, FormGrid, Card, Empty, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Sparkline } from '@/components/admin/erp/charts'
import { Plus, Pencil, Trash2, Landmark, Wallet, ArrowLeftRight, Copy, Scale, ArrowUpRight, ArrowDownRight, SlidersHorizontal, Power, Coins, Download } from 'lucide-react'
import { PB, PB_AD, PB_SIM, kasaPb, kurlariYukle, islemAlan, paraGoster } from '@/lib/doviz'

// "3.759.758,49" · "3759758,49" · "3759758.49" · "3,759,758.49" gibi yazımların hepsini sayıya çevirir (boş/geçersiz → NaN)
function trSayi(raw: string): number {
  let t = String(raw ?? '').replace(/[\s₺$€£TLtl]/g, '')
  if (!t || !/^-?[\d.,]+$/.test(t)) return NaN
  const nokta = (t.match(/\./g) || []).length, virgul = (t.match(/,/g) || []).length
  if (nokta && virgul) { // ikisi de var: sonuncusu ondalık ayracıdır
    const ond = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.'
    t = ond === ',' ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (virgul) t = virgul > 1 ? t.replace(/,/g, '') : t.replace(',', '.')
  else if (nokta > 1 || /^-?\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, '') // 3.759.758 / 3.759 → binlik ayracı
  const n = Number(t)
  return isFinite(n) ? n : NaN
}

// TR IBAN doğrulama (mod 97)
function ibanGecerli(v: string) {
  const s = v.replace(/\s/g, '').toUpperCase()
  if (!s) return true
  if (!/^TR\d{24}$/.test(s)) return false
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55))
  let rem = 0; for (const ch of r) rem = (rem * 10 + +ch) % 97
  return rem === 1
}
const ibanFmt = (v: string) => v.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
const bosForm = { tip: 'kasa', ad: '', para_birimi: 'TRY', banka_adi: '', iban: '', acilis: '', notlar: '' }

export default function KasaBankaPage() {
  const toast = useToast()
  const [hesaplar, setHesaplar] = useState<any[]>([])
  const [islemler, setIslemler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sec, setSec] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bosForm)
  const [virman, setVirman] = useState<any>(null)
  const [duzelt, setDuzelt] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [kurlar, setKurlar] = useState<Record<string, number>>({ TRY: 1 })
  const [kurRows, setKurRows] = useState<any[]>([])
  const [kurModal, setKurModal] = useState<any>(null)

  const load = useCallback(async () => {
    const bas = new Date(); bas.setDate(bas.getDate() - 35)
    const [h, i, kr, kRows] = await Promise.all([
      muh.all('kasa_banka_hesaplari', '*', q => q.order('created_at', { ascending: true })),
      // Kart özetleri için yalnızca son 35 gün; tüm geçmiş, seçili hesabın sayfalı listesinde
      muh.all('islemler', 'id,tarih,created_at,tip,tutar,doviz_tutari,kategori,kasa_hesap_id', q => q.gte('tarih', _iso(bas)).order('tarih', { ascending: false }).order('created_at', { ascending: false })),
      kurlariYukle(), muh.all('doviz_kurlari', '*').catch(() => []),
    ])
    setKurlar(kr); setKurRows(kRows); setHesaplar(h); setIslemler(i.filter((x: any) => x.kasa_hesap_id)); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const ay = todayISO().slice(0, 7)
  // Hesap başına: yürüyen bakiyeli hareketler + son 30 gün seri + bu ay giriş/çıkış
  const H = useMemo(() => {
    const out: Record<string, any> = {}
    hesaplar.forEach(h => {
      const mv = islemler.filter(i => i.kasa_hesap_id === h.id)          // tarih azalan (son 35 gün)
      let b = +h.bakiye
      const rows = mv.map(i => { const sg = i.tip === 'gelir' ? 1 : -1; const signed = sg * (+(i.doviz_tutari ?? i.tutar)); const signedTl = sg * +i.tutar; const after = b; b -= signed; return { ...i, signed, signedTl, after } })
      const seri: number[] = []
      for (let d = 29; d >= 0; d--) {
        const dt = new Date(); dt.setDate(dt.getDate() - d); const key = _iso(dt)
        const last = rows.find(r => r.tarih <= key)
        seri.push(last ? last.after : b)                                   // 35 günden eskiyse dönem başı bakiyesi
      }
      out[h.id] = {
        rows, seri,
        giris: sum(rows.filter(r => r.tarih?.startsWith(ay) && r.signed > 0 && r.kategori !== 'Virman'), r => r.signed),
        cikis: sum(rows.filter(r => r.tarih?.startsWith(ay) && r.signed < 0 && r.kategori !== 'Virman'), r => -r.signed),
        girisTl: sum(rows.filter(r => r.tarih?.startsWith(ay) && r.signed > 0 && r.kategori !== 'Virman'), r => r.signedTl),
        cikisTl: sum(rows.filter(r => r.tarih?.startsWith(ay) && r.signed < 0 && r.kategori !== 'Virman'), r => -r.signedTl),
      }
    })
    return out
  }, [hesaplar, islemler, ay])

  const aktif = hesaplar.filter(h => h.aktif !== false)
  // Toplamlar TL karşılığıdır (güncel kurla); kuru girilmemiş döviz hesabı toplama katılmaz ve uyarı verilir
  const tl = (h: any) => +h.bakiye * (kurlar[kasaPb(h)] || 0)
  const toplam = sum(aktif, tl)
  const kasaT = sum(aktif.filter(h => h.tip === 'kasa'), tl)
  const bankaT = sum(aktif.filter(h => h.tip === 'banka'), tl)
  const kurEksik = aktif.some(h => kasaPb(h) !== 'TRY' && !kurlar[kasaPb(h)])
  const dovizToplam = (['USD', 'EUR', 'RUB'] as const).map(pb => ({ pb, t: sum(aktif.filter(h => kasaPb(h) === pb), h => +h.bakiye) })).filter(x => aktif.some(h => kasaPb(h) === x.pb))
  const girisAy = sum(Object.values(H), (x: any) => x.girisTl), cikisAy = sum(Object.values(H), (x: any) => x.cikisTl)
  const secili = hesaplar.find(h => h.id === sec) || null

  /* CRUD */
  const openNew = () => { setEditing(null); setForm(bosForm); setModal(true) }
  useAcParam(!loading, id => { const h = hesaplar.find((x: any) => x.id === id); if (h) openEdit(h) })
  const openEdit = (h: any) => { setEditing(h); setForm({ tip: h.tip, ad: h.ad, para_birimi: kasaPb(h), banka_adi: h.banka_adi || '', iban: h.iban || '', acilis: '', notlar: h.notlar || '' }); setModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (!ibanGecerli(form.iban)) { toast.show('IBAN geçersiz (TR + 24 hane, kontrol basamağı tutmuyor)', true); return }
    setBusy(true)
    const base: any = { tip: form.tip, ad: form.ad.trim(), banka_adi: form.tip === 'banka' ? form.banka_adi || null : null, iban: form.tip === 'banka' ? form.iban.replace(/\s/g, '').toUpperCase() || null : null, notlar: form.notlar || null }
    try {
      if (editing) {
        const r: any = await muh.from('kasa_banka_hesaplari').update({ ...base, updated_at: new Date().toISOString() }).eq('id', editing.id)
        if (r?.error) throw new Error(r.error)
      } else {
        const pb = form.para_birimi || 'TRY'
        const ac0 = +form.acilis
        if (pb !== 'TRY' && ac0 !== 0 && !isNaN(ac0) && !kurlar[pb]) throw new Error(`Önce ${pb} kurunu girin (üstte “Döviz Kurları”) — açılış bakiyesinin TL karşılığı için gerekli`)
        const r: any = await muh.from('kasa_banka_hesaplari').insert({ ...base, para_birimi: pb, bakiye: 0, aktif: true })
        if (r?.error) throw new Error(r.error)
        const id = r.data?.[0]?.id
        const ac = +form.acilis
        if (id && ac !== 0 && !isNaN(ac)) {
          // Açılış bakiyesi defterde görünür bir hareket olarak yazılır (bakiyeyi tetikleyici günceller)
          const ar: any = await muh.from('islemler').insert({ tip: ac > 0 ? 'gelir' : 'gider', kategori: 'Açılış Bakiyesi', ...islemAlan({ para_birimi: pb }, Math.abs(ac), kurlar[pb]), tarih: todayISO(), odeme_yontemi: 'diger', kasa_hesap_id: id, aciklama: 'Hesap açılış bakiyesi' })
          if (ar?.error) throw new Error('Hesap açıldı ama açılış bakiyesi yazılamadı: ' + ar.error)
        }
      }
      setModal(false); toast.show(editing ? 'Hesap güncellendi' : 'Hesap eklendi'); await load()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function toggleAktif(h: any) {
    await muh.from('kasa_banka_hesaplari').update({ aktif: h.aktif === false, updated_at: new Date().toISOString() }).eq('id', h.id)
    toast.show(h.aktif === false ? 'Hesap aktifleştirildi' : 'Hesap pasife alındı'); load()
  }
  async function del(h: any) {
    const cn: any = await muh.from('islemler').select('id', { count: 'exact', head: true }).eq('kasa_hesap_id', h.id)
    if (cn?.count) { toast.show('Hareketi olan hesap silinemez — pasife alabilirsin', true); return }
    if (!confirm(`${h.ad} silinsin mi?`)) return
    const r: any = await muh.from('kasa_banka_hesaplari').delete().eq('id', h.id)
    if (r?.error) { toast.show(r.error, true); return }
    toast.show('Hesap silindi'); if (sec === h.id) setSec(null); load()
  }

  // Virman: farklı para birimleri arasında hedefe geçen tutar (varsayılan güncel kurdan) elle düzeltilebilir
  const virmanHedefOner = (v: any) => {
    const k = hesaplar.find(h => h.id === v.from), h = hesaplar.find(x => x.id === v.to), t = +v.tutar
    if (!k || !h || !(t > 0)) return ''
    if (kasaPb(k) === kasaPb(h)) return String(t)
    const a = kurlar[kasaPb(k)], b = kurlar[kasaPb(h)]
    return a && b ? String(+((t * a) / b).toFixed(2)) : ''
  }
  async function kaydetVirman(e: React.FormEvent) {
    e.preventDefault(); if (busy || !virman) return
    const t = +virman.tutar
    if (!virman.from || !virman.to || virman.from === virman.to) { toast.show('Farklı iki hesap seç', true); return }
    if (!(t > 0)) { toast.show('Tutar gerekli', true); return }
    const kaynak = hesaplar.find(h => h.id === virman.from), hedef = hesaplar.find(h => h.id === virman.to)
    const kp = kasaPb(kaynak), hp = kasaPb(hedef), ayni = kp === hp
    const th = ayni ? t : +(virman.hedefTutar || virmanHedefOner(virman))
    if (!(th > 0)) { toast.show(`${hp} hesabına geçen tutarı girin (kur girilmemiş olabilir)`, true); return }
    if (+kaynak.bakiye < t && !confirm(`${kaynak.ad} bakiyesi (${paraGoster(kaynak.bakiye, kp)}) yetersiz, eksiye düşecek. Devam edilsin mi?`)) return
    // TL karşılığı: TL taraf varsa onun tutarı; yoksa kaynağın güncel kuru (virman raporlara girmez, yalnızca kayıt bütünlüğü için)
    let tlTutar: number
    if (kp === 'TRY') tlTutar = t; else if (hp === 'TRY') tlTutar = th; else if (kurlar[kp]) tlTutar = t * kurlar[kp]; else { toast.show(`${kp} kuru girilmemiş`, true); return }
    setBusy(true)
    try {
      const ortak = { kategori: 'Virman', tarih: virman.tarih, odeme_yontemi: 'havale' }
      const kAl = kp === 'TRY' ? { tutar: tlTutar } : islemAlan(kaynak, t, tlTutar / t)
      const hAl = hp === 'TRY' ? { tutar: tlTutar } : islemAlan(hedef, th, tlTutar / th)
      const not = virman.not ? ` · ${virman.not}` : ''
      const a: any = await muh.from('islemler').insert({ ...ortak, ...kAl, tip: 'gider', kasa_hesap_id: kaynak.id, aciklama: `Virman → ${hedef.ad}${ayni ? '' : ` (${paraGoster(th, hp)})`}${not}` })
      if (a?.error) throw new Error(a.error)
      const b: any = await muh.from('islemler').insert({ ...ortak, ...hAl, tip: 'gelir', kasa_hesap_id: hedef.id, aciklama: `Virman ← ${kaynak.ad}${ayni ? '' : ` (${paraGoster(t, kp)})`}${not}` })
      if (b?.error) { toast.show('Çıkış yazıldı ama giriş yazılamadı: ' + b.error, true); load(); setBusy(false); return }
      toast.show(`${paraGoster(t, kp)} ${kaynak.ad} → ${hedef.ad} aktarıldı`); setVirman(null); load()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function kaydetDuzeltme(e: React.FormEvent) {
    e.preventDefault(); if (busy || !duzelt) return
    const pb = kasaPb(duzelt.hesap), yeni = trSayi(duzelt.yeni), fark = +(yeni - +duzelt.hesap.bakiye).toFixed(2)
    if (isNaN(yeni) || Math.abs(fark) < 0.005) { toast.show('Bakiye zaten aynı', true); return }
    if (pb !== 'TRY' && !kurlar[pb]) { toast.show(`Önce ${pb} kurunu girin (Döviz Kurları)`, true); return }
    // Güvenlik: nokta/virgül hatasıyla bakiyenin yüzlerce kat şişmesini önler
    const eski = +duzelt.hesap.bakiye || 0, tlKarsilik = Math.abs(yeni) * (pb === 'TRY' ? 1 : (kurlar[pb] || 1))
    if ((tlKarsilik > 50_000_000 || (eski > 0 && Math.abs(yeni) > eski * 20 && Math.abs(fark) > 1_000_000)) && !confirm(`DİKKAT: Girdiğin bakiye çok büyük (${paraGoster(yeni, pb)}), mevcut bakiye ${paraGoster(eski, pb)}.\n\nNokta ve virgülü doğru yazdığından emin misin? (örn. 3.759.758,49)`)) return
    setBusy(true)
    const r: any = await muh.from('islemler').insert({ tip: fark > 0 ? 'gelir' : 'gider', kategori: 'Bakiye Düzeltme', ...islemAlan(duzelt.hesap, Math.abs(fark), kurlar[pb]), tarih: todayISO(), odeme_yontemi: 'diger', kasa_hesap_id: duzelt.hesap.id, aciklama: `Sayım/mutabakat düzeltmesi${duzelt.not ? ` · ${duzelt.not}` : ''}` })
    setBusy(false)
    if (r?.error) { toast.show(r.error, true); return }
    toast.show('Bakiye düzeltildi'); setDuzelt(null); load()
  }

  async function tcmbGetir() {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/kurlar'); const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Kurlar alınamadı')
      setKurModal((m: any) => ({ ...m, USD: j.USD ? String(j.USD) : m.USD, EUR: j.EUR ? String(j.EUR) : m.EUR, RUB: j.RUB ? String(j.RUB) : m.RUB, kaynak: 'tcmb', tarih: j.tarih }))
      toast.show(`TCMB döviz satış kuru getirildi${j.tarih ? ` (${j.tarih})` : ''} — kaydetmeyi unutmayın`)
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }
  async function kaydetKurlar(e: React.FormEvent) {
    e.preventDefault(); if (busy || !kurModal) return
    const rows = (['USD', 'EUR', 'RUB'] as const).filter(pb => kurModal[pb] !== '' && kurModal[pb] != null).map(pb => ({ para_birimi: pb, kur: +String(kurModal[pb]).replace(',', '.'), kaynak: kurModal.kaynak || 'manuel', guncelleme: new Date().toISOString() }))
    if (!rows.length || rows.some(r => !(r.kur > 0))) { toast.show('Geçerli bir kur girin', true); return }
    setBusy(true)
    const r: any = await muh.from('doviz_kurlari').upsert(rows)
    setBusy(false)
    if (r?.error) { toast.show(r.error, true); return }
    toast.show('Kurlar kaydedildi'); setKurModal(null); load()
  }

  const cols: Col<any>[] = [
    { key: 'tarih', sortKey: 'tarih', label: 'Tarih', width: 96, render: r => fmtDate(r.tarih), csv: r => r.tarih },
    { key: 'kat', sortKey: 'kategori', label: 'Kategori', csv: r => r.kategori, render: r => <span>{r.kategori}{['Virman', 'Bakiye Düzeltme', 'Açılış Bakiyesi'].includes(r.kategori) && <Badge tone="muted" style={{ marginLeft: 6, fontSize: 9.5 }}>iç hareket</Badge>}</span> },
    { key: 'ac', sortKey: 'aciklama', label: 'Açıklama', csv: r => r.aciklama, render: r => <span style={{ color: 'var(--adm-tx2)' }}>{r.aciklama || '—'}</span>, hideSm: true },
    { key: 'tutar', sortKey: 'signed', label: 'Tutar', align: 'right', render: r => <div><Money v={+r.signed} tone="auto" sign cur={r.para_birimi || 'TRY'} />{r.doviz_tutari != null && <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>≈ {paraGoster(+r.tutar)} · kur {(+r.kur).toLocaleString('tr-TR', { maximumFractionDigits: 4 })}</div>}</div>, csv: r => r.signed },
    { key: 'bakiye', sortKey: 'bakiye_sonra', label: 'Bakiye', align: 'right', render: r => <Money v={+r.bakiye_sonra} bold={false} cur={r.para_birimi || 'TRY'} />, csv: r => r.bakiye_sonra, hideSm: true },
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Kasa / Banka" />
      <Page>
        <PageHead title="Nakit Yönetimi" sub="Kasa ve banka hesapları, hesaplar arası virman, hareket geçmişi"
          actions={<>
            <button className="adm-btn-ghost" onClick={() => setKurModal({ USD: kurlar.USD ? String(kurlar.USD) : '', EUR: kurlar.EUR ? String(kurlar.EUR) : '', RUB: kurlar.RUB ? String(kurlar.RUB) : '', kaynak: 'manuel' })}><Coins size={14} />Döviz Kurları</button>
            <button className="adm-btn-ghost" onClick={() => setVirman({ from: aktif[0]?.id || '', to: aktif[1]?.id || '', tutar: '', hedefTutar: '', tarih: todayISO(), not: '' })} disabled={aktif.length < 2}><ArrowLeftRight size={14} />Virman</button>
            <button className="adm-btn" onClick={openNew}><Plus size={14} />Hesap Ekle</button>
          </>} />

        <Yardim sayfa="kasa-banka" />
        <KpiGrid min={190}>
          <Kpi label="Toplam Nakit (TL karşılığı)" value={fmtK(toplam)} Icon={Wallet} color={toplam >= 0 ? 'var(--adm-blue)' : 'var(--adm-red)'} sub={kurEksik ? '⚠ kuru girilmemiş döviz hesabı var' : dovizToplam.length ? dovizToplam.map(x => `${paraGoster(x.t, x.pb)}`).join(' · ') : `${aktif.length} aktif hesap`} />
          <Kpi label="Kasa" value={fmtK(kasaT)} Icon={Wallet} color="var(--adm-amber)" sub={`${aktif.filter(h => h.tip === 'kasa').length} kasa`} />
          <Kpi label="Banka" value={fmtK(bankaT)} Icon={Landmark} color="var(--adm-ac)" sub={`${aktif.filter(h => h.tip === 'banka').length} banka hesabı`} />
          <Kpi label="Bu Ay Giriş" value={fmtK(girisAy)} Icon={ArrowUpRight} color="var(--adm-green)" sub="virman hariç" />
          <Kpi label="Bu Ay Çıkış" value={fmtK(cikisAy)} Icon={ArrowDownRight} color="var(--adm-red)" sub={`Net ${fmtK(girisAy - cikisAy)}`} />
        </KpiGrid>

        {loading ? null : hesaplar.length === 0 ? (
          <Card><Empty icon={<Landmark size={34} />} title="Henüz hesap tanımlı değil" sub="Kasa ve banka hesaplarını ekle; gelir/gider işlemlerinde seçtiğinde bakiyeler otomatik güncellenir." action={<button className="adm-btn" onClick={openNew}><Plus size={14} />İlk Hesabı Ekle</button>} /></Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14, marginBottom: 18 }}>
            {hesaplar.map(h => {
              const x = H[h.id]; const on = sec === h.id
              return (
                <div key={h.id} onClick={() => setSec(on ? null : h.id)} className="adm-card" style={{ padding: 16, cursor: 'pointer', borderColor: on ? 'var(--adm-ac)' : undefined, boxShadow: on ? '0 0 0 3px var(--adm-ac2)' : undefined, opacity: h.aktif === false ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: h.tip === 'banka' ? 'var(--adm-ac2)' : 'var(--adm-amber2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{h.tip === 'banka' ? <Landmark size={18} style={{ color: 'var(--adm-ac)' }} /> : <Wallet size={18} style={{ color: 'var(--adm-amber)' }} />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.ad}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{h.tip === 'banka' ? (h.banka_adi || 'Banka hesabı') : 'Nakit kasa'}{h.aktif === false && ' · pasif'}</div></div>
                    <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                      <button className="adm-btn-ghost" style={{ padding: '4px 6px' }} onClick={() => openEdit(h)}><Pencil size={11} /></button>
                      <button className="adm-btn-ghost" style={{ padding: '4px 6px' }} title="Aktif/Pasif" onClick={() => toggleAktif(h)}><Power size={11} /></button>
                      <button className="adm-btn-danger" style={{ padding: '4px 6px' }} onClick={() => del(h)}><Trash2 size={11} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                    <div><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Bakiye</div><Money v={+h.bakiye} tone={+h.bakiye < 0 ? 'red' : undefined} size={21} cur={kasaPb(h)} />{kasaPb(h) !== 'TRY' && <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginTop: 3 }}>{kurlar[kasaPb(h)] ? `≈ ${paraGoster(tl(h))} (kur ${kurlar[kasaPb(h)].toLocaleString('tr-TR', { maximumFractionDigits: 4 })})` : 'kur girilmemiş'}</div>}</div>
                    <Sparkline data={x?.seri || []} color={+h.bakiye >= 0 ? 'var(--adm-blue)' : 'var(--adm-red)'} w={92} h={34} />
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11.5, color: 'var(--adm-tx3)' }}>
                    <span style={{ color: 'var(--adm-green)' }}>↑ {kasaPb(h) === 'TRY' ? fmtK(x?.giris || 0) : paraGoster(x?.giris || 0, kasaPb(h))}</span><span style={{ color: 'var(--adm-red)' }}>↓ {kasaPb(h) === 'TRY' ? fmtK(x?.cikis || 0) : paraGoster(x?.cikis || 0, kasaPb(h))}</span><span>bu ay</span>
                  </div>
                  {h.iban && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: 'var(--adm-tx3)' }} onClick={e => e.stopPropagation()}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ibanFmt(h.iban)}</span>
                      <button style={{ background: 'none', border: 'none', color: 'var(--adm-tx3)' }} onClick={() => { navigator.clipboard?.writeText(h.iban); toast.show('IBAN kopyalandı') }}><Copy size={12} /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {secili && (
          <DataGrid rows={[]} cols={cols} rowKey={r => r.id} csvName={`hareketler-${secili.ad}`} title={<span>{secili.ad} — Hareketler</span>} storageKey="kasa-hareket"
            server={{ deps: [secili.id, islemler.length, secili.bakiye], fetch: ({ page, size, q, sort }) => muh.page('v_kasa_hareket', '*', { build: (x: any) => x.eq('kasa_hesap_id', secili.id), search: q, searchIn: ['aciklama', 'kategori'], sort: sort || { key: 'tarih', dir: 'desc' }, tieBreak: 'created_at', page, size }) }}
            searchPlaceholder="Açıklama, kategori..."
            actions={<button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setDuzelt({ hesap: secili, yeni: String(Math.round((+secili.bakiye || 0) * 100) / 100).replace('.', ','), not: '' })}><SlidersHorizontal size={13} />Bakiye Düzelt</button>}
            emptyTitle="Bu hesapta hareket yok" emptySub="Gelir/Gider ekranında bu hesabı seçerek işlem gir" />
        )}
      </Page>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} title={editing ? 'Hesabı Düzenle' : 'Yeni Hesap'} width={520}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[['kasa', 'Kasa', Wallet], ['banka', 'Banka', Landmark]].map(([k, l, I]: any) => <button key={k} type="button" disabled={!!editing} onClick={() => setForm((f: any) => ({ ...f, tip: k }))} className={form.tip === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center' }}><I size={14} />{l}</button>)}
        </div>
        <FormGrid>
          <Field label="Hesap Adı *" span={2}><input className="adm-inp" required autoFocus value={form.ad} onChange={e => setForm((f: any) => ({ ...f, ad: e.target.value }))} placeholder={form.tip === 'kasa' ? 'Merkez Kasa' : 'Ziraat TL Vadesiz'} /></Field>
          <Field label="Para Birimi" span={2} hint={editing ? 'Para birimi hesap açıldıktan sonra değiştirilemez' : 'Dolar/Euro/Ruble kasası için ilgili para birimini seçin; bakiye kendi para biriminde tutulur'}><select className="adm-inp" disabled={!!editing} value={form.para_birimi} onChange={e => setForm((f: any) => ({ ...f, para_birimi: e.target.value }))}>{PB.map(p => <option key={p} value={p}>{PB_AD[p]}</option>)}</select></Field>
          {form.tip === 'banka' && <>
            <Field label="Banka"><input className="adm-inp" value={form.banka_adi} onChange={e => setForm((f: any) => ({ ...f, banka_adi: e.target.value }))} /></Field>
            <Field label="IBAN" hint={form.iban && !ibanGecerli(form.iban) ? 'Geçersiz IBAN' : undefined}><input className="adm-inp" value={form.iban} onChange={e => setForm((f: any) => ({ ...f, iban: e.target.value.toUpperCase() }))} placeholder="TR00 0000 ..." style={form.iban && !ibanGecerli(form.iban) ? { borderColor: 'var(--adm-red)' } : undefined} /></Field>
          </>}
          {!editing && <Field label={`Açılış Bakiyesi (${PB_SIM[(form.para_birimi || 'TRY') as keyof typeof PB_SIM]})`} span={2} hint="Defterde ‘Açılış Bakiyesi’ hareketi olarak görünür"><input type="number" step="0.01" className="adm-inp" value={form.acilis} onChange={e => setForm((f: any) => ({ ...f, acilis: e.target.value }))} placeholder="0,00" /></Field>}
          <Field label="Notlar" span={2}><input className="adm-inp" value={form.notlar} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field>
        </FormGrid>
      </Modal>

      <Modal open={!!virman} onClose={() => setVirman(null)} onSubmit={kaydetVirman} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ArrowLeftRight size={16} />Hesaplar Arası Virman</span>} width={500}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setVirman(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Aktar</button></>}>
        {virman && (() => {
          const k = hesaplar.find(h => h.id === virman.from), h2 = hesaplar.find(h => h.id === virman.to)
          const kp = kasaPb(k), hp = kasaPb(h2), farkli = !!k && !!h2 && kp !== hp
          const oner = virmanHedefOner(virman)
          return <FormGrid>
            <Field label="Çıkış Hesabı"><select className="adm-inp" value={virman.from} onChange={e => setVirman((v: any) => ({ ...v, from: e.target.value, hedefTutar: '' }))}>{aktif.map(h => <option key={h.id} value={h.id}>{h.ad} ({paraGoster(h.bakiye, kasaPb(h))})</option>)}</select></Field>
            <Field label="Giriş Hesabı"><select className="adm-inp" value={virman.to} onChange={e => setVirman((v: any) => ({ ...v, to: e.target.value, hedefTutar: '' }))}>{aktif.map(h => <option key={h.id} value={h.id}>{h.ad} ({paraGoster(h.bakiye, kasaPb(h))})</option>)}</select></Field>
            <Field label={`Tutar (${PB_SIM[kp]}) *`}><input type="number" step="0.01" min="0" required autoFocus className="adm-inp" value={virman.tutar} onChange={e => setVirman((v: any) => ({ ...v, tutar: e.target.value }))} style={{ fontSize: 16, fontWeight: 700 }} /></Field>
            <Field label="Tarih"><input type="date" className="adm-inp" value={virman.tarih} onChange={e => setVirman((v: any) => ({ ...v, tarih: e.target.value }))} /></Field>
            {farkli && <Field label={`Karşı hesaba geçen tutar (${PB_SIM[hp]}) *`} span={2} hint={oner ? `Güncel kurdan tahmin: ${paraGoster(+oner, hp)} — bankanın/kasanın gerçek uyguladığı tutarı yazın` : 'Kur girilmemiş; tutarı elle yazın (dövizden TL’ye çevirdiğiniz gerçek tutar)'}><input type="number" step="0.01" min="0" required className="adm-inp" value={virman.hedefTutar || ''} placeholder={oner} onChange={e => setVirman((v: any) => ({ ...v, hedefTutar: e.target.value }))} /></Field>}
            <Field label="Not" span={2}><input className="adm-inp" value={virman.not} onChange={e => setVirman((v: any) => ({ ...v, not: e.target.value }))} /></Field>
            <p style={{ gridColumn: 'span 2', margin: 0, fontSize: 11.5, color: 'var(--adm-tx3)' }}>Virman kâr/zarar raporlarına yansımaz; iki hesabın bakiyesi kendi para biriminde otomatik güncellenir.{farkli ? ' Farklı para birimleri arasında (ör. dolar → TL bozdurma) aradaki kur farkı raporlara girmez.' : ''}</p>
          </FormGrid>
        })()}
      </Modal>

      <Modal open={!!duzelt} onClose={() => setDuzelt(null)} onSubmit={kaydetDuzeltme} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Scale size={16} />Bakiye Düzeltme</span>} width={460}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setDuzelt(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Düzelt</button></>}>
        {duzelt && <FormGrid cols={1}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-tx2)' }}><b>{duzelt.hesap.ad}</b> sistem bakiyesi: {paraGoster(duzelt.hesap.bakiye, kasaPb(duzelt.hesap))}. Gerçek (sayım/ekstre) bakiyeyi gir; fark, kâr/zarara yansımayan bir düzeltme hareketi olarak yazılır.</p>
          <Field label={`Gerçek Bakiye (${PB_SIM[kasaPb(duzelt.hesap)]})`} hint={isNaN(trSayi(duzelt.yeni)) ? 'Tutarı rakamla yazın, örn. 3.759.758,49' : `Girilen: ${paraGoster(trSayi(duzelt.yeni), kasaPb(duzelt.hesap))} · Fark: ${paraGoster(trSayi(duzelt.yeni) - +duzelt.hesap.bakiye, kasaPb(duzelt.hesap))}`}><input type="text" inputMode="decimal" autoComplete="off" required autoFocus className="adm-inp" value={duzelt.yeni} onChange={e => setDuzelt((d: any) => ({ ...d, yeni: e.target.value }))} style={{ fontSize: 16, fontWeight: 700 }} /></Field>
          <Field label="Not"><input className="adm-inp" value={duzelt.not} onChange={e => setDuzelt((d: any) => ({ ...d, not: e.target.value }))} placeholder="Sayım farkı, mutabakat..." /></Field>
        </FormGrid>}
      </Modal>
      <Modal open={!!kurModal} onClose={() => setKurModal(null)} onSubmit={kaydetKurlar} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Coins size={16} />Döviz Kurları</span>} width={480}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setKurModal(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        {kurModal && <FormGrid>
          <p style={{ gridColumn: 'span 2', margin: 0, fontSize: 12.5, color: 'var(--adm-tx2)' }}>Döviz hesaplarının TL karşılığı (toplam nakit, raporlar) ve yeni hareketlerin varsayılan kuru buradan alınır. 1 döviz = kaç TL:</p>
          <Field label="1 USD = (₺)"><input type="number" step="0.0001" min="0" className="adm-inp" value={kurModal.USD} onChange={e => setKurModal((m: any) => ({ ...m, USD: e.target.value, kaynak: 'manuel' }))} placeholder="41,00" /></Field>
          <Field label="1 EUR = (₺)"><input type="number" step="0.0001" min="0" className="adm-inp" value={kurModal.EUR} onChange={e => setKurModal((m: any) => ({ ...m, EUR: e.target.value, kaynak: 'manuel' }))} placeholder="48,00" /></Field>
          <Field label="1 RUB = (₺)"><input type="number" step="0.0001" min="0" className="adm-inp" value={kurModal.RUB ?? ''} onChange={e => setKurModal((m: any) => ({ ...m, RUB: e.target.value, kaynak: 'manuel' }))} placeholder="0,59" /></Field>
          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="adm-btn-ghost" onClick={tcmbGetir} disabled={busy}><Download size={13} />TCMB’den getir (döviz satış)</button>
            <span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{kurRows.length ? `Son güncelleme: ${kurRows.map((r: any) => `${r.para_birimi} ${new Date(r.guncelleme).toLocaleDateString('tr-TR')}`).join(' · ')}` : 'Henüz kur girilmedi'}</span>
          </div>
        </FormGrid>}
      </Modal>
      {toast.node}
    </div>
  )
}
