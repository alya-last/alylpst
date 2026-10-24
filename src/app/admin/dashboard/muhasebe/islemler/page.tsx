'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { muh } from '@/lib/muhasebe-client'
import { useAcParam } from '@/lib/ac-param'
import { kasaPb, kurlariYukle, islemAlan, paraGoster, PB_SIM } from '@/lib/doviz'
import { fmt, fmtDate, fmtK, fmtInt, todayISO } from '@/lib/fmt'
import { DONEMLER, donemAralik, NON_PNL, type Donem } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, InfoRow, Divider, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { DataGrid, type Col, type ServerMode } from '@/components/admin/erp/DataGrid'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import { ListChecks, Plus, ArrowUpRight, ArrowDownRight, Scale, Hash, Pencil, Trash2, Copy } from 'lucide-react'

const ODEME: Record<string, string> = { nakit: 'Nakit', havale: 'Havale/EFT', kredi_karti: 'Kredi Kartı', cek: 'Çek', diger: 'Diğer' }
const bosForm = () => ({ tip: 'gelir' as 'gelir' | 'gider', kategori: '', tutar: '', aciklama: '', tarih: todayISO(), odeme_yontemi: 'nakit', cari_id: '', kasa_hesap_id: '', kur: '' })

// Defter sunucu tarafında sayfalanır (v_islemler_liste); toplamlar veritabanında hesaplanır (rpc_islem_ozet).
export default function IslemlerPage() {
  const toast = useToast()
  const [kats, setKats] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [kasalar, setKasalar] = useState<any[]>([])
  const [ozet, setOzet] = useState<any>(null)
  const [surum, setSurum] = useState(0)

  const [tip, setTip] = useState('hepsi')
  const [donem, setDonem] = useState<Donem>('tumu')
  const [kat, setKat] = useState('')
  const [hesap, setHesap] = useState('')
  const [yontem, setYontem] = useState('')
  const [cariF, setCariF] = useState('')
  const [gizleOzel, setGizleOzel] = useState(false)

  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(bosForm())
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)
  const [ata, setAta] = useState<{ rows: any[]; kasaOn: boolean; kasa: string; cariOn: boolean; cari: string } | null>(null)
  async function ataUygula(e: React.FormEvent) {
    e.preventDefault(); if (busy || !ata) return
    if (!ata.kasaOn && !ata.cariOn) return toast.show('Hesap veya cari alanını işaretle', true)
    setBusy(true)
    try {
      const r: any = await muh.rpc('rpc_islem_toplu_ata', { p_ids: ata.rows.map(x => x.id), p_kasa: ata.kasaOn && ata.kasa ? ata.kasa : null, p_kasa_set: ata.kasaOn, p_cari: ata.cariOn && ata.cari ? ata.cari : null, p_cari_set: ata.cariOn })
      toast.show(`${r?.guncellenen ?? 0} işlem güncellendi${r?.atlanan ? `, ${r.atlanan} fatura bağlı kayıt cari için atlandı` : ''}`)
      setAta(null); setSurum(v => v + 1)
    } catch (er: any) { toast.show(String(er?.message || er), true) }
    setBusy(false)
  }
  const [kurlar, setKurlar] = useState<Record<string, number>>({ TRY: 1 })

  useEffect(() => {
    Promise.all([muh.from('muhasebe_kategoriler').select('*').order('ad', { ascending: true }), muh.all('cari_hesaplar', 'id,ad,tip'), muh.all('kasa_banka_hesaplari', 'id,ad,tip,bakiye,aktif,para_birimi')])
      .then(([k, c, h]) => { setKats(k.data || []); setCariler(c); setKasalar(h) })
    kurlariYukle().then(setKurlar)
  }, [])

  const cariAd = useMemo(() => Object.fromEntries(cariler.map(c => [c.id, c.ad])), [cariler])
  const R = donemAralik(donem)

  const filtre = useCallback((q: any) => {
    if (tip !== 'hepsi') q = q.eq('tip', tip)
    if (R.from) q = q.gte('tarih', R.from)
    if (R.to) q = q.lte('tarih', R.to)
    if (kat) q = q.eq('kategori', kat)
    if (hesap === '_yok') q = q.is('kasa_hesap_id', null); else if (hesap) q = q.eq('kasa_hesap_id', hesap)
    if (yontem) q = q.eq('odeme_yontemi', yontem)
    if (cariF) q = q.eq('cari_id', cariF)
    if (gizleOzel) for (const k of NON_PNL) q = q.neq('kategori', k)
    return q
  }, [tip, R.from, R.to, kat, hesap, yontem, cariF, gizleOzel])

  useEffect(() => {
    setOzet(null)
    muh.rpc('rpc_islem_ozet', { p_from: R.from, p_to: R.to, p_tip: tip === 'hepsi' ? null : tip, p_kategori: kat || null, p_kasa: hesap && hesap !== '_yok' ? hesap : null, p_kasa_yok: hesap === '_yok', p_cari: cariF || null, p_yontem: yontem || null, p_ozel_gizle: gizleOzel })
      .then(setOzet).catch(() => setOzet({ gelir: 0, gider: 0, adet: 0, gelir_adet: 0, toplam_kayit: 0 }))
  }, [tip, R.from, R.to, kat, hesap, yontem, cariF, gizleOzel, surum]) // eslint-disable-line

  const server: ServerMode<any> = {
    deps: [tip, donem, kat, hesap, yontem, cariF, gizleOzel, surum],
    fetch: ({ page, size, q, sort }) => muh.page('v_islemler_liste', '*', { build: filtre, search: q, searchIn: ['aciklama', 'kategori', 'cari_ad', 'kasa_ad'], sort: sort || { key: 'tarih', dir: 'desc' }, tieBreak: 'created_at', page, size }),
  }

  useAcParam(true, async id => { const r: any = await muh.from('v_islemler_liste').select('*').eq('id', id); if (r.data?.[0]) setDetay(r.data[0]) })

  function openNew(t: 'gelir' | 'gider' = 'gelir', prefill?: any) { setEditing(null); setForm({ ...bosForm(), tip: t, ...prefill }); setModal(true) }
  function openEdit(r: any) {
    setEditing(r)
    setForm({ tip: r.tip, kategori: r.kategori || '', tutar: String(r.doviz_tutari ?? r.tutar), aciklama: r.aciklama || '', tarih: r.tarih, odeme_yontemi: r.odeme_yontemi || 'nakit', cari_id: r.cari_id || '', kasa_hesap_id: r.kasa_hesap_id || '', kur: r.kur ? String(r.kur) : '' })
    setModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    const girilen = +form.tutar
    if (!(girilen > 0)) { toast.show('Tutar 0’dan büyük olmalı', true); return }
    const kasaSec = form.kasa_hesap_id ? kasalar.find(k => k.id === form.kasa_hesap_id) : null
    const kurGirilen = +String(form.kur).replace(',', '.') || (kasaSec ? kurlar[kasaPb(kasaSec)] : 0) || 0
    if (kasaSec && kasaPb(kasaSec) !== 'TRY' && !(kurGirilen > 0)) { toast.show(`${kasaPb(kasaSec)} kurunu girin`, true); return }
    const al = kasaSec ? islemAlan(kasaSec, girilen, kurGirilen) : { tutar: girilen }
    const tutar = al.tutar
    setBusy(true)
    const payload: any = { tip: form.tip, kategori: form.kategori.trim(), ...al, doviz_tutari: (al as any).doviz_tutari ?? null, kur: (al as any).kur ?? null, aciklama: form.aciklama || null, tarih: form.tarih, odeme_yontemi: form.odeme_yontemi, cari_id: form.cari_id || null, kasa_hesap_id: form.kasa_hesap_id || null }
    try {
      if (payload.kategori && !kats.some(k => k.ad === payload.kategori && k.tip === payload.tip)) {
        await muh.from('muhasebe_kategoriler').insert({ tip: payload.tip, ad: payload.kategori, renk: '#64748b' })
        muh.from('muhasebe_kategoriler').select('*').order('ad', { ascending: true }).then((k: any) => setKats(k.data || []))
      }
      if (editing) {
        const finansal = editing.tip !== payload.tip || +editing.tutar !== payload.tutar || (+editing.doviz_tutari || 0) !== (payload.doviz_tutari || 0) || (+editing.kur || 0) !== (payload.kur || 0) || (editing.cari_id || null) !== payload.cari_id || (editing.kasa_hesap_id || null) !== payload.kasa_hesap_id
        if (finansal) {
          const ins: any = await muh.from('islemler').insert({ ...payload, fatura_id: editing.fatura_id || null })
          if (ins?.error) throw new Error(ins.error)
          const del: any = await muh.from('islemler').delete().eq('id', editing.id)
          if (del?.error) throw new Error(del.error)
        } else {
          const up: any = await muh.from('islemler').update({ kategori: payload.kategori, aciklama: payload.aciklama, tarih: payload.tarih, odeme_yontemi: payload.odeme_yontemi }).eq('id', editing.id)
          if (up?.error) throw new Error(up.error)
        }
        toast.show('İşlem güncellendi')
      } else {
        const r: any = await muh.from('islemler').insert(payload)
        if (r?.error) throw new Error(r.error)
        toast.show(`${payload.tip === 'gelir' ? 'Gelir' : 'Gider'} kaydedildi`)
      }
      setModal(false); setDetay(null); setSurum(v => v + 1)
    } catch (err: any) { toast.show(err.message || 'Kaydedilemedi', true) }
    setBusy(false)
  }

  async function del(r: any) {
    if (!confirm(`Bu işlem silinsin mi?\n${fmt(r.tutar)} — ${r.kategori}\n\nBağlı cari ve kasa/banka bakiyeleri otomatik geri alınır.`)) return
    const res: any = await muh.from('islemler').delete().eq('id', r.id)
    if (res?.error) { toast.show(res.error, true); return }
    toast.show('İşlem silindi'); setDetay(null); setSurum(v => v + 1)
  }
  async function bulkDel(sel: any[]): Promise<string | void> {
    let hata = 0, ilk = ''
    for (const r of sel) { const res: any = await muh.from('islemler').delete().eq('id', r.id); if (res?.error) { hata++; ilk ||= String(res.error) } }
    setSurum(v => v + 1)
    if (hata) return `${sel.length - hata} işlem silindi, ${hata} işlem silinemedi: ${ilk}`
    toast.show(`${sel.length} işlem silindi`)
  }

  const cols: Col<any>[] = [
    { key: 'tarih', sortKey: 'tarih', label: 'Tarih', width: 96, render: r => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.tarih)}</span>, csv: r => r.tarih },
    { key: 'tip', sortKey: 'tip', label: 'Tür', width: 80, render: r => <Badge tone={r.tip === 'gelir' ? 'green' : 'red'}>{r.tip === 'gelir' ? 'Gelir' : 'Gider'}</Badge>, csv: r => r.tip },
    { key: 'kategori', sortKey: 'kategori', label: 'Kategori', render: r => <span>{r.kategori}{NON_PNL.includes(r.kategori) && <Badge tone="muted" style={{ marginLeft: 6, fontSize: 9.5 }}>K/Z dışı</Badge>}</span>, csv: r => r.kategori },
    { key: 'aciklama', sortKey: 'aciklama', label: 'Açıklama', render: r => <span style={{ color: 'var(--adm-tx2)' }}>{r.aciklama || '—'}</span>, csv: r => r.aciklama, hideSm: true },
    { key: 'cari', sortKey: 'cari_ad', label: 'Cari', render: r => r.cari_ad || <span style={{ color: 'var(--adm-tx3)' }}>—</span>, csv: r => r.cari_ad, hideSm: true },
    { key: 'hesap', sortKey: 'kasa_ad', label: 'Hesap', render: r => r.kasa_ad || <span style={{ color: 'var(--adm-tx3)' }}>—</span>, csv: r => r.kasa_ad, hideSm: true },
    { key: 'odeme', sortKey: 'odeme_yontemi', label: 'Ödeme', render: r => ODEME[r.odeme_yontemi] || r.odeme_yontemi, hidden: true },
    { key: 'tutar', sortKey: 'tutar', label: 'Tutar', align: 'right', render: r => <div><Money v={+(r.doviz_tutari ?? r.tutar)} tone={r.tip === 'gelir' ? 'green' : 'red'} sign={r.tip === 'gelir'} cur={r.doviz_tutari != null ? r.kasa_pb : 'TRY'} />{r.doviz_tutari != null && <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>≈ {paraGoster(+r.tutar)}</div>}</div>, csv: r => (r.tip === 'gelir' ? 1 : -1) * +r.tutar },
    { key: 'act', label: '', width: 70, align: 'right', render: r => (
      <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
        <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => openEdit(r)}><Pencil size={12} /></button>
        <button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={() => del(r)}><Trash2 size={12} /></button>
      </span>) },
  ]

  const katList = kats.filter(k => k.tip === form.tip)
  const etki = form.kasa_hesap_id ? kasalar.find(k => k.id === form.kasa_hesap_id) : null
  const gelir = +(ozet?.gelir || 0), gider = +(ozet?.gider || 0)

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Gelir / Gider İşlemleri" />
      <Page>
        <PageHead title="Gelir & Gider Defteri" sub="Tüm nakit hareketleri — sunucu tarafında sayfalanır, filtrelenir ve toplanır"
          actions={<>
            <button className="adm-btn" style={{ background: 'var(--adm-green)' }} onClick={() => openNew('gelir')}><Plus size={14} />Gelir Ekle</button>
            <button className="adm-btn" style={{ background: 'var(--adm-red)' }} onClick={() => openNew('gider')}><Plus size={14} />Gider Ekle</button>
          </>} />

        <Yardim sayfa="islemler" sekme={tip} />
        <KpiGrid min={180}>
          <Kpi label="Gelir" value={ozet ? fmtK(gelir) : '…'} Icon={ArrowUpRight} color="var(--adm-green)" sub={ozet ? `${fmtInt(ozet.gelir_adet)} işlem` : ''} />
          <Kpi label="Gider" value={ozet ? fmtK(gider) : '…'} Icon={ArrowDownRight} color="var(--adm-red)" sub={ozet ? `${fmtInt(+ozet.adet - +ozet.gelir_adet)} işlem` : ''} />
          <Kpi label="Net" value={ozet ? fmtK(gelir - gider) : '…'} Icon={Scale} color={gelir - gider >= 0 ? 'var(--adm-green)' : 'var(--adm-red)'} sub={gelir ? `Marj %${(((gelir - gider) / gelir) * 100).toFixed(1)}` : undefined} />
          <Kpi label="Kayıt" value={ozet ? fmtInt(ozet.adet) : '…'} Icon={Hash} color="var(--adm-blue)" sub={ozet ? (+ozet.adet !== +ozet.toplam_kayit ? `${fmtInt(ozet.toplam_kayit)} kayıttan filtrelenen` : 'Tüm kayıtlar') : ''} />
        </KpiGrid>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Tabs value={tip} onChange={setTip} tabs={[{ v: 'hepsi', l: 'Tümü' }, { v: 'gelir', l: 'Gelir' }, { v: 'gider', l: 'Gider' }]} />
          <Tabs value={donem} onChange={v => setDonem(v as Donem)} tabs={DONEMLER.map(d => ({ v: d.v, l: d.l }))} />
        </div>

        <DataGrid rows={[]} server={server} cols={cols} rowKey={r => r.id} csvName="gelir-gider" storageKey="islemler-srv" pageSizes={[25, 50, 100, 250]}
          searchPlaceholder="Açıklama, kategori, cari, hesap..." selectable
          bulkActions={(sel, clear) => <><button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu(sel)}><ListChecks size={12} />Toplu düzenle</button><button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setAta({ rows: sel, kasaOn: true, kasa: '', cariOn: false, cari: '' })}><Scale size={12} />Hesaba / cariye ata</button></>}
          onBulkDelete={bulkDel} deleteNoun="işlem"
          onRowClick={setDetay} activeKey={detay?.id}
          filters={<>
            <select className="adm-sel" value={kat} onChange={e => setKat(e.target.value)}><option value="">Tüm kategoriler</option>{Array.from(new Set(kats.map(k => k.ad))).sort((a: any, b: any) => a.localeCompare(b, 'tr')).concat(NON_PNL.filter(n => !kats.some(k => k.ad === n))).map((k: any) => <option key={k}>{k}</option>)}</select>
            <select className="adm-sel" value={hesap} onChange={e => setHesap(e.target.value)}><option value="">Tüm hesaplar</option><option value="_yok">Hesap bağlı olmayan</option>{kasalar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}</select>
            <select className="adm-sel" value={yontem} onChange={e => setYontem(e.target.value)}><option value="">Tüm ödeme yöntemleri</option>{Object.entries(ODEME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select className="adm-sel" value={cariF} onChange={e => setCariF(e.target.value)} style={{ maxWidth: 170 }}><option value="">Tüm cariler</option>{cariler.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}</select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--adm-tx3)' }}><input type="checkbox" checked={gizleOzel} onChange={e => setGizleOzel(e.target.checked)} />Virman/kapama gizle</label>
          </>}
          footerNote={<span>· KPI'lar arama metnini içermez; kâr/zarar toplamları virman ve fatura kapama kayıtlarını hariç tutar</span>} />
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={440}
        title={detay && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Badge tone={detay.tip === 'gelir' ? 'green' : 'red'}>{detay.tip === 'gelir' ? 'Gelir' : 'Gider'}</Badge>{detay.kategori}</span>}
        sub={detay && fmtDate(detay.tarih)}
        footer={detay && <>
          <button className="adm-btn-ghost" onClick={() => openNew(detay.tip, { kategori: detay.kategori, tutar: String(detay.doviz_tutari ?? detay.tutar), aciklama: detay.aciklama || '', odeme_yontemi: detay.odeme_yontemi, cari_id: detay.cari_id || '', kasa_hesap_id: detay.kasa_hesap_id || '' })}><Copy size={13} />Kopyala</button>
          <button className="adm-btn-ghost" onClick={() => openEdit(detay)}><Pencil size={13} />Düzenle</button>
          <button className="adm-btn-danger" onClick={() => del(detay)}><Trash2 size={13} />Sil</button>
        </>}>
        {detay && (
          <div style={{ padding: 20 }}>
            <div style={{ textAlign: 'center', padding: '10px 0 18px' }}><Money v={+(detay.doviz_tutari ?? detay.tutar)} tone={detay.tip === 'gelir' ? 'green' : 'red'} sign={detay.tip === 'gelir'} size={30} cur={detay.doviz_tutari != null ? detay.kasa_pb : 'TRY'} />{detay.doviz_tutari != null && <div style={{ fontSize: 12, color: 'var(--adm-tx3)', marginTop: 4 }}>≈ {paraGoster(+detay.tutar)} (kur {(+detay.kur).toLocaleString('tr-TR', { maximumFractionDigits: 4 })})</div>}</div>
            <InfoRow k="Açıklama" v={detay.aciklama || '—'} />
            <InfoRow k="Ödeme yöntemi" v={ODEME[detay.odeme_yontemi] || detay.odeme_yontemi} />
            <InfoRow k="Cari" v={detay.cari_ad || '—'} />
            <InfoRow k="Kasa / Banka" v={detay.kasa_ad || '—'} />
            <InfoRow k="Fatura bağlantısı" v={detay.fatura_id ? 'Var' : '—'} />
            <InfoRow k="Kayıt zamanı" v={new Date(detay.created_at).toLocaleString('tr-TR')} />
            <Divider label="Bakiye etkisi" />
            <p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', lineHeight: 1.7, margin: 0 }}>
              {detay.kasa_hesap_id ? <>• <b>{detay.kasa_ad}</b> bakiyesi {detay.tip === 'gelir' ? 'artırıldı' : 'azaltıldı'}.<br /></> : <>• Kasa/banka hesabına bağlı değil, hiçbir hesap bakiyesi etkilenmedi.<br /></>}
              {detay.cari_id ? <>• <b>{detay.cari_ad}</b> cari bakiyesi {detay.tip === 'gelir' ? 'düştü (tahsilat)' : 'arttı (ödeme yapıldı)'}.</> : <>• Cariye bağlı değil.</>}
            </p>
          </div>
        )}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} width={600}
        title={<span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{editing ? 'İşlemi Düzenle' : 'Yeni İşlem'}
          <span style={{ display: 'flex', gap: 4 }}>
            {(['gelir', 'gider'] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tip: t, kategori: '' }))} style={{ padding: '4px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, border: 'none', fontFamily: 'inherit', background: form.tip === t ? (t === 'gelir' ? 'var(--adm-green)' : 'var(--adm-red)') : 'var(--adm-s3)', color: form.tip === t ? '#fff' : 'var(--adm-tx3)' }}>{t === 'gelir' ? 'Gelir' : 'Gider'}</button>
            ))}
          </span></span>}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy} style={{ background: form.tip === 'gelir' ? 'var(--adm-green)' : 'var(--adm-red)' }}>{busy ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
        <FormGrid>
          <Field label={`Tutar (${PB_SIM[etki ? kasaPb(etki) : 'TRY']}) *`}><input type="number" step="0.01" min="0" className="adm-inp" required autoFocus value={form.tutar} onChange={e => setForm(f => ({ ...f, tutar: e.target.value }))} placeholder="0,00" style={{ fontSize: 16, fontWeight: 700 }} /></Field>
          <Field label="Tarih *"><input type="date" className="adm-inp" required value={form.tarih} onChange={e => setForm(f => ({ ...f, tarih: e.target.value }))} /></Field>
          <Field label="Kategori *" hint="Listede yoksa yaz, otomatik oluşturulur">
            <input className="adm-inp" required list="kat-list" value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))} placeholder="Seç veya yaz" />
            <datalist id="kat-list">{katList.map(k => <option key={k.id} value={k.ad} />)}</datalist>
          </Field>
          <Field label="Ödeme Yöntemi"><select className="adm-inp" value={form.odeme_yontemi} onChange={e => setForm(f => ({ ...f, odeme_yontemi: e.target.value }))}>{Object.entries(ODEME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Kasa / Banka Hesabı" hint={etki ? `Bakiye: ${paraGoster(etki.bakiye, kasaPb(etki))} → ${paraGoster(+etki.bakiye + (form.tip === 'gelir' ? 1 : -1) * (+form.tutar || 0), kasaPb(etki))}` : 'Seçmezsen hiçbir hesap bakiyesi değişmez'}>
            <select className="adm-inp" value={form.kasa_hesap_id} onChange={e => setForm(f => ({ ...f, kasa_hesap_id: e.target.value }))}><option value="">— Hesap seçilmedi —</option>{kasalar.filter(k => k.aktif !== false).map(k => <option key={k.id} value={k.id}>{k.ad} ({k.tip}{kasaPb(k) !== 'TRY' ? ` · ${kasaPb(k)}` : ''})</option>)}</select>
          </Field>
          {etki && kasaPb(etki) !== 'TRY' && <Field label={`Kur (1 ${kasaPb(etki)} = ₺) *`} hint={`TL karşılığı: ${paraGoster((+form.tutar || 0) * (+String(form.kur).replace(',', '.') || kurlar[kasaPb(etki)] || 0))} — raporlar ve cari bakiye TL üzerinden işlenir`}><input type="number" step="0.0001" min="0" className="adm-inp" value={form.kur} placeholder={kurlar[kasaPb(etki)] ? String(kurlar[kasaPb(etki)]) : 'Kasa/Banka → Döviz Kurları'} onChange={e => setForm(f => ({ ...f, kur: e.target.value }))} /></Field>}
          <Field label="Cari Hesap" hint={form.cari_id ? (form.tip === 'gelir' ? 'Tahsilat: cari bakiyesi düşer' : 'Ödeme: cari bakiyesi artar') : 'Opsiyonel'}>
            <select className="adm-inp" value={form.cari_id} onChange={e => setForm(f => ({ ...f, cari_id: e.target.value }))}><option value="">— Yok —</option>{cariler.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}</select>
          </Field>
          <Field label="Açıklama" span={2}><input className="adm-inp" value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} placeholder="İşlem açıklaması..." /></Field>
        </FormGrid>
        {editing && <p style={{ fontSize: 11.5, color: 'var(--adm-amber)', margin: '12px 0 0' }}>Tutar, tür, cari veya hesap değişirse eski kayıt geri alınıp yenisi eklenir; bakiyeler otomatik düzelir.</p>}
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); setSurum(v => v + 1) }} client={muh as any} table="islemler" fields={[
        { key: 'kategori', label: 'Kategori', type: 'select', hint: 'Gelir ve gider kategorileri karışık seçili olabilir; uygun olanı seç', options: Array.from(new Set(kats.map((k: any) => k.ad as string))).sort((a, b) => a.localeCompare(b, 'tr')).map(v => ({ v, l: v })) },
        { key: 'aciklama', label: 'Açıklama', type: 'text', bosYapilabilir: true },
      ]} />
      <Modal open={!!ata} onClose={() => setAta(null)} onSubmit={ataUygula} width={520} title={`Hesaba / Cariye Ata — ${ata?.rows.length || 0} kayıt`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setAta(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Uygulanıyor…' : 'Uygula'}</button></>}>
        {ata && <FormGrid cols={1}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-tx3)' }}>Bakiyeler otomatik düzeltilir: eski hesaptan/cariden etki geri alınır, yenisine işlenir (gelir hesabı artırır, gider azaltır). Yalnızca TL hesaplar seçilebilir. Faturaya bağlı kayıtların cari bağı değiştirilmez.</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={ata.kasaOn} onChange={e => setAta(a => a && ({ ...a, kasaOn: e.target.checked }))} />Kasa/banka hesabını değiştir</label>
          {ata.kasaOn && <Field label="Kasa / Banka hesabı"><select className="adm-inp" value={ata.kasa} onChange={e => setAta(a => a && ({ ...a, kasa: e.target.value }))}><option value="">— Hesap bağlama (boş yap) —</option>{kasalar.filter(k => k.aktif !== false && kasaPb(k) === 'TRY').map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}</select></Field>}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={ata.cariOn} onChange={e => setAta(a => a && ({ ...a, cariOn: e.target.checked }))} />Cariyi değiştir</label>
          {ata.cariOn && <Field label="Cari"><select className="adm-inp" value={ata.cari} onChange={e => setAta(a => a && ({ ...a, cari: e.target.value }))}><option value="">— Cari bağlama (boş yap) —</option>{cariler.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>}
        </FormGrid>}
      </Modal>
      {toast.node}
    </div>
  )
}
