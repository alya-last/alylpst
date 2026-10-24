'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web, webAll } from '@/lib/web-data'
import { muh } from '@/lib/muhasebe-client'
import { fmtDateTime, daysBetween, fmtInt } from '@/lib/fmt'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Drawer, InfoRow, Divider, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { FileText, MessageSquare, Mail, Phone, MessageCircle, Archive, CheckCheck, Eye, Trash2, UserPlus, Clock, Inbox, Reply, Sparkles, Copy, ShieldAlert } from 'lucide-react'
import { aiIstek } from '@/lib/ai-client'

const ST: Record<string, { l: string; tone: any }> = { new: { l: 'Yeni', tone: 'ac' }, read: { l: 'Okundu', tone: 'blue' }, replied: { l: 'Yanıtlandı', tone: 'green' }, archived: { l: 'Arşiv', tone: 'muted' } }
const KAT: Record<string, string> = { fiyat_talebi: 'Fiyat talebi', urun_bilgisi: 'Ürün bilgisi', ihracat: 'İhracat', ozel_kalip: 'Özel kalıp', katalog: 'Katalog', sikayet: 'Şikayet', is_basvurusu: 'İş başvurusu', tedarikci_teklifi: 'Tedarikçi teklifi', diger: 'Diğer' }
const ONCELIK: Record<string, { l: string; tone: any }> = { yuksek: { l: 'Yüksek', tone: 'red' }, orta: { l: 'Orta', tone: 'amber' }, dusuk: { l: 'Düşük', tone: 'muted' } }
const wa = (t: string) => { const d = (t || '').replace(/\D/g, ''); return d.startsWith('90') ? d : d.startsWith('0') ? '9' + d : d.length === 10 ? '90' + d : d }

export default function BasvurularPage() {
  const toast = useToast()
  const [items, setItems] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('bekleyen')
  const [sel, setSel] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const load = useCallback(async () => {
    const [b, c] = await Promise.all([webAll('contact_submissions', '*', q => q.order('created_at', { ascending: false })), muh.all('cari_hesaplar', 'id,ad,email,telefon').catch(() => [])])
    setItems(b); setCariler(c); setLoading(false)
    setSel((s: any) => (s ? b.find((x: any) => x.id === s.id) || null : null))
  }, [])
  useEffect(() => { load() }, [load])

  const st = (b: any) => b.status || 'new'
  const cariMi = (b: any) => cariler.find(c => (c.email && c.email.toLowerCase() === (b.email || '').toLowerCase()) || (c.telefon && b.phone && c.telefon.replace(/\D/g, '') === b.phone.replace(/\D/g, '')))
  const bekleyen = (b: any) => ['new', 'read'].includes(st(b))
  const gecikmis = (b: any) => bekleyen(b) && daysBetween(b.created_at) >= 2
  const cnt = (f: (b: any) => boolean) => items.filter(f).length
  const ay = new Date().toISOString().slice(0, 7)
  const yanitSure = useMemo(() => { const r = items.filter(b => st(b) === 'replied' && b.updated_at); return r.length ? r.reduce((s, b) => s + (+new Date(b.updated_at) - +new Date(b.created_at)) / 3600000, 0) / r.length : 0 }, [items])
  const liste = items.filter(b => tab === 'hepsi' ? true : tab === 'bekleyen' ? bekleyen(b) : tab === 'spam' ? !!b.ai_spam : st(b) === tab)

  async function durum(b: any, s: string, sessiz = false) {
    const { error } = await web.from('contact_submissions').update({ status: s, updated_at: new Date().toISOString() }).eq('id', b.id)
    if (error) return toast.show(error.message, true)
    if (!sessiz) toast.show(`Durum: ${ST[s].l}`); load()
  }
  async function aiAnaliz(b: any) {
    setAiBusy(true)
    try { await aiIstek('basvuru_analiz', { id: b.id }); toast.show('AI analizi tamamlandı'); await load() } catch (e: any) { toast.show(e.message, true) }
    setAiBusy(false)
  }
  async function taslakKopyala(t: string) { try { await navigator.clipboard.writeText(t); toast.show('Taslak kopyalandı') } catch { toast.show('Kopyalanamadı', true) } }
  async function ac(b: any) { setSel(b); setNotes(b.notes || ''); if (st(b) === 'new') durum(b, 'read', true) }
  async function notKaydet() { if (!sel) return; const { error } = await web.from('contact_submissions').update({ notes, updated_at: new Date().toISOString() }).eq('id', sel.id); toast.show(error ? error.message : 'Not kaydedildi', !!error) }
  async function sil(b: any) { if (!confirm(`${b.name} başvurusu kalıcı silinsin mi?`)) return; await web.from('contact_submissions').delete().eq('id', b.id); toast.show('Başvuru silindi'); setSel(null); load() }
  async function topluSil(rows: any[]): Promise<string | void> {
    const { error } = await web.from('contact_submissions').delete().in('id', rows.map(r => r.id))
    if (error) return error.message
    toast.show(`${rows.length} başvuru silindi`); setSel(null); load()
  }
  async function carEkle(b: any) {
    if (cariMi(b)) return toast.show('Bu kişi zaten cari olarak kayıtlı', true)
    const r: any = await muh.from('cari_hesaplar').insert({ tip: 'musteri', ad: b.company || b.name, telefon: b.phone || null, email: b.email, notlar: `Web başvurusundan eklendi${b.subject ? ` (${b.subject})` : ''}\n${b.message || ''}`.slice(0, 500) })
    if (r?.error) return toast.show(r.error, true)
    toast.show('Müşteri carisi oluşturuldu (Muhasebe → Cari)'); load()
  }
  async function topluDurum(rows: any[], s: string, clear: () => void) { for (const b of rows) await web.from('contact_submissions').update({ status: s, updated_at: new Date().toISOString() }).eq('id', b.id); toast.show(`${rows.length} başvuru: ${ST[s].l}`); clear(); load() }

  const cols: Col<any>[] = [
    { key: 'tarih', label: 'Tarih', width: 132, sort: b => b.created_at, render: b => <div style={{ fontSize: 12 }}>{fmtDateTime(b.created_at)}{gecikmis(b) && <div style={{ fontSize: 10.5, color: 'var(--adm-red)', fontWeight: 700 }}>{daysBetween(b.created_at)} gündür yanıtsız</div>}</div> },
    { key: 'kisi', label: 'Kişi / Firma', sort: b => b.name, render: b => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 16, background: st(b) === 'new' ? 'var(--adm-ac2)' : 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: st(b) === 'new' ? 'var(--adm-ac)' : 'var(--adm-tx3)' }}>{(b.name || '?').slice(0, 1).toUpperCase()}</div><div><div style={{ fontWeight: st(b) === 'new' ? 700 : 600 }}>{b.name}{cariMi(b) && <Badge tone="green" style={{ marginLeft: 6, fontSize: 9.5 }}>Cari</Badge>}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{b.company || b.email}</div></div></div> },
    { key: 'konu', label: 'Konu / Ürün', sort: b => b.subject || '', render: b => <div><div>{b.subject || '—'}</div>{b.product && <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{b.product}</div>}</div>, hideSm: true },
    { key: 'ai', label: 'AI', width: 130, sort: b => b.ai_oncelik === 'yuksek' ? 3 : b.ai_oncelik === 'orta' ? 2 : b.ai_oncelik ? 1 : 0, hideSm: true,
      render: b => !b.ai_analiz_at ? <span style={{ color: 'var(--adm-tx3)', fontSize: 11 }}>—</span> : <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>{b.ai_spam ? <Badge tone="red">Şüpheli</Badge> : <Badge tone={ONCELIK[b.ai_oncelik]?.tone || 'muted'}>{ONCELIK[b.ai_oncelik]?.l || '—'}</Badge>}<span style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{KAT[b.ai_kategori] || b.ai_kategori}</span></div> },
    { key: 'mesaj', label: 'Mesaj', render: b => <span style={{ fontSize: 12, color: 'var(--adm-tx3)', display: 'inline-block', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.message}</span>, hideSm: true },
    { key: 'durum', label: 'Durum', width: 110, sort: b => st(b), render: b => <Badge tone={ST[st(b)].tone}>{ST[st(b)].l}</Badge> },
  ]
  const yanit = (b: any) => `mailto:${b.email}?subject=${encodeURIComponent('Re: ' + (b.subject || 'Alya Plastik bilgi talebi'))}&body=${encodeURIComponent(b.ai_taslak || `Merhaba ${b.name},\n\nBaşvurunuz için teşekkür ederiz.\n\n\n\nSaygılarımızla,\nAlya Plastik`)}`

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Başvuru Yönetimi" />
      <Page>
        <PageHead title="Web Başvuruları" sub="İletişim formundan gelen talepler — yanıt süresi takibi ve tek tıkla cariye dönüştürme" />
        <KpiGrid min={180}>
          <Kpi label="Yanıt Bekleyen" value={cnt(bekleyen)} Icon={Inbox} color={cnt(bekleyen) ? 'var(--adm-ac)' : 'var(--adm-green)'} sub={`${cnt(b => st(b) === 'new')} yeni · ${cnt(b => st(b) === 'read')} okundu`} onClick={() => setTab('bekleyen')} />
          <Kpi label="2+ Gün Yanıtsız" value={cnt(gecikmis)} Icon={Clock} color={cnt(gecikmis) ? 'var(--adm-red)' : 'var(--adm-green)'} sub="SLA aşımı" />
          <Kpi label="Bu Ay" value={cnt(b => (b.created_at || '').startsWith(ay))} Icon={MessageSquare} color="var(--adm-blue)" sub={`toplam ${fmtInt(items.length)}`} />
          <Kpi label="Ort. Yanıt Süresi" value={yanitSure ? (yanitSure < 48 ? `${yanitSure.toFixed(1)} sa` : `${(yanitSure / 24).toFixed(1)} gün`) : '—'} Icon={Reply} color="var(--adm-green)" sub={`${cnt(b => st(b) === 'replied')} yanıtlanan`} />
        </KpiGrid>
        <div style={{ marginBottom: 12 }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'bekleyen', l: 'Bekleyen', n: cnt(bekleyen) }, { v: 'new', l: 'Yeni', n: cnt(b => st(b) === 'new') }, { v: 'replied', l: 'Yanıtlanan', n: cnt(b => st(b) === 'replied') }, { v: 'archived', l: 'Arşiv', n: cnt(b => st(b) === 'archived') }, { v: 'spam', l: 'Şüpheli', n: cnt(b => !!b.ai_spam) }, { v: 'hepsi', l: 'Tümü', n: items.length }]} /></div>
        <DataGrid rows={liste} cols={cols} rowKey={b => b.id} loading={loading} csvName="basvurular" storageKey="basvurular" onRowClick={ac} activeKey={sel?.id} defaultSort={{ key: 'tarih', dir: 'desc' }} selectable
          searchText={b => `${b.name} ${b.email} ${b.company || ''} ${b.subject || ''} ${b.message || ''} ${b.product || ''}`} searchPlaceholder="Ad, e-posta, firma, mesaj..."
          bulkActions={(rows, clear) => <><button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluDurum(rows, 'read', clear)}><Eye size={12} />Okundu</button><button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluDurum(rows, 'replied', clear)}><CheckCheck size={12} />Yanıtlandı</button><button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluDurum(rows, 'archived', clear)}><Archive size={12} />Arşivle</button></>}
          onBulkDelete={topluSil} deleteNoun="başvuru"
          emptyTitle="Başvuru yok" emptySub="Sitedeki iletişim formundan gelen talepler burada görünür" />
      </Page>

      <Drawer open={!!sel} onClose={() => setSel(null)} width={520} title={sel && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{sel.name}<Badge tone={ST[st(sel)].tone}>{ST[st(sel)].l}</Badge></span>} sub={sel && `${sel.company ? sel.company + ' · ' : ''}${fmtDateTime(sel.created_at)}`}
        footer={sel && <><button className="adm-btn-danger" onClick={() => sil(sel)}><Trash2 size={13} /></button><button className="adm-btn-ghost" onClick={() => durum(sel, 'archived')}><Archive size={13} />Arşivle</button><a className="adm-btn-ghost" style={{ textDecoration: 'none' }} href={`/admin/dashboard/satis/teklifler?basvuru=${sel.id}`} title="Bu başvurudan fiyat teklifi hazırla"><FileText size={13} />Teklif hazırla</a>
          <a className="adm-btn" href={yanit(sel)} onClick={() => durum(sel, 'replied', true)} style={{ textDecoration: 'none' }}><Mail size={14} />E-posta ile Yanıtla</a></>}>
        {sel && <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <a className="adm-btn-ghost" href={`mailto:${sel.email}`} style={{ textDecoration: 'none' }}><Mail size={13} />{sel.email}</a>
            {sel.phone && <a className="adm-btn-ghost" href={`tel:${sel.phone}`} style={{ textDecoration: 'none' }}><Phone size={13} />Ara</a>}
            {sel.phone && <a className="adm-btn-ghost" target="_blank" rel="noreferrer" href={`https://wa.me/${wa(sel.phone)}?text=${encodeURIComponent(`Merhaba ${sel.name}, Alya Plastik'ten yazıyoruz. Talebiniz hakkında dönüş yapmak istedik.`)}`} style={{ textDecoration: 'none', color: 'var(--adm-green)' }}><MessageCircle size={13} />WhatsApp</a>}
            {cariMi(sel) ? <Badge tone="green">Cari kayıtlı: {cariMi(sel).ad}</Badge> : <button className="adm-btn-ghost" onClick={() => carEkle(sel)}><UserPlus size={13} />Müşteri carisi oluştur</button>}
          </div>
          <InfoRow k="Konu" v={sel.subject || '—'} /><InfoRow k="İlgilendiği ürün" v={sel.product || '—'} /><InfoRow k="Telefon" v={sel.phone || '—'} />
          <Divider label="Mesaj" />
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--adm-s2)', fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{sel.message}</div>
          <Divider label="AI analizi" />
          {sel.ai_analiz_at ? <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--adm-bdr)' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {sel.ai_spam && <Badge tone="red"><ShieldAlert size={11} /> Şüpheli / spam</Badge>}
              <Badge tone={ONCELIK[sel.ai_oncelik]?.tone || 'muted'}>Öncelik: {ONCELIK[sel.ai_oncelik]?.l || '—'}</Badge>
              <Badge tone="blue">{KAT[sel.ai_kategori] || sel.ai_kategori}</Badge>
              {sel.ai_dil && <Badge tone="muted">Dil: {String(sel.ai_dil).toUpperCase()}</Badge>}
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.55 }}>{sel.ai_ozet}</p>
            {sel.ai_taslak && <>
              <div className="adm-label" style={{ marginBottom: 4 }}>Cevap taslağı ({String(sel.ai_dil || '').toUpperCase() || 'mesaj dili'})</div>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--adm-s2)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{sel.ai_taslak}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => taslakKopyala(sel.ai_taslak)}><Copy size={12} />Kopyala</button>
                <a className="adm-btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }} href={yanit(sel)} onClick={() => durum(sel, 'replied', true)}><Mail size={12} />Taslakla e-posta aç</a>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--adm-tx3)' }}>Taslak yapay zeka tarafından üretildi; fiyat/termin gibi bilgileri göndermeden önce kontrol et.</p>
            </>}
            <button className="adm-btn-ghost" style={{ fontSize: 12, marginTop: 10 }} disabled={aiBusy} onClick={() => aiAnaliz(sel)}><Sparkles size={12} />{aiBusy ? 'Analiz ediliyor…' : 'Yeniden analiz et'}</button>
          </div> : <button className="adm-btn-ghost" disabled={aiBusy} onClick={() => aiAnaliz(sel)}><Sparkles size={13} />{aiBusy ? 'Analiz ediliyor…' : 'AI ile analiz et (kategori, öncelik, taslak cevap)'}</button>}
          <Divider label="Durum" />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{Object.entries(ST).map(([k, v]) => <button key={k} className={st(sel) === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => durum(sel, k)}>{v.l}</button>)}</div>
          <Divider label="İç not (sadece yöneticiler görür)" />
          <textarea className="adm-inp" rows={4} value={notes} onChange={e => setNotes(e.target.value)} onBlur={notKaydet} placeholder="Görüşme notu, teklif bilgisi..." />
        </div>}
      </Drawer>
      {toast.node}
    </div>
  )
}
