'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { useAcParam } from '@/lib/ac-param'
import { web } from '@/lib/web-data'
import { Page, PageHead, Badge, Modal, Field, FormGrid, Tabs, Card, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import EvrakGoruntu from '@/components/admin/ihracat/EvrakGoruntu'
import { INCOTERMS, PARA, TUR_AD, bosKalem, bosVeri, dogrula, hesapla, yuvarla, type Dil, type Kalem, type Tur, type Veri } from '@/lib/ihracat-evrak'
import { Plus, Copy, Trash2, Printer, Save, FileText } from 'lucide-react'

const bugun = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
const tarihTR = (t: string) => (t ? t.split('-').reverse().join('.') : '')
const fmt = (n: number, pb: string) => `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)} ${pb}`

type Editor = { id: string | null; no: string; tur: Tur; dil: Dil; siparisId: string | null; v: Veri; tlFiyat: boolean }

export default function IhracatEvraklariPage() {
  const toast = useToast()
  const [evraklar, setEvraklar] = useState<any[]>([])
  const [siparisler, setSiparisler] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [site, setSite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [yeni, setYeni] = useState<{ tur: Tur; dil: Dil; siparisId: string } | null>(null)
  const [ed, setEd] = useState<Editor | null>(null)
  const [sekme, setSekme] = useState('duzenle')
  const [kur, setKur] = useState('')
  const [busy, setBusy] = useState(false)
  const [filtre, setFiltre] = useState('hepsi')

  const yukle = useCallback(async () => {
    const [e, s, c, st] = await Promise.all([
      web.from('ihracat_evraklari').select('id,tur,no,siparis_id,dil,musteri,toplam,para_birimi,created_at,updated_at').order('created_at', { ascending: false }).limit(500),
      web.from('satis_siparisleri').select('id,no,cari_id,tarih,durum').order('created_at', { ascending: false }).limit(500),
      web.from('cari_hesaplar').select('id,ad,adres,vergi_no,telefon,email').limit(5000),
      web.from('settings').select('value').eq('key', 'site').maybeSingle(),
    ])
    if (e.error) toast.show(e.error.message, true)
    setEvraklar(e.data || []); setSiparisler(s.data || []); setCariler(c.data || []); setSite(st.data?.value || null); setLoading(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  const cariId = useMemo(() => Object.fromEntries(cariler.map(c => [c.id, c])), [cariler])
  const ihracatci = () => site ? [site.company, site.address, [site.export_phone || site.phone, site.export_email || site.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n') : ''

  async function olustur() {
    if (!yeni) return
    const v = bosVeri(bugun()); v.ihracatci = ihracatci()
    let tl = false
    if (yeni.siparisId) {
      const sp = siparisler.find(s => s.id === yeni.siparisId), c = sp && cariId[sp.cari_id]
      const [k, sv] = await Promise.all([web.from('satis_siparisi_kalemleri').select('urun_adi,miktar,birim_fiyat').eq('siparis_id', yeni.siparisId), web.from('sevkiyatlar').select('id,koli_sayisi,net_agirlik,brut_agirlik,toplam_m3,palet_sayisi').eq('siparis_id', yeni.siparisId).order('tarih', { ascending: false }).limit(1)])
      v.referans = sp?.no || ''
      if (c) v.alici = [c.ad, c.adres, c.vergi_no ? `Tax No: ${c.vergi_no}` : '', [c.telefon, c.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n')
      v.kalemler = (k.data || []).map((x: any) => ({ ...bosKalem(), aciklama: x.urun_adi || '', miktar: +x.miktar || 0, fiyat: +x.birim_fiyat || 0 }))
      if (!v.kalemler.length) v.kalemler = [bosKalem()]
      tl = v.kalemler.some(x => x.fiyat > 0)
      const s0 = sv.data?.[0]
      if (s0) {
        v.koliToplam = +s0.koli_sayisi || 0; v.netToplam = +s0.net_agirlik || 0; v.brutToplam = +s0.brut_agirlik || 0; v.m3Toplam = +s0.toplam_m3 || 0; v.palet = +s0.palet_sayisi || 0
        const ih = await web.from('ihracat_detaylari').select('incoterm,para_birimi,konteyner_no').eq('sevkiyat_id', s0.id).limit(1)
        const d = ih.data?.[0]; if (d) { if (d.incoterm && INCOTERMS.includes(d.incoterm)) v.incoterm = d.incoterm; if (d.konteyner_no) v.konteynerNo = d.konteyner_no; if (d.para_birimi && PARA.includes(d.para_birimi)) v.paraBirimi = d.para_birimi }
      }
    }
    setEd({ id: null, no: '', tur: yeni.tur, dil: yeni.dil, siparisId: yeni.siparisId || null, v, tlFiyat: tl }); setSekme('duzenle'); setYeni(null); setKur('')
  }

  async function ac(r: any) {
    const { data, error } = await web.from('ihracat_evraklari').select('veri').eq('id', r.id).single()
    if (error) return toast.show(error.message, true)
    setEd({ id: r.id, no: r.no, tur: r.tur, dil: r.dil, siparisId: r.siparis_id, v: { ...bosVeri(bugun()), ...data.veri }, tlFiyat: false }); setSekme('duzenle')
  }
  async function baskaTur(r: any, tur: Tur) {
    const { data, error } = await web.from('ihracat_evraklari').select('veri').eq('id', r.id).single()
    if (error) return toast.show(error.message, true)
    setEd({ id: null, no: '', tur, dil: r.dil, siparisId: r.siparis_id, v: { ...bosVeri(bugun()), ...data.veri, belgeTarihi: bugun(), gecerlilik: '' }, tlFiyat: false }); setSekme('duzenle')
  }
  async function kaydet() {
    if (!ed || busy) return
    const h = dogrula(ed.tur, ed.v)
    const kritik = h.filter(x => !x.includes('önerilir'))
    if (kritik.length) return toast.show(kritik[0], true)
    if (h.length && !confirm(h.join('\n') + '\n\nYine de kaydedilsin mi?')) return
    setBusy(true)
    const s = hesapla(ed.v)
    const { data, error } = await web.rpc('rpc_ihracat_evrak_kaydet', { p_id: ed.id, p_tur: ed.tur, p_siparis_id: ed.siparisId, p_dil: ed.dil, p_veri: ed.v, p_musteri: ed.v.alici.split('\n')[0] || '', p_toplam: ed.tur === 'packing' ? null : s.genel, p_para: ed.tur === 'packing' ? null : ed.v.paraBirimi })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setEd({ ...ed, id: data.id, no: data.no }); toast.show(`Kaydedildi: ${data.no}`); yukle()
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (await web.from('ihracat_evraklari').delete().eq('id', r.id)).error?.message, 'evrak')
    yukle()
    if (hata) return hata
    toast.show(`${silinen} evrak silindi`)
  }
  async function sil(r: any) {
    if (!confirm(`${r.no} silinsin mi? Numara yeniden kullanılmaz.`)) return
    const { error } = await web.from('ihracat_evraklari').delete().eq('id', r.id)
    if (error) return toast.show(error.message, true); yukle()
  }
  function yazdir() { setSekme('onizleme'); setTimeout(() => window.print(), 250) }

  const upd = (p: Partial<Veri>) => setEd(e => e && ({ ...e, v: { ...e.v, ...p } }))
  const updK = (i: number, p: Partial<Kalem>) => setEd(e => e && ({ ...e, v: { ...e.v, kalemler: e.v.kalemler.map((k, j) => j === i ? { ...k, ...p } : k) } }))
  function kurUygula() {
    const k = +kur.replace(',', '.'); if (!(k > 0)) return toast.show('Geçerli bir kur girin (1 döviz = ? TL)', true)
    setEd(e => e && ({ ...e, tlFiyat: false, v: { ...e.v, kalemler: e.v.kalemler.map(x => ({ ...x, fiyat: yuvarla(x.fiyat / k, 4) })) } })); toast.show('Fiyatlar kurla çevrildi')
  }

  const liste = evraklar.filter(e => filtre === 'hepsi' || e.tur === filtre)
  const cols: Col<any>[] = [
    { key: 'no', label: 'No', width: 130, sort: r => r.no, render: r => <b>{r.no}</b> },
    { key: 'tur', label: 'Tür', width: 150, sort: r => r.tur, render: r => <Badge tone={r.tur === 'proforma' ? 'amber' : r.tur === 'commercial' ? 'green' : 'blue'}>{TUR_AD[r.tur as Tur].tr}</Badge> },
    { key: 'mus', label: 'Alıcı', sort: r => r.musteri, render: r => r.musteri || '—' },
    { key: 'top', label: 'Tutar', width: 140, align: 'right', sort: r => +r.toplam || 0, render: r => r.toplam != null ? fmt(+r.toplam, r.para_birimi || '') : '—', hideSm: true },
    { key: 'dil', label: 'Dil', width: 60, render: r => r.dil.toUpperCase(), hideSm: true },
    { key: 'tar', label: 'Tarih', width: 100, sort: r => r.created_at, render: r => tarihTR(r.created_at.slice(0, 10)), hideSm: true },
    { key: 'act', label: '', width: 170, align: 'right', render: r => <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
      {r.tur === 'proforma' && <button className="adm-btn-ghost" style={{ padding: '3px 7px', fontSize: 11 }} title="Bu proformadan ticari fatura oluştur" onClick={() => baskaTur(r, 'commercial')}><Copy size={11} />CI</button>}
      {r.tur !== 'packing' && <button className="adm-btn-ghost" style={{ padding: '3px 7px', fontSize: 11 }} title="Bu evraktan çeki listesi oluştur" onClick={() => baskaTur(r, 'packing')}><Copy size={11} />PL</button>}
      <button className="adm-btn-danger" style={{ padding: '3px 7px' }} onClick={() => sil(r)}><Trash2 size={12} /></button></span> },
  ]
  const s = ed ? hesapla(ed.v) : null

  useAcParam(!loading, async id => { let r = evraklar.find((x: any) => x.id === id); if (!r) r = (await web.from('ihracat_evraklari').select('id,tur,no,siparis_id,dil,musteri,toplam,para_birimi,created_at,updated_at').eq('id', id).maybeSingle()).data; if (r) ac(r) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <style>{`@media print { body * { visibility: hidden !important; } #evrak-alani, #evrak-alani * { visibility: visible !important; } #evrak-alani { position: absolute !important; left: 0; top: 0; box-shadow: none !important; width: 100% !important; min-height: 0 !important; } @page { size: A4; margin: 0 } }`}</style>
      <AdminTopBar title="İhracat Evrakları" />
      <Page>
        <PageHead title="İhracat Evrakları" sub="Proforma Invoice · Commercial Invoice · Packing List — satış siparişinden hazırla, Türkçe/İngilizce, yazdır veya PDF olarak kaydet"
          actions={<button className="adm-btn" onClick={() => setYeni({ tur: 'proforma', dil: 'en', siparisId: '' })}><Plus size={14} />Yeni Evrak</button>} />
        <div style={{ marginBottom: 12 }}><Tabs value={filtre} onChange={setFiltre} tabs={[{ v: 'hepsi', l: 'Tümü', n: evraklar.length }, { v: 'proforma', l: 'Proforma', n: evraklar.filter(e => e.tur === 'proforma').length }, { v: 'commercial', l: 'Ticari Fatura', n: evraklar.filter(e => e.tur === 'commercial').length }, { v: 'packing', l: 'Çeki Listesi', n: evraklar.filter(e => e.tur === 'packing').length }]} /></div>
        <DataGrid rows={liste} cols={cols} rowKey={r => r.id} loading={loading} onBulkDelete={topluSil} deleteNoun="evrak" deleteNote="Evrak numaraları yeniden kullanılmaz." csvName="ihracat-evraklari" storageKey="ihracat-evraklari" onRowClick={ac}
          searchText={r => `${r.no} ${r.musteri}`} searchPlaceholder="Evrak no, alıcı…" emptyTitle="Evrak yok" emptySub="“Yeni Evrak” ile bir satış siparişinden proforma veya çeki listesi oluşturun" />
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>Evraklar bilgilendirme ve ticari belge taslağıdır; gümrük beyanı için GTİP, menşei ve ağırlık bilgilerini gümrük müşavirinizle doğrulayın. Yazdırma penceresinde “PDF olarak kaydet”i seçerek PDF alabilirsiniz.</p>
      </Page>

      <Modal open={!!yeni} onClose={() => setYeni(null)} width={520} title="Yeni İhracat Evrakı"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setYeni(null)}>İptal</button><button type="button" className="adm-btn" onClick={olustur}><FileText size={13} />Oluştur</button></>}>
        {yeni && <FormGrid cols={2}>
          <Field label="Evrak türü"><select className="adm-inp" value={yeni.tur} onChange={e => setYeni({ ...yeni, tur: e.target.value as Tur })}>{(Object.keys(TUR_AD) as Tur[]).map(t => <option key={t} value={t}>{TUR_AD[t].tr} ({TUR_AD[t].en})</option>)}</select></Field>
          <Field label="Dil"><select className="adm-inp" value={yeni.dil} onChange={e => setYeni({ ...yeni, dil: e.target.value as Dil })}><option value="en">İngilizce</option><option value="tr">Türkçe</option></select></Field>
          <Field label="Satış siparişi (isteğe bağlı)" span={2} hint="Seçerseniz alıcı, kalemler ve varsa sevkiyat/koli bilgileri otomatik dolar"><select className="adm-inp" value={yeni.siparisId} onChange={e => setYeni({ ...yeni, siparisId: e.target.value })}><option value="">— Boş evrak —</option>{siparisler.map(sp => <option key={sp.id} value={sp.id}>{sp.no} — {cariId[sp.cari_id]?.ad || 'cari yok'} ({tarihTR(sp.tarih)})</option>)}</select></Field>
        </FormGrid>}
      </Modal>

      <Modal open={!!ed} onClose={() => setEd(null)} width={1000} title={ed ? `${TUR_AD[ed.tur].tr} ${ed.no ? '· ' + ed.no : '· yeni (kaydedilmedi)'}` : ''}
        footer={ed && <><button type="button" className="adm-btn-ghost" onClick={() => setEd(null)}>Kapat</button><button type="button" className="adm-btn-ghost" onClick={yazdir}><Printer size={13} />Yazdır / PDF</button><button type="button" className="adm-btn" disabled={busy} onClick={kaydet}><Save size={13} />{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></>}>
        {ed && s && <>
          <Tabs value={sekme} onChange={setSekme} style={{ marginBottom: 12 }} tabs={[{ v: 'duzenle', l: 'Düzenle' }, { v: 'onizleme', l: 'Önizleme' }]} />
          {sekme === 'onizleme' ? <div style={{ overflow: 'auto', background: '#888', padding: 12 }}><EvrakGoruntu tur={ed.tur} dil={ed.dil} v={ed.v} no={ed.no} /></div> : (<div style={{ display: 'grid', gap: 12 }}>
            {ed.tlFiyat && <div style={{ padding: 10, background: 'rgba(229,150,40,.12)', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              Sipariş fiyatları <b>TL</b> cinsinden geldi. {ed.tur !== 'packing' && <>Kur girip döviz fiyatına çevirin: 1 {ed.v.paraBirimi} = <input className="adm-inp" style={{ width: 90 }} value={kur} onChange={e => setKur(e.target.value)} placeholder="örn. 34,50" /> TL <button type="button" className="adm-btn-ghost" onClick={kurUygula}>Çevir</button></>}</div>}
            <FormGrid cols={4}>
              <Field label="Evrak dili"><select className="adm-inp" value={ed.dil} onChange={e => setEd({ ...ed, dil: e.target.value as Dil })}><option value="en">İngilizce</option><option value="tr">Türkçe</option></select></Field>
              <Field label="Tarih"><input type="date" className="adm-inp" value={ed.v.belgeTarihi} onChange={e => upd({ belgeTarihi: e.target.value })} /></Field>
              {ed.tur === 'proforma' ? <Field label="Geçerlilik"><input type="date" className="adm-inp" value={ed.v.gecerlilik} onChange={e => upd({ gecerlilik: e.target.value })} /></Field> : <div />}
              <Field label="Sipariş / PO no"><input className="adm-inp" value={ed.v.referans} onChange={e => upd({ referans: e.target.value })} /></Field>
              <Field label="İhracatçı *" span={2}><textarea className="adm-inp" rows={4} value={ed.v.ihracatci} onChange={e => upd({ ihracatci: e.target.value })} /></Field>
              <Field label="Alıcı *" span={2}><textarea className="adm-inp" rows={4} value={ed.v.alici} onChange={e => upd({ alici: e.target.value })} /></Field>
              <Field label="Bildirim tarafı (varsa)" span={2}><textarea className="adm-inp" rows={2} value={ed.v.bildirimTarafi} onChange={e => upd({ bildirimTarafi: e.target.value })} /></Field>
              {ed.tur !== 'packing' && <>
                <Field label="Incoterm"><select className="adm-inp" value={ed.v.incoterm} onChange={e => upd({ incoterm: e.target.value })}>{INCOTERMS.map(i => <option key={i}>{i}</option>)}</select></Field>
                <Field label="Teslim yeri"><input className="adm-inp" value={ed.v.teslimYeri} onChange={e => upd({ teslimYeri: e.target.value })} /></Field>
                <Field label="Para birimi"><select className="adm-inp" value={ed.v.paraBirimi} onChange={e => upd({ paraBirimi: e.target.value })}>{PARA.map(i => <option key={i}>{i}</option>)}</select></Field>
                <Field label="Ödeme koşulu"><input className="adm-inp" value={ed.v.odemeKosulu} onChange={e => upd({ odemeKosulu: e.target.value })} placeholder="30% advance, balance before shipment" /></Field>
              </>}
              <Field label="Menşei"><input className="adm-inp" value={ed.v.mensei} onChange={e => upd({ mensei: e.target.value })} /></Field>
              <Field label="Yükleme limanı"><input className="adm-inp" value={ed.v.yuklemeLimani} onChange={e => upd({ yuklemeLimani: e.target.value })} /></Field>
              <Field label="Varış limanı"><input className="adm-inp" value={ed.v.varisLimani} onChange={e => upd({ varisLimani: e.target.value })} /></Field>
              <Field label="Taşıma (araç/gemi)"><input className="adm-inp" value={ed.v.tasima} onChange={e => upd({ tasima: e.target.value })} /></Field>
              <Field label="Konteyner no"><input className="adm-inp" value={ed.v.konteynerNo} onChange={e => upd({ konteynerNo: e.target.value })} /></Field>
            </FormGrid>

            <Card title="Kalemler" pad={0}>
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr>{['Mal cinsi (açıklama)', ...(ed.tur === 'commercial' ? ['GTİP / HS'] : []), 'Miktar', 'Birim', ...(ed.tur !== 'packing' ? ['Birim fiyat'] : ['Koli', 'Net kg', 'Brüt kg', 'm³']), ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: 'var(--adm-tx3)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                <tbody>{ed.v.kalemler.map((k, i) => <tr key={i}>
                  <td style={{ padding: 4, minWidth: 220 }}><input className="adm-inp" value={k.aciklama} onChange={e => updK(i, { aciklama: e.target.value })} /></td>
                  {ed.tur === 'commercial' && <td style={{ padding: 4 }}><input className="adm-inp" style={{ width: 110 }} value={k.gtip} onChange={e => updK(i, { gtip: e.target.value })} placeholder="3924.90" /></td>}
                  <td style={{ padding: 4 }}><input type="number" step="any" min="0" className="adm-inp" style={{ width: 90 }} value={k.miktar} onChange={e => updK(i, { miktar: +e.target.value })} /></td>
                  <td style={{ padding: 4 }}><input className="adm-inp" style={{ width: 70 }} value={k.birim} onChange={e => updK(i, { birim: e.target.value })} /></td>
                  {ed.tur !== 'packing' ? <td style={{ padding: 4 }}><input type="number" step="any" min="0" className="adm-inp" style={{ width: 110 }} value={k.fiyat} onChange={e => updK(i, { fiyat: +e.target.value })} /></td> : <>
                    <td style={{ padding: 4 }}><input type="number" min="0" className="adm-inp" style={{ width: 70 }} value={k.koli || ''} onChange={e => updK(i, { koli: +e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input type="number" step="any" min="0" className="adm-inp" style={{ width: 90 }} value={k.net || ''} onChange={e => updK(i, { net: +e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input type="number" step="any" min="0" className="adm-inp" style={{ width: 90 }} value={k.brut || ''} onChange={e => updK(i, { brut: +e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input type="number" step="any" min="0" className="adm-inp" style={{ width: 80 }} value={k.m3 || ''} onChange={e => updK(i, { m3: +e.target.value })} /></td></>}
                  <td style={{ padding: 4 }}><button type="button" className="adm-btn-danger" style={{ padding: '3px 7px' }} disabled={ed.v.kalemler.length <= 1} onClick={() => setEd(e => e && ({ ...e, v: { ...e.v, kalemler: e.v.kalemler.filter((_, j) => j !== i) } }))}><Trash2 size={12} /></button></td></tr>)}</tbody>
              </table></div>
              <div style={{ padding: '8px 12px' }}><button type="button" className="adm-btn-ghost" onClick={() => setEd(e => e && ({ ...e, v: { ...e.v, kalemler: [...e.v.kalemler, bosKalem()] } }))}><Plus size={12} />Kalem ekle</button></div>
            </Card>

            {ed.tur !== 'packing' ? <>
              <FormGrid cols={4}>
                <Field label={`Navlun (${ed.v.paraBirimi})`}><input type="number" step="any" min="0" className="adm-inp" value={ed.v.navlun || ''} onChange={e => upd({ navlun: +e.target.value })} /></Field>
                <Field label={`Sigorta (${ed.v.paraBirimi})`}><input type="number" step="any" min="0" className="adm-inp" value={ed.v.sigorta || ''} onChange={e => upd({ sigorta: +e.target.value })} /></Field>
                <div style={{ gridColumn: 'span 2', alignSelf: 'end', textAlign: 'right', fontSize: 14 }}>Ara toplam {fmt(s.altToplam, ed.v.paraBirimi)} · <b>Genel toplam {fmt(s.genel, ed.v.paraBirimi)}</b></div>
              </FormGrid>
              <Field label="Banka bilgileri (IBAN/SWIFT)"><textarea className="adm-inp" rows={3} value={ed.v.banka} onChange={e => upd({ banka: e.target.value })} /></Field>
            </> : <>
              {!s.kalemVar && <div><b style={{ fontSize: 13 }}>Toplamlar (kalem bazında girilmediyse kullanılır)</b>
                <FormGrid cols={4}>
                  <Field label="Koli"><input type="number" min="0" className="adm-inp" value={ed.v.koliToplam || ''} onChange={e => upd({ koliToplam: +e.target.value })} /></Field>
                  <Field label="Net kg"><input type="number" step="any" min="0" className="adm-inp" value={ed.v.netToplam || ''} onChange={e => upd({ netToplam: +e.target.value })} /></Field>
                  <Field label="Brüt kg"><input type="number" step="any" min="0" className="adm-inp" value={ed.v.brutToplam || ''} onChange={e => upd({ brutToplam: +e.target.value })} /></Field>
                  <Field label="m³"><input type="number" step="any" min="0" className="adm-inp" value={ed.v.m3Toplam || ''} onChange={e => upd({ m3Toplam: +e.target.value })} /></Field>
                </FormGrid></div>}
              <FormGrid cols={4}>
                <Field label="Palet sayısı"><input type="number" min="0" className="adm-inp" value={ed.v.palet || ''} onChange={e => upd({ palet: +e.target.value })} /></Field>
                <Field label="İşaret ve numaralar" span={3}><input className="adm-inp" value={ed.v.isaretler} onChange={e => upd({ isaretler: e.target.value })} /></Field>
              </FormGrid>
              <div style={{ fontSize: 13, textAlign: 'right' }}>Toplam: <b>{s.koli} koli · {s.net} kg net · {s.brut} kg brüt · {s.m3} m³</b></div>
            </>}
            <Field label="Notlar"><textarea className="adm-inp" rows={2} value={ed.v.notlar} onChange={e => upd({ notlar: e.target.value })} /></Field>
          </div>)}
        </>}
      </Modal>
      {toast.node}
    </div>
  )
}
