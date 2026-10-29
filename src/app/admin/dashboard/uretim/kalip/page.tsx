'use client'
import { useAcParam } from '@/lib/ac-param'
import { useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmt, fmtK, fmtInt, fmtDate, todayISO, daysBetween } from '@/lib/fmt'
import { useUretim, byId, KALIP_DURUM, EMIR_DURUM, kalipBaski } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, InfoRow, Divider, Empty, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import { ListChecks, Plus, Pencil, Trash2, Wrench, AlertTriangle, Package, Layers, Coins } from 'lucide-react'

const bos = { kod: '', ad: '', urettigi_urun_id: '', kavite_sayisi: '1', hedef_cevrim_suresi: '', lokasyon: '', bakim_periyodu_gun: '90', sonraki_bakim: '', durum: 'depoda', notlar: '', uyumlu: [] as string[] }
const bakimBos = () => ({ tarih: todayISO(), aciklama: '', maliyet: '' })

// bakım durumu — veritabanındaki v_kalip_bakim_durumu görünümüyle aynı mantık
function bakimDurumu(k: any) {
  if (!k.sonraki_bakim) return 'tanimsiz'
  const g = daysBetween(todayISO(), k.sonraki_bakim)
  return g < 0 ? 'vadesi_gecti' : g <= 14 ? 'yaklasiyor' : 'normal'
}
const BAKIM: Record<string, { l: string; tone: any }> = { normal: { l: 'Normal', tone: 'green' }, yaklasiyor: { l: 'Yaklaşıyor', tone: 'amber' }, vadesi_gecti: { l: 'Vadesi geçti', tone: 'red' }, tanimsiz: { l: 'Tanımsız', tone: 'muted' } }

export default function KalipPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['kaliplar', 'products', 'bakimlar', 'emirler', 'baskiRows', 'makineler'])
  const [tab, setTab] = useState('hepsi')
  const [detay, setDetay] = useState<any>(null)
  const [dTab, setDTab] = useState('bilgi')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [bakim, setBakim] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)

  const urun = useMemo(() => byId(d.products), [d.products])
  const K = useMemo(() => {
    const o: Record<string, any> = {}
    d.kaliplar.forEach((k: any) => {
      const bk = d.bakimlar.filter((b: any) => b.kalip_id === k.id)
      o[k.id] = {
        baski: kalipBaski(k.id, d.baskiRows).toplam, sonrakiBaski: kalipBaski(k.id, d.baskiRows).bakimdanBeri, bakimlar: bk,
        maliyet: sum(bk, (b: any) => b.maliyet), bd: bakimDurumu(k), emirler: d.emirler.filter((e: any) => e.kalip_id === k.id),
      }
    })
    return o
  }, [d])

  const cnt = (f: (k: any) => boolean) => d.kaliplar.filter(f).length
  const gereken = cnt(k => ['vadesi_gecti', 'yaklasiyor'].includes(K[k.id]?.bd))
  const yil = todayISO().slice(0, 4)
  const yillikMaliyet = sum(d.bakimlar.filter((b: any) => (b.tarih || '').startsWith(yil)), (b: any) => b.maliyet)
  const liste = d.kaliplar.filter((k: any) => tab === 'hepsi' ? true : tab === 'bakim' ? ['vadesi_gecti', 'yaklasiyor'].includes(K[k.id]?.bd) : k.durum === tab)

  const openNew = () => { setEditing(null); setForm(bos); setModal(true) }
  const openEdit = (k: any) => {
    setEditing(k)
    setForm({ kod: k.kod, ad: k.ad, urettigi_urun_id: k.urettigi_urun_id || '', kavite_sayisi: String(k.kavite_sayisi || 1), hedef_cevrim_suresi: k.hedef_cevrim_suresi ? String(+k.hedef_cevrim_suresi) : '', lokasyon: k.lokasyon || '', bakim_periyodu_gun: String(k.bakim_periyodu_gun || 90), sonraki_bakim: k.sonraki_bakim || '', durum: k.durum, notlar: k.notlar || '', uyumlu: k.uyumlu_makineler || [] })
    setModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (d.kaliplar.some((k: any) => k.kod.toLowerCase() === form.kod.trim().toLowerCase() && k.id !== editing?.id)) return toast.show('Bu kalıp kodu zaten kullanılıyor', true)
    setBusy(true)
    const payload: any = { kod: form.kod.trim(), ad: form.ad.trim(), urettigi_urun_id: form.urettigi_urun_id || null, kavite_sayisi: Math.max(1, +form.kavite_sayisi || 1), hedef_cevrim_suresi: +form.hedef_cevrim_suresi > 0 ? +form.hedef_cevrim_suresi : null, lokasyon: form.lokasyon || null, bakim_periyodu_gun: +form.bakim_periyodu_gun || 90, sonraki_bakim: form.sonraki_bakim || null, durum: form.durum, notlar: form.notlar || null, uyumlu_makineler: form.uyumlu }
    const r: any = editing ? await erp.from('kaliplar').update(payload).eq('id', editing.id) : await erp.from('kaliplar').insert(payload)
    setBusy(false)
    if (r?.error) return toast.show(r.error, true)
    setModal(false); toast.show(editing ? 'Kalıp güncellendi' : 'Kalıp eklendi'); await reload()
  }
  async function durum(k: any, yeni: string) {
    const aktif = K[k.id]?.emirler.find((e: any) => e.durum === 'uretimde')
    if (['bakimda', 'arizali', 'depoda'].includes(yeni) && aktif && !confirm(`${k.ad} kalıbı “${aktif.no}” emrinde kullanılıyor. Yine de değiştirilsin mi?`)) return
    const r: any = await erp.from('kaliplar').update({ durum: yeni }).eq('id', k.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show(`${k.ad}: ${KALIP_DURUM[yeni].l}`); await reload(); setDetay((x: any) => (x?.id === k.id ? { ...x, durum: yeni } : x))
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (await erp.from('kaliplar').delete().eq('id', r.id))?.error, 'kalıp')
    await reload(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} kalıp silindi`)
  }
  async function del(k: any) {
    if (!confirm(`${k.ad} kalıbı silinsin mi?${K[k.id]?.emirler.length ? `\n\n${K[k.id].emirler.length} üretim emrinde kullanılmış.` : ''}`)) return
    const r: any = await erp.from('kaliplar').delete().eq('id', k.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Kalıp silindi'); setDetay(null); reload()
  }

  async function bakimKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy || !bakim) return
    const k = bakim.kalip; setBusy(true)
    try {
      const r: any = await erp.from('kalip_bakim_kayitlari').insert({ kalip_id: k.id, tarih: bakim.tarih, aciklama: bakim.aciklama || null, maliyet: +bakim.maliyet || 0 })
      if (r?.error) throw new Error(r.error)
      const sonraki = new Date(bakim.tarih); sonraki.setDate(sonraki.getDate() + (+k.bakim_periyodu_gun || 90))
      const u: any = await erp.from('kaliplar').update({ son_bakim: bakim.tarih, sonraki_bakim: sonraki.toISOString().slice(0, 10), toplam_baski: K[k.id].baski, ...(['bakimda', 'arizali'].includes(k.durum) ? { durum: 'hazir' } : {}) }).eq('id', k.id)
      if (u?.error) throw new Error(u.error)
      toast.show('Bakım kaydedildi, sonraki bakım planlandı'); setBakim(null); await reload()
      setDetay((x: any) => x?.id === k.id ? { ...x, son_bakim: bakim.tarih, sonraki_bakim: sonraki.toISOString().slice(0, 10) } : x)
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  const cols: Col<any>[] = [
    { key: 'kalip', label: 'Kalıp', sort: k => k.ad, render: k => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 9, background: (KALIP_DURUM[k.durum]?.color || '#999') + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wrench size={15} style={{ color: KALIP_DURUM[k.durum]?.color }} /></div><div><div style={{ fontWeight: 600 }}>{k.ad}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{k.kod}</div></div></div> },
    { key: 'urun', label: 'Ürün', sort: k => urun[k.urettigi_urun_id]?.name || '', render: k => urun[k.urettigi_urun_id]?.name || <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'kavite', label: 'Kavite', align: 'right', width: 70, sort: k => +k.kavite_sayisi, render: k => k.kavite_sayisi, hideSm: true },
    { key: 'durum', label: 'Durum', width: 110, sort: k => k.durum, render: k => <Badge tone={KALIP_DURUM[k.durum]?.tone}>{KALIP_DURUM[k.durum]?.l}</Badge> },
    { key: 'baski', label: 'Toplam Baskı', align: 'right', sort: k => K[k.id]?.baski, render: k => <b style={{ fontFamily: 'JetBrains Mono,monospace' }}>{fmtInt(K[k.id]?.baski)}</b>, total: rs => fmtInt(sum(rs, (k: any) => K[k.id]?.baski)) },
    { key: 'son', label: 'Son Bakım', sort: k => k.son_bakim || '', render: k => k.son_bakim ? fmtDate(k.son_bakim) : '—', hideSm: true },
    {
      key: 'sonraki', label: 'Sonraki Bakım', sort: k => k.sonraki_bakim || '9999', render: k => {
        const b = K[k.id]?.bd, g = k.sonraki_bakim ? daysBetween(todayISO(), k.sonraki_bakim) : null
        return <div><Badge tone={BAKIM[b].tone}>{BAKIM[b].l}</Badge>{k.sonraki_bakim && <div style={{ fontSize: 11, color: b === 'vadesi_gecti' ? 'var(--adm-red)' : 'var(--adm-tx3)', marginTop: 2 }}>{fmtDate(k.sonraki_bakim)} ({g! < 0 ? `${-g!} gün geçti` : `${g} gün`})</div>}</div>
      },
    },
    { key: 'maliyet', label: 'Bakım Maliyeti', align: 'right', sort: k => K[k.id]?.maliyet, render: k => K[k.id]?.maliyet ? <Money v={K[k.id].maliyet} bold={false} /> : '—', total: rs => <Money v={sum(rs, (k: any) => K[k.id]?.maliyet)} />, hidden: true },
    { key: 'lok', label: 'Lokasyon', sort: k => k.lokasyon || '', render: k => k.lokasyon || '—', hidden: true },
    { key: 'act', label: '', width: 130, align: 'right', render: k => (
      <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
        <button className="adm-btn-ghost" style={{ padding: '4px 9px', fontSize: 11.5 }} onClick={() => setBakim({ kalip: k, ...bakimBos() })}><Wrench size={12} />Bakım</button>
        <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => openEdit(k)}><Pencil size={12} /></button>
        <button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={() => del(k)}><Trash2 size={12} /></button>
      </span>) },
  ]

  const dk = detay ? K[detay.id] : null

  useAcParam(!loading, id => { const k = d.kaliplar.find((x: any) => x.id === id); if (k) openEdit(k) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Kalıp Yönetimi" />
      <Page>
        <PageHead title="Kalıp Envanteri" sub="Baskı sayacı, periyodik bakım planı ve bakım maliyetleri" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Kalıp Ekle</button>} />

        <KpiGrid min={180}>
          <Kpi label="Toplam Kalıp" value={d.kaliplar.length} Icon={Layers} color="var(--adm-ac)" sub={`${cnt(k => k.durum === 'uretimde')} üretimde · ${cnt(k => k.durum === 'hazir')} hazır`} />
          <Kpi label="Bakım Gereken" value={gereken} Icon={AlertTriangle} color={gereken ? 'var(--adm-red)' : 'var(--adm-green)'} sub={gereken ? '14 gün içinde ya da geçmiş' : 'Tümü planlı'} onClick={() => setTab('bakim')} />
          <Kpi label="Arızalı / Bakımda" value={cnt(k => ['arizali', 'bakimda'].includes(k.durum))} Icon={Wrench} color="var(--adm-amber)" sub="kullanılamaz" />
          <Kpi label="Toplam Baskı" value={fmtInt(sum(Object.values(K), (x: any) => x.baski))} Icon={Package} color="var(--adm-blue)" sub="tüm kalıplar" />
          <Kpi label={`${yil} Bakım Maliyeti`} value={fmtK(yillikMaliyet)} Icon={Coins} color="var(--adm-amber)" sub={`${d.bakimlar.filter((b: any) => (b.tarih || '').startsWith(yil)).length} bakım kaydı`} />
        </KpiGrid>

        <div style={{ marginBottom: 12 }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: 'hepsi', l: 'Tümü', n: d.kaliplar.length }, { v: 'bakim', l: 'Bakım gereken', n: gereken }, ...Object.entries(KALIP_DURUM).map(([k, v]) => ({ v: k, l: v.l, n: cnt(x => x.durum === k) }))]} />
        </div>

        <DataGrid rows={liste} cols={cols} rowKey={k => k.id} loading={loading} onBulkDelete={topluSil} deleteNoun="kalıp" deleteNote="Kalıbın kullanıldığı üretim emirlerinde kalıp bilgisi boş kalır." csvName="kaliplar" storageKey="kaliplar" onRowClick={k => { setDetay(k); setDTab('bilgi') }} activeKey={detay?.id} selectable bulkActions={(sel) => <button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu(sel)}><ListChecks size={12} />Toplu düzenle</button>}
          searchText={k => `${k.kod} ${k.ad} ${k.lokasyon || ''} ${urun[k.urettigi_urun_id]?.name || ''}`} searchPlaceholder="Kod, ad, ürün, lokasyon..."
          emptyTitle="Kalıp bulunamadı" emptySub="Kalıp Ekle ile envantere ilk kalıbı gir" />
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={560}
        title={detay && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{detay.ad}<Badge tone={KALIP_DURUM[detay.durum]?.tone}>{KALIP_DURUM[detay.durum]?.l}</Badge></span>}
        sub={detay && `${detay.kod} · ${detay.kavite_sayisi} kavite`}
        footer={detay && <><button className="adm-btn-ghost" onClick={() => openEdit(detay)}><Pencil size={13} />Düzenle</button><button className="adm-btn" onClick={() => setBakim({ kalip: detay, ...bakimBos() })}><Wrench size={14} />Bakım Kaydet</button></>}>
        {detay && dk && (
          <div>
            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Toplam baskı</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>{fmtInt(dk.baski)}</b></div>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Bakımdan beri</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>{fmtInt(dk.sonrakiBaski)}</b></div>
                <div style={{ padding: 12, borderRadius: 10, background: dk.bd === 'vadesi_gecti' ? 'var(--adm-red2)' : dk.bd === 'yaklasiyor' ? 'var(--adm-amber2)' : 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Bakım</div><Badge tone={BAKIM[dk.bd].tone}>{BAKIM[dk.bd].l}</Badge></div>
              </div>
              {detay.sonraki_bakim && detay.son_bakim && (() => {
                const top = Math.max(daysBetween(detay.son_bakim, detay.sonraki_bakim), 1), gec = Math.min(Math.max(daysBetween(detay.son_bakim, todayISO()), 0), top)
                return <div style={{ marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--adm-tx3)', marginBottom: 4 }}><span>Bakım aralığı</span><span>{gec}/{top} gün</span></div><div style={{ height: 6, borderRadius: 4, background: 'var(--adm-s2)', overflow: 'hidden' }}><div style={{ width: `${(gec / top) * 100}%`, height: '100%', background: gec / top > 0.9 ? 'var(--adm-red)' : gec / top > 0.7 ? 'var(--adm-amber)' : 'var(--adm-green)' }} /></div></div>
              })()}
              <Tabs value={dTab} onChange={setDTab} tabs={[{ v: 'bilgi', l: 'Bilgiler' }, { v: 'bakim', l: 'Bakım geçmişi', n: dk.bakimlar.length }, { v: 'kullanim', l: 'Kullanım', n: dk.emirler.length }]} />
            </div>

            {dTab === 'bilgi' && (
              <div style={{ padding: 20 }}>
                <p className="adm-kpi-label">Durumu değiştir</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>{Object.entries(KALIP_DURUM).map(([k, v]) => <button key={k} className={detay.durum === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ fontSize: 12, padding: '5px 11px', background: detay.durum === k ? v.color : undefined }} onClick={() => durum(detay, k)}>{v.l}</button>)}</div>
                <InfoRow k="Ürün" v={urun[detay.urettigi_urun_id]?.name || '—'} />
                <InfoRow k="Lokasyon" v={detay.lokasyon || '—'} />
                <InfoRow k="Bakım periyodu" v={`${detay.bakim_periyodu_gun || '—'} gün`} />
                <InfoRow k="Son bakım" v={detay.son_bakim ? fmtDate(detay.son_bakim) : '—'} />
                <InfoRow k="Sonraki bakım" v={detay.sonraki_bakim ? fmtDate(detay.sonraki_bakim) : '—'} />
                <InfoRow k="Uyumlu makineler" v={(detay.uyumlu_makineler || []).map((id: string) => d.makineler.find((m: any) => m.id === id)?.ad).filter(Boolean).join(', ') || '—'} />
                <InfoRow k="Toplam bakım maliyeti" v={fmt(dk.maliyet)} />
                {detay.notlar && <><Divider label="Notlar" /><p style={{ fontSize: 13, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{detay.notlar}</p></>}
                <div style={{ marginTop: 20 }}><button className="adm-btn-danger" onClick={() => del(detay)}><Trash2 size={13} />Kalıbı Sil</button></div>
              </div>
            )}
            {dTab === 'bakim' && (dk.bakimlar.length === 0 ? <Empty icon={<Wrench size={28} />} title="Bakım kaydı yok" sub="Bakım Kaydet ile ilk bakımı gir" /> : dk.bakimlar.map((b: any) => (
              <div key={b.id} className="adm-row"><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(b.tarih)}</div><div style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>{b.aciklama || 'Açıklama yok'}</div></div>{+b.maliyet > 0 && <Money v={+b.maliyet} />}</div>)))}
            {dTab === 'kullanim' && (dk.emirler.length === 0 ? <Empty title="Bu kalıpla emir yok" /> : dk.emirler.map((e: any) => (
              <div key={e.id} className="adm-row"><div style={{ flex: 1 }}><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5 }}>{e.no}</b><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{urun[e.urun_id]?.name} · {fmtInt(e.uretilen_miktar)}/{fmtInt(e.planlanan_miktar)} adet</div></div><Badge tone={EMIR_DURUM[e.durum]?.tone}>{EMIR_DURUM[e.durum]?.l}</Badge></div>)))}
          </div>
        )}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} title={editing ? 'Kalıbı Düzenle' : 'Yeni Kalıp'} width={620}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid>
          <Field label="Kod *"><input className="adm-inp" required autoFocus value={form.kod} onChange={e => setForm((f: any) => ({ ...f, kod: e.target.value }))} placeholder="KL-001" /></Field>
          <Field label="Ad *"><input className="adm-inp" required value={form.ad} onChange={e => setForm((f: any) => ({ ...f, ad: e.target.value }))} /></Field>
          <Field label="Ürettiği ürün"><select className="adm-inp" value={form.urettigi_urun_id} onChange={e => setForm((f: any) => ({ ...f, urettigi_urun_id: e.target.value }))}><option value="">—</option>{d.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Kavite sayısı" hint="Bir çevrimde kaç adet çıkar"><input type="number" min="1" className="adm-inp" value={form.kavite_sayisi} onChange={e => setForm((f: any) => ({ ...f, kavite_sayisi: e.target.value }))} /></Field>
          <Field label="Hedef çevrim (sn)" hint="Üretim emrinde kalıp seçilince otomatik gelir"><input type="number" step="0.1" min="0" className="adm-inp" value={form.hedef_cevrim_suresi} onChange={e => setForm((f: any) => ({ ...f, hedef_cevrim_suresi: e.target.value }))} /></Field>
          <Field label="Bakım periyodu (gün)"><input type="number" min="1" className="adm-inp" value={form.bakim_periyodu_gun} onChange={e => setForm((f: any) => ({ ...f, bakim_periyodu_gun: e.target.value }))} /></Field>
          <Field label="Sonraki bakım tarihi"><input type="date" className="adm-inp" value={form.sonraki_bakim} onChange={e => setForm((f: any) => ({ ...f, sonraki_bakim: e.target.value }))} /></Field>
          <Field label="Lokasyon"><input className="adm-inp" value={form.lokasyon} onChange={e => setForm((f: any) => ({ ...f, lokasyon: e.target.value }))} placeholder="Raf A-3" /></Field>
          <Field label="Durum"><select className="adm-inp" value={form.durum} onChange={e => setForm((f: any) => ({ ...f, durum: e.target.value }))}>{Object.entries(KALIP_DURUM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></Field>
          <Field label="Uyumlu makineler" span={2}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{d.makineler.length === 0 ? <span style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>Önce makine ekle</span> : d.makineler.map((m: any) => (
              <button type="button" key={m.id} className={`adm-chip ${form.uyumlu.includes(m.id) ? 'on' : ''}`} onClick={() => setForm((f: any) => ({ ...f, uyumlu: f.uyumlu.includes(m.id) ? f.uyumlu.filter((x: string) => x !== m.id) : [...f.uyumlu, m.id] }))}>{m.ad}</button>))}</div>
          </Field>
          <Field label="Notlar" span={2}><textarea className="adm-inp" rows={2} value={form.notlar} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field>
        </FormGrid>
      </Modal>

      <Modal open={!!bakim} onClose={() => setBakim(null)} onSubmit={bakimKaydet} width={480} title={bakim && `${bakim.kalip.ad} — Bakım Kaydı`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setBakim(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        {bakim && <FormGrid>
          <Field label="Bakım tarihi"><input type="date" className="adm-inp" required value={bakim.tarih} onChange={e => setBakim((b: any) => ({ ...b, tarih: e.target.value }))} /></Field>
          <Field label="Maliyet (₺)"><input type="number" step="0.01" min="0" className="adm-inp" value={bakim.maliyet} onChange={e => setBakim((b: any) => ({ ...b, maliyet: e.target.value }))} /></Field>
          <Field label="Yapılan işlem" span={2}><textarea className="adm-inp" rows={3} value={bakim.aciklama} onChange={e => setBakim((b: any) => ({ ...b, aciklama: e.target.value }))} placeholder="Temizlik, yağlama, pim değişimi..." /></Field>
          <p style={{ gridColumn: 'span 2', margin: 0, fontSize: 11.5, color: 'var(--adm-tx3)' }}>Sonraki bakım {bakim.kalip.bakim_periyodu_gun || 90} gün sonrasına planlanır; kalıp bakımdaysa “Hazır” yapılır ve baskı sayacı güncellenir.</p>
        </FormGrid>}
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); reload() }} client={erp} table="kaliplar" fields={[
        { key: 'durum', label: 'Durum', type: 'select', hint: 'Üretimde durumu buradan atanmaz', options: ['hazir', 'depoda', 'bakimda', 'arizali'].map(k => ({ v: k, l: KALIP_DURUM[k].l })) },
        { key: 'lokasyon', label: 'Lokasyon', type: 'text' },
        { key: 'bakim_periyodu_gun', label: 'Bakım periyodu (gün)', type: 'number' },
        { key: 'sonraki_bakim', label: 'Sonraki bakım', type: 'date', bosYapilabilir: true },
      ]} />
      {toast.node}
    </div>
  )
}
