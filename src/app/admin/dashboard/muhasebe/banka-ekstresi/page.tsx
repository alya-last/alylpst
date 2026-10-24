'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { kasaPb, islemAlan, kurlariYukle } from '@/lib/doviz'
import { muh } from '@/lib/muhasebe-client'
import { fmt, fmtK, fmtDate, csvDownload } from '@/lib/fmt'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Modal, Field, FormGrid, Empty, Card, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Upload, Landmark, Wand2, Link2, Plus, X, Download, CheckCircle2, ListChecks, AlertCircle, Sparkles } from 'lucide-react'
import { aiIstek } from '@/lib/ai-client'

// Türkçe sayı: 1.234,56 | -1234.56 | (1.234,56)
function sayi(s: string) {
  let t = (s || '').trim().replace(/[₺TLtl\s]/g, ''); if (!t) return 0
  let neg = false
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1) }
  if (t.startsWith('-')) { neg = true; t = t.slice(1) }
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (t.includes(',')) t = t.replace(',', '.')
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '')
  const n = parseFloat(t); return isNaN(n) ? 0 : neg ? -n : n
}
function tarih(d: string) {
  d = (d || '').trim().replace(/"/g, ''); if (!d) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  const m = d.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}
function bol(line: string, d: string) {
  const out: string[] = []; let cur = '', q = false
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === d && !q) { out.push(cur); cur = '' } else cur += ch }
  out.push(cur); return out.map(x => x.trim())
}
// Başlık varsa (tarih, açıklama, tutar | borç, alacak) kolonları otomatik bulur
function csvParse(text: string) {
  let lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
  // Banka dosyalarında üstte firma/IBAN bilgileri olur: asıl başlık satırını (Tarih + Tutar/Borç/Alacak) bul, üstünü at
  const bi = lines.findIndex((l, i) => i < 60 && /tarih|date/i.test(l) && /tutar|amount|borç|borc|alacak|debit|credit/i.test(l))
  if (bi > 0) lines = lines.slice(bi)
  if (!lines.length) return []
  const d = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length && lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','
  const head = bol(lines[0], d).map(h => h.toLocaleLowerCase('tr'))
  const hasHead = head.some(h => /tarih|date/.test(h))
  const ix = (re: RegExp, fb: number) => { const i = head.findIndex(h => re.test(h)); return hasHead && i >= 0 ? i : fb }
  const iT = ix(/tarih|date/, 0), iA = ix(/açıklama|aciklama|desc|işlem/, 1), iTu = ix(/^tutar|amount/, 2)
  const iB = hasHead ? head.findIndex(h => /borç|borc|çıkış|cikis|debit/.test(h)) : -1
  const iAl = hasHead ? head.findIndex(h => /alacak|giriş|giris|credit/.test(h)) : -1
  return lines.slice(hasHead ? 1 : 0).map(l => {
    const c = bol(l, d)
    let t = 0
    if (iB >= 0 && iAl >= 0) t = Math.abs(sayi(c[iAl])) - Math.abs(sayi(c[iB])); else t = sayi(c[iTu])
    return { tarih: tarih(c[iT]), aciklama: c[iA] || '', tutar: Math.abs(t), yon: t >= 0 ? 'giris' : 'cikis' }
  }).filter(r => r.tarih && r.tutar)
}

export default function BankaEkstresiPage() {
  const toast = useToast()
  const [kasalar, setKasalar] = useState<any[]>([])
  const [kayitlar, setKayitlar] = useState<any[]>([])
  const [islemler, setIslemler] = useState<any[]>([])
  const [kategoriler, setKategoriler] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [kasa, setKasa] = useState('')
  const [tab, setTab] = useState('eslesmedi')
  const [esles, setEsles] = useState<any>(null)   // eşleştirme adayları modalı
  const [olustur, setOlustur] = useState<any>(null) // ekstreden işlem oluştur
  const [busy, setBusy] = useState(false)
  const [oneriler, setOneriler] = useState<Record<string, any>>({})
  const [aiBusy, setAiBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Ekstre ve eşleşme adayları yalnızca seçili banka hesabı için (ve eşleştirmeye konu olabilecek son 400 gün için) çekilir
  const load = useCallback(async () => {
    const [k, kt, c] = await Promise.all([
      muh.all('kasa_banka_hesaplari', '*', q => q.eq('tip', 'banka').order('ad', { ascending: true })),
      muh.from('muhasebe_kategoriler').select('*'), muh.all('cari_hesaplar', 'id,ad'),
    ])
    setKasalar(k); setKategoriler(kt.data || []); setCariler(c)
    const aktif = kasa || k[0]?.id || ''
    if (!kasa) setKasa(aktif)
    if (aktif) {
      const bas = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)
      const [e, i] = await Promise.all([
        erp.all('banka_ekstre_kayitlari', '*', q => q.eq('kasa_hesap_id', aktif).order('tarih', { ascending: false })),
        muh.all('islemler', '*', q => q.eq('kasa_hesap_id', aktif).gte('tarih', bas).order('tarih', { ascending: false })),
      ])
      setKayitlar(e); setIslemler(i)
    } else { setKayitlar([]); setIslemler([]) }
    setLoading(false)
  }, [kasa])
  useEffect(() => { load() }, [load])

  const hesap = kasalar.find(k => k.id === kasa)
  const benim = kayitlar.filter(k => k.kasa_hesap_id === kasa)
  const eslesikIslem = useMemo(() => new Set(benim.filter(k => k.eslesme_islem_id).map(k => k.eslesme_islem_id)), [benim])
  const kullanilabilir = useMemo(() => islemler.filter(i => i.kasa_hesap_id === kasa && !eslesikIslem.has(i.id)), [islemler, kasa, eslesikIslem])

  const adaylar = useCallback((k: any) => kullanilabilir.filter(i => {
    if (Math.abs(+i.tutar - +k.tutar) > 0.01) return false
    if ((k.yon === 'giris') !== (i.tip === 'gelir')) return false
    return Math.abs(+new Date(i.tarih) - +new Date(k.tarih)) / 86400000 <= 5
  }).sort((a, b) => Math.abs(+new Date(a.tarih) - +new Date(k.tarih)) - Math.abs(+new Date(b.tarih) - +new Date(k.tarih))), [kullanilabilir])

  const acik = benim.filter(k => k.durum === 'eslesmedi')
  const filtered = benim.filter(k => tab === 'hepsi' || k.durum === tab)
  const eslesen = benim.filter(k => k.durum === 'eslesti')
  const net = (rs: any[]) => sum(rs, k => (k.yon === 'giris' ? 1 : -1) * k.tutar)
  const oran = benim.filter(k => k.durum !== 'yoksayildi').length ? (eslesen.length / benim.filter(k => k.durum !== 'yoksayildi').length) * 100 : 0
  const otomatikAdet = acik.filter(k => adaylar(k).length === 1).length

  async function dosya(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !kasa) return
    // Türkiye bankaları dosyayı çoğu zaman Windows-1254 kodlamasıyla verir; UTF-8 değilse ona çevir
    const buf = await f.arrayBuffer()
    let metin: string
    try { metin = new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch { metin = new TextDecoder('windows-1254').decode(buf) }
    const satirlar = csvParse(metin)
    if (!satirlar.length) { toast.show('Geçerli satır bulunamadı. Beklenen kolonlar: Tarih, Açıklama, Tutar (veya Borç/Alacak)', true); return }
    const anahtar = (s: any) => `${s.tarih}|${s.yon}|${(+s.tutar).toFixed(2)}|${(s.aciklama || '').trim().toLowerCase()}`
    const mevcut = new Set(benim.map(anahtar))
    const yeni = satirlar.filter(s => { const a = anahtar(s); if (mevcut.has(a)) return false; mevcut.add(a); return true })
    if (yeni.length) { const r: any = await erp.from('banka_ekstre_kayitlari').insert(yeni.map(s => ({ ...s, kasa_hesap_id: kasa }))); if (r?.error) { toast.show(r.error, true); return } }
    toast.show(`${yeni.length} satır yüklendi${satirlar.length - yeni.length ? `, ${satirlar.length - yeni.length} tekrar atlandı` : ''}`)
    if (fileRef.current) fileRef.current.value = ''; load()
  }

  // AI: cari + kategori önerisi (yalnızca öneri; kayıt oluşturma yine kullanıcı onayıyla yapılır)
  async function aiOner() {
    const hedef = [...acik].sort((a, b) => adaylar(a).length - adaylar(b).length).filter(k => adaylar(k).length !== 1).slice(0, 25)
    if (!hedef.length) return toast.show('Öneri gerektiren satır yok')
    setAiBusy(true)
    try {
      const r: any = await aiIstek('ekstre_oner', { satirlar: hedef.map(k => ({ id: k.id, tarih: k.tarih, yon: k.yon, tutar: +k.tutar, aciklama: k.aciklama })) })
      const m: Record<string, any> = { ...oneriler }; (r.sonuc || []).forEach((o: any) => { m[o.id] = o })
      setOneriler(m); toast.show(`${(r.sonuc || []).length} satır için öneri hazırlandı — "İşlem Oluştur" alanları doldurulur`)
    } catch (e: any) { toast.show(e.message, true) }
    setAiBusy(false)
  }
  async function eslestir(kayit: any, islemId: string) {
    const r: any = await erp.from('banka_ekstre_kayitlari').update({ eslesme_islem_id: islemId, durum: 'eslesti' }).eq('id', kayit.id)
    if (r?.error) return toast.show(r.error, true)
    setEsles(null); toast.show('Eşleştirildi'); load()
  }
  async function otomatik() {
    setBusy(true); const used = new Set<string>(); let n = 0
    for (const k of acik) {
      const a = adaylar(k).filter(x => !used.has(x.id))
      if (a.length === 1) { used.add(a[0].id); await erp.from('banka_ekstre_kayitlari').update({ eslesme_islem_id: a[0].id, durum: 'eslesti' }).eq('id', k.id); n++ }
    }
    setBusy(false); toast.show(n ? `${n} satır otomatik eşleşti` : 'Tek adaylı eşleşme bulunamadı'); load()
  }
  async function durum(rows: any[], d: string) {
    for (const r of rows) await erp.from('banka_ekstre_kayitlari').update({ durum: d, ...(d !== 'eslesti' ? { eslesme_islem_id: null } : {}) }).eq('id', r.id)
    toast.show(`${rows.length} satır güncellendi`); load()
  }
  async function islemOlustur(e: React.FormEvent) {
    e.preventDefault(); if (busy || !olustur) return
    const k = olustur.k; setBusy(true)
    let alan: any
    try { const ho = kasalar.find(x => x.id === k.kasa_hesap_id); alan = islemAlan(ho, +k.tutar, kasaPb(ho) === 'TRY' ? undefined : (await kurlariYukle())[kasaPb(ho)]) } catch (err: any) { setBusy(false); return toast.show(err.message, true) }
    const r: any = await muh.from('islemler').insert({ tip: k.yon === 'giris' ? 'gelir' : 'gider', kategori: olustur.kategori, ...alan, tarih: k.tarih, odeme_yontemi: 'havale', kasa_hesap_id: k.kasa_hesap_id, cari_id: olustur.cari || null, aciklama: k.aciklama || 'Banka ekstresi' })
    if (r?.error) { setBusy(false); return toast.show(r.error, true) }
    await erp.from('banka_ekstre_kayitlari').update({ eslesme_islem_id: r.data?.[0]?.id, durum: 'eslesti' }).eq('id', k.id)
    setBusy(false); setOlustur(null); toast.show('İşlem oluşturuldu ve eşleştirildi'); load()
  }

  const islemAd = useMemo(() => Object.fromEntries(islemler.map(i => [i.id, i])), [islemler])
  const cols: Col<any>[] = [
    { key: 'tarih', label: 'Tarih', width: 96, sort: k => k.tarih, render: k => fmtDate(k.tarih) },
    { key: 'aciklama', label: 'Açıklama', sort: k => k.aciklama || '', render: k => { const o = oneriler[k.id]; const cariAd = o?.cari_id ? cariler.find(c => c.id === o.cari_id)?.ad : null; return <div><span>{k.aciklama || '—'}</span>{o && (cariAd || o.kategori) && k.durum === 'eslesmedi' && <div style={{ fontSize: 11, color: 'var(--adm-ac)', marginTop: 2 }}>AI: {[cariAd, o.kategori].filter(Boolean).join(' · ')} <span style={{ color: 'var(--adm-tx3)' }}>({o.guven} güven{o.gerekce ? ` — ${o.gerekce}` : ''})</span></div>}</div> } },
    { key: 'tutar', label: 'Tutar', align: 'right', sort: k => (k.yon === 'giris' ? 1 : -1) * k.tutar, render: k => <Money v={(k.yon === 'giris' ? 1 : -1) * +k.tutar} tone="auto" sign />, total: rs => <Money v={net(rs)} tone="auto" />, csv: k => (k.yon === 'giris' ? 1 : -1) * +k.tutar },
    {
      key: 'durum', label: 'Durum', width: 200, sort: k => k.durum, render: k => k.durum === 'eslesti'
        ? <div><Badge tone="green">Eşleşti</Badge><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 3 }}>{islemAd[k.eslesme_islem_id]?.kategori || 'işlem'} · {fmtDate(islemAd[k.eslesme_islem_id]?.tarih)}</div></div>
        : k.durum === 'yoksayildi' ? <Badge tone="muted">Yoksayıldı</Badge>
        : (() => { const a = adaylar(k).length; return <Badge tone={a === 1 ? 'blue' : a > 1 ? 'amber' : 'red'}>{a === 0 ? 'Aday yok' : a === 1 ? '1 aday' : `${a} aday`}</Badge> })(),
    },
    {
      key: 'act', label: '', width: 230, align: 'right', render: k => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {k.durum === 'eslesmedi' && <>
            <button className="adm-btn-ghost" style={{ padding: '4px 9px', fontSize: 11.5 }} disabled={!adaylar(k).length} onClick={() => setEsles(k)}><Link2 size={12} />Eşleştir</button>
            <button className="adm-btn-ghost" style={{ padding: '4px 9px', fontSize: 11.5 }} onClick={() => setOlustur({ k, kategori: oneriler[k.id]?.kategori || '', cari: oneriler[k.id]?.cari_id || '' })}><Plus size={12} />İşlem Oluştur</button>
            <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} title="Yoksay" onClick={() => durum([k], 'yoksayildi')}><X size={12} /></button>
          </>}
          {k.durum !== 'eslesmedi' && <button className="adm-btn-ghost" style={{ padding: '4px 9px', fontSize: 11.5 }} onClick={() => durum([k], 'eslesmedi')}>Geri al</button>}
        </span>),
    },
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Banka Ekstresi" />
      <Page>
        <PageHead title="Banka Mutabakatı" sub="Ekstre satırlarını sistem kayıtlarıyla eşleştir, eksik işlemleri tek tıkla oluştur"
          actions={<>
            <select className="adm-sel" value={kasa} onChange={e => setKasa(e.target.value)} style={{ minWidth: 170 }}>{kasalar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}</select>
            <button className="adm-btn-ghost" onClick={() => csvDownload('ekstre-ornek.csv', [{ Tarih: '15.09.2026', Açıklama: 'Müşteri havalesi', Tutar: '12.500,00' }, { Tarih: '16.09.2026', Açıklama: 'Elektrik faturası', Tutar: '-3.200,50' }])}><Download size={13} />Örnek CSV</button>
            <button className="adm-btn" onClick={() => fileRef.current?.click()} disabled={!kasa}><Upload size={14} />Ekstre Yükle</button>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={dosya} style={{ display: 'none' }} />
          </>} />

        <Yardim sayfa="banka-ekstresi" sekme={tab} />
        {!loading && kasalar.length === 0 ? (
          <Card><Empty icon={<Landmark size={34} />} title="Banka hesabı yok" sub="Önce Kasa/Banka sayfasından bir banka hesabı ekle" /></Card>
        ) : (
          <>
            <KpiGrid min={190}>
              <Kpi label="Sistem Bakiyesi" value={fmtK(+hesap?.bakiye || 0)} Icon={Landmark} color="var(--adm-blue)" sub={hesap?.ad} />
              <Kpi label="Eşleşme Oranı" value={`%${oran.toFixed(0)}`} Icon={CheckCircle2} color={oran >= 90 ? 'var(--adm-green)' : 'var(--adm-amber)'} sub={`${eslesen.length} eşleşen satır`} />
              <Kpi label="Eşleşmemiş" value={acik.length} Icon={AlertCircle} color={acik.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub={`Net ${fmtK(net(acik))}`} onClick={() => setTab('eslesmedi')} />
              <Kpi label="Sistemde Karşılıksız" value={kullanilabilir.length} Icon={ListChecks} color="var(--adm-amber)" sub="ekstrede eşi olmayan işlem" />
            </KpiGrid>

            {otomatikAdet > 0 && (
              <div className="adm-card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, borderColor: 'var(--adm-blue)' }}>
                <Wand2 size={18} style={{ color: 'var(--adm-blue)' }} />
                <span style={{ flex: 1, fontSize: 13 }}><b>{otomatikAdet}</b> satırın tek bir net adayı var (aynı tutar, aynı yön, ±5 gün). Otomatik eşleştirebilirim.</span>
                <button className="adm-btn" disabled={busy} onClick={otomatik}><Wand2 size={14} />Otomatik Eşleştir</button>
              </div>
            )}

            {acik.length > 0 && (
              <div className="adm-card" style={{ padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Sparkles size={17} style={{ color: 'var(--adm-ac)' }} />
                <span style={{ flex: 1, fontSize: 13 }}>Eşleşmeyen satırlar için açıklamaya bakarak <b>cari ve kategori önerisi</b> alabilirsin (en fazla 25 satır; IBAN/uzun numaralar maskelenerek gönderilir).</span>
                <button className="adm-btn-ghost" disabled={aiBusy} onClick={aiOner}><Sparkles size={13} />{aiBusy ? 'Analiz ediliyor…' : 'AI ile öner'}</button>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <Tabs value={tab} onChange={setTab} tabs={[{ v: 'eslesmedi', l: 'Eşleşmemiş', n: acik.length }, { v: 'eslesti', l: 'Eşleşen', n: eslesen.length }, { v: 'yoksayildi', l: 'Yoksayılan', n: benim.filter(k => k.durum === 'yoksayildi').length }, { v: 'hepsi', l: 'Tümü', n: benim.length }]} />
            </div>

            <DataGrid rows={filtered} cols={cols} rowKey={k => k.id} loading={loading} csvName="banka-ekstresi" storageKey="ekstre" defaultSort={{ key: 'tarih', dir: 'desc' }}
              searchText={k => `${k.aciklama || ''} ${k.tutar}`} searchPlaceholder="Açıklama veya tutar..." selectable
              bulkActions={(sel, clear) => <>{sel.some(s => s.durum === 'eslesmedi') && <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => { durum(sel.filter(s => s.durum === 'eslesmedi'), 'yoksayildi'); clear() }}>Seçilenleri yoksay</button>}</>}
              emptyTitle={benim.length ? 'Bu sekmede satır yok' : 'Henüz ekstre yüklenmedi'} emptySub={benim.length ? undefined : 'Bankandan CSV indirip Ekstre Yükle ile içeri aktar. Tarih, Açıklama, Tutar (veya Borç/Alacak) kolonları otomatik tanınır.'} />
          </>
        )}
      </Page>

      <Modal open={!!esles} onClose={() => setEsles(null)} title="Eşleştirme Adayları" width={560} footer={<button className="adm-btn-ghost" onClick={() => setEsles(null)}>Kapat</button>}>
        {esles && <>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)', marginBottom: 12, fontSize: 12.5 }}><b>{fmtDate(esles.tarih)}</b> · {esles.aciklama || '—'} · <Money v={(esles.yon === 'giris' ? 1 : -1) * +esles.tutar} tone="auto" sign /></div>
          {adaylar(esles).map(i => (
            <div key={i.id} className="adm-row" style={{ padding: '10px 4px' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{i.kategori}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{fmtDate(i.tarih)} · {i.aciklama || '—'}</div></div>
              <Money v={+i.tutar} tone={i.tip === 'gelir' ? 'green' : 'red'} />
              <button className="adm-btn" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => eslestir(esles, i.id)}>Eşleştir</button>
            </div>))}
        </>}
      </Modal>

      <Modal open={!!olustur} onClose={() => setOlustur(null)} onSubmit={islemOlustur} width={480} title="Ekstre Satırından İşlem Oluştur"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setOlustur(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Oluştur ve Eşleştir</button></>}>
        {olustur && <FormGrid cols={1}>
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)', fontSize: 12.5 }}><b>{fmtDate(olustur.k.tarih)}</b> · {olustur.k.aciklama || '—'} · <Money v={(olustur.k.yon === 'giris' ? 1 : -1) * +olustur.k.tutar} tone="auto" sign /></div>
          <Field label="Kategori *"><input className="adm-inp" required list="ekstre-kat" value={olustur.kategori} onChange={e => setOlustur((o: any) => ({ ...o, kategori: e.target.value }))} placeholder="Seç veya yaz" /><datalist id="ekstre-kat">{kategoriler.filter(k => k.tip === (olustur.k.yon === 'giris' ? 'gelir' : 'gider')).map(k => <option key={k.id} value={k.ad} />)}</datalist></Field>
          <Field label="Cari (opsiyonel)" hint="Seçersen cari bakiyesi de güncellenir"><select className="adm-inp" value={olustur.cari} onChange={e => setOlustur((o: any) => ({ ...o, cari: e.target.value }))}><option value="">—</option>{cariler.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--adm-tx3)' }}>Bu, {hesap?.ad} bakiyesini {fmt(olustur.k.tutar)} {olustur.k.yon === 'giris' ? 'artırır' : 'azaltır'}.</p>
        </FormGrid>}
      </Modal>
      {toast.node}
    </div>
  )
}
