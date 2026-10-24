'use client'
import { useCallback, useEffect, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web, webAll } from '@/lib/web-data'
import { muh } from '@/lib/muhasebe-client'
import { fmtDateTime, fmtInt } from '@/lib/fmt'
import { guvenliHttp } from '@/lib/potansiyel'
import KartvizitTara from '@/components/admin/KartvizitTara'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Drawer, InfoRow, Divider, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Mail, Phone, MessageCircle, Globe, MapPin, Trash2, UserPlus, Target, Sparkles, PhoneCall, Handshake } from 'lucide-react'

const ST: Record<string, { l: string; tone: any }> = {
  yeni: { l: 'Yeni', tone: 'ac' }, arandi: { l: 'Arandı', tone: 'blue' }, gorusuldu: { l: 'Görüşüldü', tone: 'amber' },
  teklif: { l: 'Teklif verildi', tone: 'amber' }, musteri: { l: 'Müşteri oldu', tone: 'green' }, olumsuz: { l: 'Olumsuz', tone: 'muted' },
}
const wa = (t: string) => { const d = (t || '').replace(/\D/g, ''); return d.startsWith('90') ? d : d.startsWith('0') ? '9' + d : d.length === 10 ? '90' + d : d }
const alan = (v?: string | null) => v || '—'

export default function PotansiyelMusterilerPage() {
  const toast = useToast()
  const [items, setItems] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('yeni')
  const [sel, setSel] = useState<any>(null)
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const [b, c] = await Promise.all([webAll('gelenveriler', '*', q => q.order('created_at', { ascending: false })), muh.all('cari_hesaplar', 'id,ad,email,telefon').catch(() => [])])
    setItems(b); setCariler(c); setLoading(false)
    setSel((s: any) => (s ? b.find((x: any) => x.id === s.id) || null : null))
  }, [])
  useEffect(() => { load() }, [load])

  const cnt = (d: string) => items.filter(b => b.durum === d).length
  const liste = items.filter(b => tab === 'hepsi' || b.durum === tab)
  const tel = (b: any) => (b.telefon || '').replace(/\D/g, '')
  const cariMi = (b: any) => cariler.find(c => (c.email && b.eposta && c.email.toLowerCase() === b.eposta.toLowerCase()) || (c.telefon && tel(b) && c.telefon.replace(/\D/g, '') === tel(b)))

  async function durum(b: any, s: string) {
    const { error } = await web.from('gelenveriler').update({ durum: s }).eq('id', b.id)
    if (error) return toast.show(error.message, true)
    toast.show(`Durum: ${ST[s].l}`); load()
  }
  async function topluDurum(rows: any[], s: string, clear: () => void) {
    const { error } = await web.from('gelenveriler').update({ durum: s }).in('id', rows.map(r => r.id))
    if (error) return toast.show(error.message, true)
    toast.show(`${rows.length} kayıt: ${ST[s].l}`); clear(); load()
  }
  async function topluSil(rows: any[]): Promise<string | void> {
    const { error } = await web.from('gelenveriler').delete().in('id', rows.map(r => r.id))
    if (error) return error.message
    toast.show(`${rows.length} kayıt silindi`); setSel(null); load()
  }
  async function tekSil(b: any) {
    if (!confirm(`${b.baslik} kaydı kalıcı silinsin mi?`)) return
    const err = await topluSil([b])
    if (err) toast.show(err, true)
  }
  async function ac(b: any) { setSel(b); setNotes(b.notlar || '') }
  async function notKaydet() {
    if (!sel || notes === (sel.notlar || '')) return
    const { error } = await web.from('gelenveriler').update({ notlar: notes.trim() || null }).eq('id', sel.id)
    toast.show(error ? error.message : 'Not kaydedildi', !!error); if (!error) load()
  }
  async function cariEkle(b: any) {
    if (cariMi(b)) return toast.show('Bu işletme zaten cari olarak kayıtlı', true)
    const r: any = await muh.from('cari_hesaplar').insert({ tip: 'musteri', ad: b.baslik, telefon: b.telefon || null, email: b.eposta || null, adres: b.adres || null, notlar: `Potansiyel müşteriden eklendi${b.kategori ? ` (${b.kategori})` : ''}${b.website ? `\n${b.website}` : ''}` })
    if (r?.error) return toast.show(r.error, true)
    await web.from('gelenveriler').update({ durum: 'musteri' }).eq('id', b.id)
    toast.show('Müşteri carisi oluşturuldu (Muhasebe → Cari)'); load()
  }

  const cols: Col<any>[] = [
    { key: 'tarih', label: 'Eklenme', width: 132, sort: b => b.created_at, render: b => <span style={{ fontSize: 12 }}>{fmtDateTime(b.created_at)}</span>, csv: b => b.created_at },
    { key: 'baslik', label: 'İşletme', sort: b => b.baslik, render: b => <div><div style={{ fontWeight: 600 }}>{b.baslik}</div>{b.kategori && <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{b.kategori}</div>}</div>, csv: b => b.baslik },
    { key: 'telefon', label: 'Telefon', width: 140, sort: b => b.telefon || '', render: b => b.telefon ? <a href={`tel:${tel(b)}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12.5 }}>{b.telefon}</a> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, csv: b => b.telefon },
    { key: 'eposta', label: 'E-posta', sort: b => b.eposta || '', render: b => b.eposta ? <a href={`mailto:${b.eposta}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12.5 }}>{b.eposta}</a> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true, csv: b => b.eposta },
    { key: 'website', label: 'Web sitesi', sort: b => b.website || '', render: b => guvenliHttp(b.website) ? <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" onClick={e => e.stopPropagation()} style={{ fontSize: 12.5 }}>{b.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 32)}</a> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true, csv: b => b.website },
    { key: 'adres', label: 'Adres', render: b => <span style={{ fontSize: 12, color: 'var(--adm-tx3)', display: 'inline-block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.adres || '—'}</span>, hideSm: true, hidden: true, csv: b => b.adres },
    { key: 'harita', label: 'Harita', hidden: true, render: b => b.harita_url || '', csv: b => b.harita_url },
    { key: 'durum', label: 'Durum', width: 120, sort: b => b.durum, render: b => <Badge tone={ST[b.durum]?.tone || 'muted'}>{ST[b.durum]?.l || b.durum}</Badge>, csv: b => ST[b.durum]?.l || b.durum },
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Potansiyel Müşteriler" />
      <Page>
        <PageHead title="Potansiyel Müşteriler" sub="n8n ile toplanan işletme kayıtları ve fuarda okutulan kartvizitler — arayın, durumunu izleyin, müşteri olunca cariye dönüştürün" actions={<KartvizitTara onKaydedildi={load} onMesaj={(m, h) => toast.show(m, !!h)} />} />
        <KpiGrid min={180}>
          <Kpi label="Toplam Kayıt" value={fmtInt(items.length)} Icon={Target} color="var(--adm-blue)" sub={`${fmtInt(items.filter(b => b.telefon).length)} telefonlu · ${fmtInt(items.filter(b => b.eposta).length)} e-postalı`} onClick={() => setTab('hepsi')} />
          <Kpi label="Yeni (işlem bekleyen)" value={fmtInt(cnt('yeni'))} Icon={Sparkles} color={cnt('yeni') ? 'var(--adm-ac)' : 'var(--adm-green)'} sub="henüz aranmadı" onClick={() => setTab('yeni')} />
          <Kpi label="Görüşme Sürecinde" value={fmtInt(cnt('arandi') + cnt('gorusuldu') + cnt('teklif'))} Icon={PhoneCall} color="var(--adm-amber)" sub={`${cnt('teklif')} teklif verildi`} />
          <Kpi label="Müşteri Oldu" value={fmtInt(cnt('musteri'))} Icon={Handshake} color="var(--adm-green)" sub={items.length ? `%${((cnt('musteri') / items.length) * 100).toFixed(1)} dönüşüm` : '—'} />
        </KpiGrid>
        <div style={{ marginBottom: 12 }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'yeni', l: 'Yeni', n: cnt('yeni') }, { v: 'arandi', l: 'Arandı', n: cnt('arandi') }, { v: 'gorusuldu', l: 'Görüşüldü', n: cnt('gorusuldu') }, { v: 'teklif', l: 'Teklif', n: cnt('teklif') }, { v: 'musteri', l: 'Müşteri', n: cnt('musteri') }, { v: 'olumsuz', l: 'Olumsuz', n: cnt('olumsuz') }, { v: 'hepsi', l: 'Hepsi', n: items.length }]} /></div>
        <DataGrid rows={liste} cols={cols} rowKey={b => b.id} loading={loading} csvName="potansiyel-musteriler" storageKey="potansiyel" onRowClick={ac} activeKey={sel?.id} defaultSort={{ key: 'tarih', dir: 'desc' }} selectable
          searchText={b => `${b.baslik} ${b.telefon || ''} ${b.eposta || ''} ${b.website || ''} ${b.adres || ''} ${b.kategori || ''}`} searchPlaceholder="İşletme, telefon, e-posta, adres, kategori..."
          bulkActions={(rows, clear) => <>
            <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluDurum(rows, 'arandi', clear)}><Phone size={12} />Arandı</button>
            <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluDurum(rows, 'olumsuz', clear)}>Olumsuz</button></>}
          onBulkDelete={topluSil} deleteNoun="kayıt"
          emptyTitle="Potansiyel müşteri yok" emptySub="n8n akışı POST /api/webhooks/potansiyel adresine veri gönderdiğinde burada görünür (Bildirimler sayfasındaki bağlantı kartına bakın)" />
      </Page>

      <Drawer open={!!sel} onClose={() => setSel(null)} width={500} title={sel && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{sel.baslik}<Badge tone={ST[sel.durum]?.tone || 'muted'}>{ST[sel.durum]?.l || sel.durum}</Badge></span>} sub={sel && `${sel.kategori || 'Kategori yok'} · ${fmtDateTime(sel.created_at)}`}
        footer={sel && <><button className="adm-btn-danger" onClick={() => tekSil(sel)}><Trash2 size={13} /></button>
          {cariMi(sel) ? <Badge tone="green">Cari kayıtlı: {cariMi(sel).ad}</Badge> : <button className="adm-btn" onClick={() => cariEkle(sel)}><UserPlus size={14} />Müşteri carisi oluştur</button>}</>}>
        {sel && <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {sel.telefon && <a className="adm-btn-ghost" href={`tel:${tel(sel)}`} style={{ textDecoration: 'none' }} onClick={() => sel.durum === 'yeni' && durum(sel, 'arandi')}><Phone size={13} />Ara</a>}
            {sel.telefon && <a className="adm-btn-ghost" target="_blank" rel="noreferrer" href={`https://wa.me/${wa(sel.telefon)}?text=${encodeURIComponent(`Merhaba, Alya Plastik'ten yazıyoruz. Plastik saksı, sepet ve depolama ürünlerimiz için toptan çalışma imkânını görüşmek isteriz.`)}`} style={{ textDecoration: 'none' }}><MessageCircle size={13} />WhatsApp</a>}
            {sel.eposta && <a className="adm-btn-ghost" href={`mailto:${sel.eposta}`} style={{ textDecoration: 'none' }}><Mail size={13} />E-posta</a>}
            {guvenliHttp(sel.website) && <a className="adm-btn-ghost" href={sel.website} target="_blank" rel="noopener noreferrer nofollow" style={{ textDecoration: 'none' }}><Globe size={13} />Web sitesi</a>}
            {guvenliHttp(sel.harita_url) && <a className="adm-btn-ghost" href={sel.harita_url} target="_blank" rel="noopener noreferrer nofollow" style={{ textDecoration: 'none' }}><MapPin size={13} />Harita</a>}
          </div>
          <InfoRow k="Telefon" v={alan(sel.telefon)} /><InfoRow k="E-posta" v={alan(sel.eposta)} /><InfoRow k="Web sitesi" v={alan(sel.website)} /><InfoRow k="Adres" v={alan(sel.adres)} /><InfoRow k="Kategori" v={alan(sel.kategori)} /><InfoRow k="Kaynak" v={alan(sel.kaynak)} />
          <Divider label="Durum" />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{Object.entries(ST).map(([k, v]) => <button key={k} className={sel.durum === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => durum(sel, k)}>{v.l}</button>)}</div>
          <Divider label="Not" />
          <textarea className="adm-inp" rows={4} value={notes} onChange={e => setNotes(e.target.value)} onBlur={notKaydet} placeholder="Görüşme notu, ilgi düzeyi, teklif bilgisi..." />
        </div>}
      </Drawer>
      {toast.node}
    </div>
  )
}
