'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { useAcParam } from '@/lib/ac-param'
import { web } from '@/lib/web-data'
import { fmt, fmtN, fmtDate } from '@/lib/fmt'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Modal, Field, FormGrid, Card, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Plus, ClipboardList, Scale, CheckCircle2, Trash2, ShoppingCart, ExternalLink, Pencil, AlertTriangle, X } from 'lucide-react'

const DURUM: Record<string, { l: string; tone: any }> = { beklemede: { l: 'Teklif bekliyor', tone: 'amber' }, siparise_donustu: { l: 'Siparişe döndü', tone: 'green' }, reddedildi: { l: 'Reddedildi', tone: 'red' }, iptal: { l: 'İptal', tone: 'muted' } }
const bugun = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
type TK = { hammadde_id: string; miktar: string }
const bosTeklif = () => ({ id: null as string | null, tedarikci_id: '', teslim_gun: '', vade_gun: '', gecerlilik: '', notlar: '', fiyat: {} as Record<string, string> })

export default function TaleplerPage() {
  const toast = useToast()
  const [talepler, setTalepler] = useState<any[]>([])
  const [kalemler, setKalemler] = useState<any[]>([])
  const [teklifler, setTeklifler] = useState<any[]>([])
  const [fiyatlar, setFiyatlar] = useState<any[]>([])
  const [ham, setHam] = useState<any[]>([])
  const [ted, setTed] = useState<any[]>([])
  const [acikSip, setAcikSip] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('beklemede')
  const [duz, setDuz] = useState<{ id: string | null; gerekce: string; istenen_tarih: string; kalemler: TK[] } | null>(null)
  const [secili, setSecili] = useState<string | null>(null)
  const [tf, setTf] = useState<ReturnType<typeof bosTeklif> | null>(null)
  const [busy, setBusy] = useState(false)

  const yukle = useCallback(async () => {
    const [t, k, tk, fy, h, c, so, sk] = await Promise.all([
      web.from('satinalma_talepleri').select('*').order('created_at', { ascending: false }).limit(1000),
      web.from('satinalma_talep_kalemleri').select('*').order('sira').limit(10000),
      web.from('satinalma_teklifleri').select('*').limit(5000),
      web.from('satinalma_teklif_fiyatlari').select('*').limit(50000),
      web.from('hammaddeler').select('id,kod,ad,birim,mevcut_stok,min_stok,max_stok,ortalama_maliyet,aktif').order('ad').limit(3000),
      web.from('cari_hesaplar').select('id,ad,tip').eq('tip', 'tedarikci').order('ad').limit(2000),
      web.from('satinalma_siparisleri').select('id').in('durum', ['beklemede', 'onaylandi', 'yolda']).limit(2000),
      web.from('satinalma_siparisi_kalemleri').select('siparis_id,hammadde_id').limit(20000),
    ])
    const hata = t.error || k.error || tk.error || fy.error || h.error || c.error
    if (hata) toast.show(hata.message, true)
    const acik = new Set<string>((so.data || []).map((x: any) => x.id))
    setAcikSip(new Set((sk.data || []).filter((x: any) => acik.has(x.siparis_id)).map((x: any) => x.hammadde_id)))
    setTalepler(t.data || []); setKalemler(k.data || []); setTeklifler(tk.data || []); setFiyatlar(fy.data || []); setHam(h.data || []); setTed(c.data || []); setLoading(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  const hamId = useMemo(() => Object.fromEntries(ham.map(h => [h.id, h])), [ham])
  const tedId = useMemo(() => Object.fromEntries(ted.map(t => [t.id, t])), [ted])
  const kBy = useMemo(() => { const o: Record<string, any[]> = {}; kalemler.forEach(k => (o[k.talep_id] ||= []).push(k)); Object.values(o).forEach(a => a.sort((x, y) => x.sira - y.sira)); return o }, [kalemler])
  const tBy = useMemo(() => { const o: Record<string, any[]> = {}; teklifler.forEach(t => (o[t.talep_id] ||= []).push(t)); return o }, [teklifler])
  const fiyat = useMemo(() => Object.fromEntries(fiyatlar.map(f => [`${f.teklif_id}|${f.talep_kalem_id}`, +f.birim_fiyat])), [fiyatlar])
  const oneri = (h: any) => Math.max(Math.ceil((+h.max_stok || (+h.min_stok || 0) * 3) - (+h.mevcut_stok || 0)), 1)

  /** Bir teklifin toplamı: tüm kalemlere fiyat girilmişse toplam, yoksa null (eksik). */
  const teklifToplam = (t: any, ks: any[]) => { let top = 0; for (const k of ks) { const f = fiyat[`${t.id}|${k.id}`]; if (f == null) return null; top += f * +k.miktar } return top }
  const enIyi = (talepId: string) => { const ks = kBy[talepId] || []; const l = (tBy[talepId] || []).map(t => teklifToplam(t, ks)).filter((x): x is number => x != null); return l.length ? Math.min(...l) : null }

  const acikTalepHam = useMemo(() => new Set(talepler.filter(t => t.durum === 'beklemede').flatMap(t => (kBy[t.id] || []).map(k => k.hammadde_id))), [talepler, kBy])
  const kritik = useMemo(() => ham.filter(h => h.aktif !== false && (+h.mevcut_stok || 0) <= (+h.min_stok || 0) && !acikSip.has(h.id) && !acikTalepHam.has(h.id)), [ham, acikSip, acikTalepHam])

  const cnt = (d: string) => talepler.filter(t => t.durum === d).length
  const liste = talepler.filter(t => tab === 'hepsi' ? true : t.durum === tab)
  const aktif = talepler.find(t => t.id === secili) || null
  const aKs = aktif ? kBy[aktif.id] || [] : []
  const aTk = aktif ? (tBy[aktif.id] || []) : []

  /* ── Talep oluştur / düzenle ── */
  const yeniTalep = (kalem?: TK[]) => setDuz({ id: null, gerekce: '', istenen_tarih: '', kalemler: kalem?.length ? kalem : [{ hammadde_id: '', miktar: '' }] })
  const kritikDoldur = () => setDuz(d => d && ({ ...d, gerekce: d.gerekce || 'Kritik stok', kalemler: kritik.map(h => ({ hammadde_id: h.id, miktar: String(oneri(h)) })) }))
  async function talepKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy || !duz) return
    const dolu = duz.kalemler.filter(k => k.hammadde_id && +k.miktar > 0)
    if (!dolu.length) return toast.show('En az bir hammadde ve miktar girin', true)
    if (new Set(dolu.map(k => k.hammadde_id)).size !== dolu.length) return toast.show('Aynı hammadde birden fazla satırda', true)
    setBusy(true)
    const { data, error } = await web.rpc('rpc_satinalma_talep_kaydet', { p_id: duz.id, p_talep: { gerekce: duz.gerekce, istenen_tarih: duz.istenen_tarih || '' }, p_kalemler: dolu.map(k => ({ hammadde_id: k.hammadde_id, miktar: +k.miktar })) })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setDuz(null); toast.show(`Talep kaydedildi: ${data.no}`); await yukle(); setSecili(data.id)
  }
  async function kritikTalep() {
    if (!kritik.length || busy) return
    if (!confirm(`${kritik.length} kritik hammadde için tek bir satınalma talebi açılsın mı?\n\n${kritik.slice(0, 8).map(h => `• ${h.ad}: ${oneri(h)} ${h.birim || ''}`).join('\n')}${kritik.length > 8 ? '\n…' : ''}`)) return
    setBusy(true)
    const { data, error } = await web.rpc('rpc_satinalma_talep_kaydet', { p_id: null, p_talep: { gerekce: 'Kritik stoktan otomatik oluşturuldu' }, p_kalemler: kritik.map(h => ({ hammadde_id: h.id, miktar: oneri(h) })) })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    toast.show(`Talep açıldı: ${data.no} — şimdi tedarikçi tekliflerini girin`); await yukle(); setSecili(data.id)
  }

  /* ── Teklif ── */
  function teklifAc(t?: any) {
    if (!aktif) return
    if (!t) return setTf(bosTeklif())
    setTf({ id: t.id, tedarikci_id: t.tedarikci_id, teslim_gun: t.teslim_gun ?? '', vade_gun: t.vade_gun ?? '', gecerlilik: t.gecerlilik || '', notlar: t.notlar || '', fiyat: Object.fromEntries(aKs.map(k => [k.id, fiyat[`${t.id}|${k.id}`] != null ? String(fiyat[`${t.id}|${k.id}`]) : ''])) })
  }
  async function teklifKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy || !tf || !aktif) return
    if (!tf.tedarikci_id) return toast.show('Tedarikçi seçin', true)
    const satir = aKs.filter(k => tf.fiyat[k.id] !== undefined && tf.fiyat[k.id] !== '').map(k => ({ talep_kalem_id: k.id, birim_fiyat: +String(tf.fiyat[k.id]).replace(',', '.') }))
    if (!satir.length) return toast.show('En az bir kalem için fiyat girin', true)
    if (satir.some(x => !(x.birim_fiyat >= 0))) return toast.show('Fiyatlar geçersiz', true)
    if (satir.length < aKs.length && !confirm(`${aKs.length - satir.length} kalem için fiyat girilmedi. Eksik teklif siparişe çevrilemez. Yine de kaydedilsin mi?`)) return
    setBusy(true)
    const { error } = await web.rpc('rpc_satinalma_teklif_kaydet', { p_talep_id: aktif.id, p_teklif_id: tf.id, p_teklif: { tedarikci_id: tf.tedarikci_id, teslim_gun: String(tf.teslim_gun), vade_gun: String(tf.vade_gun), gecerlilik: tf.gecerlilik || '', notlar: tf.notlar }, p_fiyatlar: satir })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setTf(null); toast.show('Teklif kaydedildi'); yukle()
  }
  async function teklifSil(t: any) {
    if (!confirm('Bu tedarikçinin teklifi silinsin mi?')) return
    const { error } = await web.from('satinalma_teklifleri').delete().eq('id', t.id)
    if (error) return toast.show(error.message, true); yukle()
  }
  async function sec(t: any) {
    if (busy || !aktif) return
    const top = teklifToplam(t, aKs); if (top == null) return toast.show('Teklifte fiyatı girilmemiş kalem var', true)
    if (t.gecerlilik && t.gecerlilik < bugun() && !confirm('Bu teklifin geçerlilik süresi dolmuş. Yine de sipariş oluşturulsun mu?')) return
    if (!confirm(`${tedId[t.tedarikci_id]?.ad} teklifi (${aKs.length} kalem, ${fmt(top)}) ile satınalma siparişi oluşturulsun mu?`)) return
    setBusy(true)
    const { error } = await web.rpc('rpc_satinalma_teklif_siparise_cevir', { p_teklif_id: t.id })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    toast.show('Sipariş oluşturuldu (Siparişler sayfasında)'); yukle()
  }
  async function durumDegis(t: any, durum: string) {
    if (!confirm(`${t.no} ${durum === 'reddedildi' ? 'reddedilsin' : 'iptal edilsin'} mi?`)) return
    const { error } = await web.from('satinalma_talepleri').update({ durum, updated_at: new Date().toISOString() }).eq('id', t.id).eq('durum', 'beklemede')
    if (error) return toast.show(error.message, true); yukle()
  }

  const cols: Col<any>[] = [
    { key: 'no', label: 'Talep', width: 120, sort: t => t.no, render: t => <b>{t.no}</b> },
    { key: 'ham', label: 'Kalemler', render: t => { const ks = kBy[t.id] || []; return <div>{ks.slice(0, 2).map(k => hamId[k.hammadde_id]?.ad).filter(Boolean).join(', ')}{ks.length > 2 ? ` +${ks.length - 2}` : ''}<div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{ks.length} kalem{t.gerekce ? ` · ${t.gerekce}` : ''}</div></div> } },
    { key: 'ist', label: 'İstenen', width: 100, sort: t => t.istenen_tarih || '', render: t => t.istenen_tarih ? <span style={{ color: t.durum === 'beklemede' && t.istenen_tarih < bugun() ? 'var(--adm-red)' : undefined }}>{fmtDate(t.istenen_tarih)}</span> : '—', hideSm: true },
    { key: 'tk', label: 'Teklif', width: 70, align: 'right', sort: t => (tBy[t.id] || []).length, render: t => (tBy[t.id] || []).length || <span style={{ color: 'var(--adm-tx3)' }}>—</span> },
    { key: 'en', label: 'En iyi toplam', width: 130, align: 'right', render: t => { const e = enIyi(t.id); return e == null ? '—' : fmt(e) }, hideSm: true },
    { key: 'du', label: 'Durum', width: 130, sort: t => t.durum, render: t => <Badge tone={DURUM[t.durum]?.tone}>{DURUM[t.durum]?.l}</Badge> },
  ]
  const enUcuzToplam = aktif ? enIyi(aktif.id) : null

  useAcParam(!loading, id => { if (talepler.some((x: any) => x.id === id)) { setSecili(id); setTf(null) } })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Satınalma Talepleri" />
      <Page>
        <PageHead title="Satınalma Talepleri ve Teklifler" sub="Çok kalemli talep aç → tedarikçilerden kalem bazlı teklif topla → karşılaştır → seçileni tek tıkla siparişe çevir"
          actions={<><Link href="/admin/dashboard/satinalma/siparisler" className="adm-btn-ghost" style={{ textDecoration: 'none' }}><ExternalLink size={13} />Siparişler</Link><button className="adm-btn" onClick={() => yeniTalep()}><Plus size={14} />Yeni Talep</button></>} />
        <KpiGrid min={170}>
          <Kpi label="Teklif bekleyen" value={cnt('beklemede')} Icon={ClipboardList} color="var(--adm-amber)" sub={`${talepler.filter(t => t.durum === 'beklemede' && !(tBy[t.id] || []).length).length} talepte hiç teklif yok`} />
          <Kpi label="Siparişe dönen" value={cnt('siparise_donustu')} Icon={CheckCircle2} color="var(--adm-green)" />
          <Kpi label="Toplam teklif" value={teklifler.length} Icon={Scale} color="var(--adm-blue)" />
          <Kpi label="Talepsiz kritik stok" value={kritik.length} Icon={AlertTriangle} color={kritik.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub={kritik.length ? 'talep açılabilir' : 'tümü talepte/siparişte'} />
        </KpiGrid>
        {kritik.length > 0 && (
          <div className="adm-card" style={{ padding: '11px 16px', margin: '12px 0', display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--adm-red)', fontSize: 13, flexWrap: 'wrap' }}>
            <AlertTriangle size={16} style={{ color: 'var(--adm-red)' }} /><span style={{ flex: 1, minWidth: 220 }}><b>{kritik.length}</b> hammadde minimum stokta; açık sipariş veya talebi yok: {kritik.slice(0, 3).map(h => h.ad).join(', ')}{kritik.length > 3 ? '…' : ''}</span>
            <button className="adm-btn" style={{ padding: '4px 12px', fontSize: 12 }} disabled={busy} onClick={kritikTalep}><ShoppingCart size={12} />Kritik stoktan talep aç</button>
          </div>)}
        <div style={{ margin: '12px 0' }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'beklemede', l: 'Teklif bekleyen', n: cnt('beklemede') }, { v: 'siparise_donustu', l: 'Siparişe dönen', n: cnt('siparise_donustu') }, { v: 'reddedildi', l: 'Reddedilen', n: cnt('reddedildi') }, { v: 'iptal', l: 'İptal', n: cnt('iptal') }, { v: 'hepsi', l: 'Tümü', n: talepler.length }]} /></div>
        <DataGrid rows={liste} cols={cols} rowKey={t => t.id} loading={loading} csvName="satinalma-talepleri" storageKey="satinalma-talepleri-v2" onRowClick={t => { setSecili(t.id); setTf(null) }}
          searchText={t => `${t.no} ${t.gerekce || ''} ${(kBy[t.id] || []).map(k => hamId[k.hammadde_id]?.ad).join(' ')}`} searchPlaceholder="Talep no, hammadde…" emptyTitle="Talep yok" emptySub="“Yeni Talep” ile başlayın veya kritik stoktan talep açın" />
      </Page>

      <Modal open={!!duz} onClose={() => setDuz(null)} onSubmit={talepKaydet} width={720} title={duz?.id ? 'Talebi düzenle' : 'Yeni Satınalma Talebi'}
        footer={<><span style={{ marginRight: 'auto', fontSize: 12.5, color: 'var(--adm-tx3)' }}>{kritik.length > 0 && <button type="button" className="adm-btn-ghost" onClick={kritikDoldur}>Kritik stoktan doldur ({kritik.length})</button>}</span><button type="button" className="adm-btn-ghost" onClick={() => setDuz(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Talebi Kaydet'}</button></>}>
        {duz && <>
          <FormGrid cols={2}>
            <Field label="Gerekçe"><input className="adm-inp" maxLength={500} value={duz.gerekce} onChange={e => setDuz(d => d && ({ ...d, gerekce: e.target.value }))} placeholder="Örn. Kritik stok, X siparişi için" /></Field>
            <Field label="İstenen tarih"><input type="date" className="adm-inp" min={bugun()} value={duz.istenen_tarih} onChange={e => setDuz(d => d && ({ ...d, istenen_tarih: e.target.value }))} /></Field>
          </FormGrid>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
            <thead><tr><th style={th}>Hammadde</th><th style={{ ...th, width: 130 }}>Miktar</th><th style={{ width: 30 }} /></tr></thead>
            <tbody>{duz.kalemler.map((k, i) => { const h = hamId[k.hammadde_id]; return <tr key={i}>
              <td style={{ padding: 4 }}><select className="adm-inp" value={k.hammadde_id} onChange={e => { const hh = hamId[e.target.value]; setDuz(d => d && ({ ...d, kalemler: d.kalemler.map((x, j) => j === i ? { hammadde_id: e.target.value, miktar: x.miktar || (hh ? String(oneri(hh)) : '') } : x) })) }}><option value="">— Seçin —</option>{ham.filter(x => x.aktif !== false).map(x => <option key={x.id} value={x.id}>{x.ad} ({x.kod}) — stok {fmtN(+x.mevcut_stok || 0, 0)} {x.birim || ''}</option>)}</select>
                {h && <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>min {fmtN(+h.min_stok || 0, 0)}{h.max_stok ? ` · max ${fmtN(+h.max_stok, 0)}` : ''} · öneri {oneri(h)}</div>}</td>
              <td style={{ padding: 4 }}><input type="number" min="0" step="any" className="adm-inp" value={k.miktar} onChange={e => setDuz(d => d && ({ ...d, kalemler: d.kalemler.map((x, j) => j === i ? { ...x, miktar: e.target.value } : x) }))} /></td>
              <td><button type="button" disabled={duz.kalemler.length === 1} onClick={() => setDuz(d => d && ({ ...d, kalemler: d.kalemler.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: 'var(--adm-red)' }}><X size={14} /></button></td></tr> })}</tbody>
          </table>
          <button type="button" className="adm-btn-ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setDuz(d => d && ({ ...d, kalemler: [...d.kalemler, { hammadde_id: '', miktar: '' }] }))}><Plus size={12} />Kalem ekle</button>
        </>}
      </Modal>

      <Modal open={!!aktif} onClose={() => { setSecili(null); setTf(null) }} width={1000} title={aktif ? `${aktif.no} — ${aKs.length} kalem` : ''} footer={aktif && <>
        {aktif.durum === 'beklemede' && <><button className="adm-btn-danger" style={{ marginRight: 'auto' }} onClick={() => durumDegis(aktif, 'iptal')}>Talebi iptal et</button>
          {!aTk.length && <button className="adm-btn-ghost" onClick={() => setDuz({ id: aktif.id, gerekce: aktif.gerekce || '', istenen_tarih: aktif.istenen_tarih || '', kalemler: aKs.map(k => ({ hammadde_id: k.hammadde_id, miktar: String(k.miktar) })) })}><Pencil size={13} />Kalemleri düzenle</button>}
          <button className="adm-btn-ghost" onClick={() => durumDegis(aktif, 'reddedildi')}>Reddet</button></>}
        <button className="adm-btn-ghost" onClick={() => { setSecili(null); setTf(null) }}>Kapat</button></>}>
        {aktif && <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13, marginBottom: 12, alignItems: 'center' }}>
            <Badge tone={DURUM[aktif.durum]?.tone}>{DURUM[aktif.durum]?.l}</Badge>
            {aktif.istenen_tarih && <span>İstenen: {fmtDate(aktif.istenen_tarih)}</span>}
            {aktif.gerekce && <span style={{ color: 'var(--adm-tx3)' }}>“{aktif.gerekce}”</span>}
          </div>
          <Card title="Teklif karşılaştırma" pad={0}>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr><th style={th}>Hammadde</th><th style={{ ...th, textAlign: 'right' }}>Miktar</th>{aTk.map(t => <th key={t.id} style={{ ...th, textAlign: 'right', minWidth: 130 }}>{tedId[t.tedarikci_id]?.ad || '—'}{aktif.secilen_teklif_id === t.id && <Badge tone="green" style={{ marginLeft: 4 }}>seçildi</Badge>}</th>)}</tr></thead>
              <tbody>
                {aKs.map(k => { const h = hamId[k.hammadde_id]; const fl = aTk.map(t => fiyat[`${t.id}|${k.id}`]).filter((x): x is number => x != null); const min = fl.length > 1 ? Math.min(...fl) : null
                  return <tr key={k.id} className="adm-row"><td style={td}><b>{h?.ad || '—'}</b><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>stok {fmtN(+h?.mevcut_stok || 0, 0)} · ort. maliyet {fmt(+h?.ortalama_maliyet || 0)}</div></td><td style={{ ...td, textAlign: 'right' }}>{fmtN(+k.miktar, 2)} {h?.birim}</td>
                    {aTk.map(t => { const f = fiyat[`${t.id}|${k.id}`]; const ort = +h?.ortalama_maliyet || 0; const fark = f != null && ort > 0 ? ((f - ort) / ort) * 100 : null
                      return <td key={t.id} style={{ ...td, textAlign: 'right', background: f != null && f === min ? 'rgba(31,157,99,.12)' : undefined }}>{f == null ? <span style={{ color: 'var(--adm-amber)' }}>fiyat yok</span> : <>{fmt(f)}{fark != null && <div style={{ fontSize: 10.5, color: fark > 0 ? 'var(--adm-red)' : 'var(--adm-green)' }}>{fark > 0 ? '+' : ''}{fmtN(fark, 1)}% maliyete göre</div>}</>}</td> })}</tr> })}
                {aTk.length > 0 && <>
                  <tr><td style={{ ...td, fontWeight: 700 }} colSpan={2}>Toplam (KDV hariç)</td>{aTk.map(t => { const top = teklifToplam(t, aKs); return <td key={t.id} style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{top == null ? <Badge tone="amber">eksik teklif</Badge> : <>{fmt(top)}{top === enUcuzToplam && aTk.filter(x => teklifToplam(x, aKs) != null).length > 1 && <div><Badge tone="green">en ucuz</Badge></div>}</>}</td> })}</tr>
                  <tr><td style={td} colSpan={2}>Termin / vade / geçerlilik</td>{aTk.map(t => <td key={t.id} style={{ ...td, textAlign: 'right', fontSize: 12, color: t.gecerlilik && t.gecerlilik < bugun() ? 'var(--adm-red)' : undefined }}>{t.teslim_gun != null ? `${t.teslim_gun} gün` : '—'} · {t.vade_gun != null ? `${t.vade_gun} gün` : '—'}<div>{t.gecerlilik ? `${fmtDate(t.gecerlilik)}${t.gecerlilik < bugun() ? ' (doldu)' : ''}` : ''}</div>{t.notlar && <div style={{ color: 'var(--adm-tx3)' }}>{t.notlar}</div>}</td>)}</tr>
                  {aktif.durum === 'beklemede' && <tr><td style={td} colSpan={2} />{aTk.map(t => <td key={t.id} style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="adm-btn" style={{ padding: '4px 10px', fontSize: 12 }} disabled={busy || teklifToplam(t, aKs) == null} title={teklifToplam(t, aKs) == null ? 'Tüm kalemlere fiyat girilmeli' : ''} onClick={() => sec(t)}><ShoppingCart size={12} />Seç ve sipariş ver</button>{' '}
                    <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => teklifAc(t)}><Pencil size={12} /></button>{' '}
                    <button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={() => teklifSil(t)}><Trash2 size={12} /></button></td>)}</tr>}
                </>}
              </tbody>
            </table></div>
            {aTk.length === 0 && <p style={{ margin: 0, padding: '10px 18px', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Henüz teklif yok. Aşağıdan tedarikçi teklifini ekleyin.</p>}
            <p style={{ fontSize: 11, color: 'var(--adm-tx3)', margin: 0, padding: '6px 18px 10px' }}>Fiyatlar TL ve KDV hariç girilir. Yeşil hücre kalemin en ucuz fiyatıdır; siparişe çevirmek için teklifte tüm kalemlere fiyat olmalıdır. En ucuz toplam her zaman en iyisi olmayabilir (termin ve vadeye de bakın).</p>
          </Card>

          {aktif.durum === 'beklemede' && !tf && <button className="adm-btn" style={{ marginTop: 12 }} onClick={() => teklifAc()}><Plus size={13} />Tedarikçi teklifi ekle</button>}
          {tf && aktif.durum === 'beklemede' && (
            <form onSubmit={teklifKaydet} style={{ marginTop: 14 }}>
              <b style={{ fontSize: 13 }}>{tf.id ? 'Teklifi düzenle' : 'Teklif ekle'}</b>
              <FormGrid cols={4}>
                <Field label="Tedarikçi *" span={2}><select className="adm-inp" required disabled={!!tf.id} value={tf.tedarikci_id} onChange={e => setTf(x => x && ({ ...x, tedarikci_id: e.target.value }))}><option value="">— Seçin —</option>{ted.filter(t => tf.id || !aTk.some(k => k.tedarikci_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}</select></Field>
                <Field label="Termin (gün)"><input type="number" min="0" max="365" className="adm-inp" value={tf.teslim_gun} onChange={e => setTf(x => x && ({ ...x, teslim_gun: e.target.value }))} /></Field>
                <Field label="Vade (gün)"><input type="number" min="0" max="365" className="adm-inp" value={tf.vade_gun} onChange={e => setTf(x => x && ({ ...x, vade_gun: e.target.value }))} /></Field>
                <Field label="Geçerlilik"><input type="date" className="adm-inp" value={tf.gecerlilik} onChange={e => setTf(x => x && ({ ...x, gecerlilik: e.target.value }))} /></Field>
                <Field label="Not" span={3}><input className="adm-inp" maxLength={500} value={tf.notlar} onChange={e => setTf(x => x && ({ ...x, notlar: e.target.value }))} /></Field>
              </FormGrid>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                <thead><tr><th style={th}>Hammadde</th><th style={{ ...th, textAlign: 'right' }}>Miktar</th><th style={{ ...th, width: 170 }}>Birim fiyat (₺, KDV hariç)</th></tr></thead>
                <tbody>{aKs.map(k => <tr key={k.id}><td style={td}>{hamId[k.hammadde_id]?.ad}</td><td style={{ ...td, textAlign: 'right' }}>{fmtN(+k.miktar, 2)} {hamId[k.hammadde_id]?.birim}</td><td style={{ padding: 4 }}><input type="number" min="0" step="any" className="adm-inp" value={tf.fiyat[k.id] ?? ''} onChange={e => setTf(x => x && ({ ...x, fiyat: { ...x.fiyat, [k.id]: e.target.value } }))} /></td></tr>)}</tbody>
              </table>
              {ted.length === 0 && <p style={{ fontSize: 12, color: 'var(--adm-amber)' }}>Tedarikçi bulunamadı. Muhasebe → Cari Hesaplar’dan türü “Tedarikçi” olan bir cari ekleyin.</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Teklifi Kaydet'}</button><button type="button" className="adm-btn-ghost" onClick={() => setTf(null)}>Vazgeç</button></div>
            </form>)}
          {aktif.durum === 'siparise_donustu' && <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)' }}>Sipariş oluşturuldu. <Link href="/admin/dashboard/satinalma/siparisler">Siparişler</Link> sayfasından onaylayıp teslim alabilirsiniz.</p>}
        </>}
      </Modal>
      {toast.node}
    </div>
  )
}
const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--adm-tx3)', borderBottom: '1px solid var(--adm-bdr)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--adm-bdr)' }
