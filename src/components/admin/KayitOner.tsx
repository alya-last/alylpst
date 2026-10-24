'use client'
import { useEffect, useMemo, useState } from 'react'
import { aiIstek } from '@/lib/ai-client'
import { muh } from '@/lib/muhasebe-client'
import { csvDownload, fmt } from '@/lib/fmt'
import { Modal, Field, FormGrid, Badge, Divider } from '@/components/admin/erp/ui'
import { Copy, Download, Plus, X } from 'lucide-react'
import SiparisEslestir, { type EslesmeSecim } from '@/components/admin/SiparisEslestir'

const ENDPOINT = '/api/admin/muhasebe-ai'
type Kalem = { urun_adi: string; miktar: number; birim: string; birim_fiyat: number; kdv_orani: number }

// Belgeden çıkarılan veriyi fatura TASLAĞI veya gelir/gider işlemi olarak kaydetmek için onay ekranı.
// Hiçbir şey otomatik kaydedilmez; fatura taslak durumunda oluşur (bakiye/stok etkilenmez), işlem kaydı için ayrıca onay istenir.
export default function KayitOner({ belge, onClose, toast }: { belge: { ad: string; sonuc: any }; onClose: () => void; toast: { show: (m: string, err?: boolean) => void } }) {
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [d, setD] = useState<any>(null)            // sunucu yanıtı
  const [tur, setTur] = useState<'fatura' | 'islem'>('fatura')
  const [f, setF] = useState<any>({})              // fatura formu
  const [kalemler, setKalemler] = useState<Kalem[]>([])
  const [i, setI] = useState<any>({})              // işlem formu
  const [cariId, setCariId] = useState('')
  const [yeniCari, setYeniCari] = useState(false)
  const [kasaId, setKasaId] = useState('')
  const [busy, setBusy] = useState(false)
  const [eslesme, setEslesme] = useState<EslesmeSecim | null>(null)

  useEffect(() => {
    let iptal = false
    aiIstek<any>('kayit_oner', { belge: belge.sonuc }, ENDPOINT).then(r => {
      if (iptal) return
      const o = r.oneri
      setD(r); setTur(o.kayit_turu === 'islem' ? 'islem' : 'fatura')
      setF({ tip: o.fatura.tip, no: o.fatura.no, tarih: o.fatura.tarih, vade: o.fatura.vade, para_birimi: o.fatura.para_birimi, kur: '1', notlar: o.fatura.notlar || '', cari_unvan: o.fatura.cari_unvan, cari_vergi_no: o.fatura.cari_vergi_no })
      setKalemler(o.fatura.kalemler.length ? o.fatura.kalemler : [])
      setI({ tip: o.islem.tip, kategori: o.islem.kategori, tutar: o.islem.tutar, tarih: o.islem.tarih, aciklama: o.islem.aciklama || belge.ad, odeme_yontemi: o.islem.odeme_yontemi })
      setCariId(r.cariEslesme?.id || ''); setYeniCari(!r.cariEslesme && !!o.fatura.cari_unvan)
      setYukleniyor(false)
    }).catch(e => { if (!iptal) { setHata(e.message); setYukleniyor(false) } })
    return () => { iptal = true }
  }, []) // eslint-disable-line

  const kur = f.para_birimi === 'TRY' ? 1 : +f.kur || 1
  const ara = useMemo(() => kalemler.reduce((t, k) => t + k.miktar * k.birim_fiyat, 0), [kalemler])
  const kdv = useMemo(() => kalemler.reduce((t, k) => t + (k.miktar * k.birim_fiyat * k.kdv_orani) / 100, 0), [kalemler])
  const setK = (idx: number, p: Partial<Kalem>) => setKalemler(ks => ks.map((k, j) => (j === idx ? { ...k, ...p } : k)))
  useEffect(() => { setEslesme(null) }, [cariId, f.tip])
  const cariTip = f.tip === 'alis' ? 'tedarikci' : 'musteri'
  const cariListe = (d?.cariler || []).filter((c: any) => (f.tip === 'alis' ? c.tip !== 'musteri' : f.tip === 'satis' ? c.tip !== 'tedarikci' : true))

  async function cariHazirla(): Promise<string | null> {
    if (cariId) return cariId
    if (yeniCari && f.cari_unvan?.trim()) {
      const r: any = await muh.from('cari_hesaplar').insert({ tip: cariTip, ad: f.cari_unvan.trim(), ...(f.cari_vergi_no?.trim() ? { vergi_no: f.cari_vergi_no.trim() } : {}) })
      if (r?.error) throw new Error(r.error)
      return r.data?.[0]?.id || null
    }
    return null
  }

  async function faturaOlustur() {
    if (busy) return
    if (!f.no?.trim()) return toast.show('Fatura no gerekli', true)
    const gecerli = kalemler.filter(k => k.urun_adi && k.miktar > 0)
    if (!gecerli.length) return toast.show('En az bir kalem gerekli', true)
    if (!f.tarih) return toast.show('Fatura tarihi gerekli', true)
    if (d.mukerrer.fatura.length && !confirm(`${f.no} numaralı fatura sistemde zaten var. Yine de taslak oluşturulsun mu?`)) return
    if (eslesme?.iptalOto && eslesme.otoFatura && !confirm(`${eslesme.otoFatura.no} otomatik faturası İPTAL edilecek ve tedarikçinin cari borcundan düşülecek. Gerçek fatura onaylanınca borç yeniden yazılır. Devam edilsin mi?`)) return
    setBusy(true)
    try {
      const cid = await cariHazirla()
      const r: any = await muh.from('faturalar').insert({
        tip: f.tip, no: f.no.trim(), cari_id: cid, tarih: f.tarih, vade: f.vade || null, notlar: [f.notlar, `Belgeden AI ile aktarıldı: ${belge.ad}`, eslesme ? `Satınalma siparişi: ${eslesme.siparisNo}` : ''].filter(Boolean).join('\n'), ...(eslesme ? { satinalma_siparis_id: eslesme.siparisId } : {}), para_birimi: f.para_birimi, kur,
        kdv_orani: gecerli[0].kdv_orani, ara_toplam: ara * kur, kdv_tutari: kdv * kur, toplam: (ara + kdv) * kur, doviz_tutari: f.para_birimi !== 'TRY' ? ara + kdv : null, durum: 'taslak',
      })
      if (r?.error) throw new Error(r.error)
      const id = r.data?.[0]?.id
      const k: any = await muh.from('fatura_kalemleri').insert(gecerli.map(x => ({ fatura_id: id, urun_adi: x.urun_adi, variant_id: null, miktar: x.miktar, birim: x.birim || 'adet', birim_fiyat: x.birim_fiyat, kdv_orani: x.kdv_orani, toplam: x.miktar * x.birim_fiyat * (1 + x.kdv_orani / 100) })))
      if (k?.error) throw new Error(k.error)
      let iptalNot = ''
      if (eslesme?.iptalOto && eslesme.otoFatura) {
        const u: any = await muh.from('faturalar').update({ durum: 'iptal' }).eq('id', eslesme.otoFatura.id)
        iptalNot = u?.error ? ` UYARI: ${eslesme.otoFatura.no} otomatik faturası iptal EDİLEMEDİ (${u.error}); Faturalar ekranından elle iptal edin.` : ` ${eslesme.otoFatura.no} otomatik faturası iptal edildi.`
      }
      toast.show('Fatura TASLAK olarak oluşturuldu (Muhasebe → Faturalar); kontrol edip onaylayın.' + iptalNot, iptalNot.includes('UYARI')); onClose()
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }

  async function islemOlustur() {
    if (busy) return
    if (!i.kategori?.trim() || !(+i.tutar > 0) || !i.tarih) return toast.show('Kategori, tutar ve tarih gerekli', true)
    if (!kasaId) return toast.show('Kasa/banka hesabı seçin', true)
    if (d.mukerrer.islem.length && !confirm('Aynı gün ve tutarda benzer bir işlem var. Yine de oluşturulsun mu?')) return
    if (!confirm(`${i.tip === 'gelir' ? 'Gelir' : 'Gider'} işlemi oluşturulacak; seçili kasa/banka bakiyesi ${fmt(+i.tutar)} ${i.tip === 'gelir' ? 'artırılır' : 'azaltılır'}. Devam edilsin mi?`)) return
    setBusy(true)
    try {
      const r: any = await muh.from('islemler').insert({ tip: i.tip, kategori: i.kategori.trim(), tutar: +i.tutar, tarih: i.tarih, odeme_yontemi: i.odeme_yontemi, kasa_hesap_id: kasaId, cari_id: cariId || null, aciklama: `${i.aciklama || ''} [AI: ${belge.ad}]`.slice(0, 300) })
      if (r?.error) throw new Error(r.error)
      toast.show('İşlem oluşturuldu (Muhasebe → Gelir/Gider)'); onClose()
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }

  const yev = d?.oneri?.yevmiye || []
  const yevTsv = () => [['Hesap kodu', 'Hesap adı', 'Borç', 'Alacak'], ...yev.map((y: any) => [y.hesap_kodu, y.hesap_adi, y.borc || '', y.alacak || ''])].map((r: any[]) => r.join('\t')).join('\n')

  return (
    <Modal open onClose={onClose} width={900} title={`Kayda dönüştür — ${belge.ad}`}
      footer={<><button type="button" className="adm-btn-ghost" onClick={onClose}>Kapat</button>
        {!yukleniyor && !hata && tur === 'fatura' && <button type="button" className="adm-btn" disabled={busy} onClick={faturaOlustur}>{busy ? 'Kaydediliyor…' : 'Fatura TASLAĞI oluştur'}</button>}
        {!yukleniyor && !hata && tur === 'islem' && <button type="button" className="adm-btn" disabled={busy} onClick={islemOlustur}>{busy ? 'Kaydediliyor…' : 'Gelir/gider işlemi oluştur'}</button>}</>}>
      {yukleniyor && <p style={{ fontSize: 13, color: 'var(--adm-tx3)' }}>Belge verisi kayda dönüştürülüyor, cariler ve olası mükerrerler kontrol ediliyor…</p>}
      {hata && <p style={{ fontSize: 13, color: 'var(--adm-red)' }}>⚠ {hata}</p>}
      {d && (<>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 12.5 }}>Önerilen kayıt türü:</span>
          <button type="button" className={tur === 'fatura' ? 'adm-btn' : 'adm-btn-ghost'} style={{ fontSize: 12 }} onClick={() => setTur('fatura')}>Fatura (taslak)</button>
          <button type="button" className={tur === 'islem' ? 'adm-btn' : 'adm-btn-ghost'} style={{ fontSize: 12 }} onClick={() => setTur('islem')}>Gelir / gider işlemi</button>
          <span style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>{d.oneri.gerekce}</span>
        </div>
        {d.oneri.uyarilar.length > 0 && <div style={{ padding: 10, borderRadius: 9, background: 'var(--adm-amber2)', color: 'var(--adm-amber)', fontSize: 12.5, marginBottom: 12 }}>{d.oneri.uyarilar.map((u: string, j: number) => <div key={j}>⚠ {u}</div>)}</div>}
        {d.mukerrer.fatura.length > 0 && <div style={{ padding: 10, borderRadius: 9, background: 'var(--adm-red2, rgba(225,75,75,.12))', color: 'var(--adm-red)', fontSize: 12.5, marginBottom: 12 }}>Aynı numaralı fatura(lar): {d.mukerrer.fatura.map((x: any) => `${x.no} (${x.tip}, ${x.tarih}, ${fmt(x.toplam)}, ${x.durum})`).join(' · ')}</div>}
        {d.mukerrer.islem.length > 0 && <div style={{ padding: 10, borderRadius: 9, background: 'var(--adm-red2, rgba(225,75,75,.12))', color: 'var(--adm-red)', fontSize: 12.5, marginBottom: 12 }}>Aynı gün/tutarda işlem(ler): {d.mukerrer.islem.map((x: any) => `${x.kategori} ${fmt(x.tutar)} ${x.tarih}`).join(' · ')}</div>}

        {tur === 'fatura' && <>
          <FormGrid cols={4}>
            <Field label="Tür"><select className="adm-inp" value={f.tip} onChange={e => setF((x: any) => ({ ...x, tip: e.target.value }))}><option value="alis">Alış</option><option value="satis">Satış</option><option value="iade">İade</option></select></Field>
            <Field label="Fatura No *"><input className="adm-inp" value={f.no} onChange={e => setF((x: any) => ({ ...x, no: e.target.value }))} /></Field>
            <Field label="Tarih *"><input type="date" className="adm-inp" value={f.tarih} onChange={e => setF((x: any) => ({ ...x, tarih: e.target.value }))} /></Field>
            <Field label="Vade"><input type="date" className="adm-inp" value={f.vade} onChange={e => setF((x: any) => ({ ...x, vade: e.target.value }))} /></Field>
            <Field label={`Cari (belgedeki: ${f.cari_unvan || '—'})`} span={2}>
              <select className="adm-inp" value={cariId} onChange={e => { setCariId(e.target.value); if (e.target.value) setYeniCari(false) }}><option value="">— Seçilmedi —</option>{cariListe.map((c: any) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select>
              {!cariId && f.cari_unvan && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginTop: 4 }}><input type="checkbox" checked={yeniCari} onChange={e => setYeniCari(e.target.checked)} />"{f.cari_unvan}" için yeni {cariTip === 'tedarikci' ? 'tedarikçi' : 'müşteri'} carisi oluştur</label>}
            </Field>
            <Field label="Para birimi"><select className="adm-inp" value={f.para_birimi} onChange={e => setF((x: any) => ({ ...x, para_birimi: e.target.value }))}>{['TRY', 'USD', 'EUR', 'GBP', 'RUB'].map(p => <option key={p}>{p}</option>)}</select></Field>
            {f.para_birimi !== 'TRY' ? <Field label={`Kur (1 ${f.para_birimi} = ₺)`}><input type="number" step="0.0001" className="adm-inp" value={f.kur} onChange={e => setF((x: any) => ({ ...x, kur: e.target.value }))} /></Field> : <div />}
          </FormGrid>
          <Divider label="Kalemler (KDV hariç birim fiyat)" />
          <table className="adm-table" style={{ width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Ürün/hizmet</th><th>Miktar</th><th>Birim</th><th>Birim fiyat</th><th>KDV %</th><th style={{ textAlign: 'right' }}>Toplam</th><th /></tr></thead>
            <tbody>{kalemler.map((k, idx) => <tr key={idx}>
              <td><input className="adm-inp" value={k.urun_adi} onChange={e => setK(idx, { urun_adi: e.target.value })} /></td>
              <td><input type="number" step="any" className="adm-inp" style={{ width: 80 }} value={k.miktar} onChange={e => setK(idx, { miktar: +e.target.value })} /></td>
              <td><input className="adm-inp" style={{ width: 70 }} value={k.birim} onChange={e => setK(idx, { birim: e.target.value })} /></td>
              <td><input type="number" step="any" className="adm-inp" style={{ width: 110 }} value={k.birim_fiyat} onChange={e => setK(idx, { birim_fiyat: +e.target.value })} /></td>
              <td><input type="number" step="any" className="adm-inp" style={{ width: 70 }} value={k.kdv_orani} onChange={e => setK(idx, { kdv_orani: +e.target.value })} /></td>
              <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }}>{fmt(k.miktar * k.birim_fiyat * (1 + k.kdv_orani / 100))}</td>
              <td><button type="button" onClick={() => setKalemler(ks => ks.filter((_, j) => j !== idx))} style={{ background: 'none', border: 'none', color: 'var(--adm-red)' }}><X size={14} /></button></td></tr>)}</tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setKalemler(ks => [...ks, { urun_adi: '', miktar: 1, birim: 'adet', birim_fiyat: 0, kdv_orani: 20 }])}><Plus size={12} />Kalem ekle</button>
            <span style={{ fontSize: 13 }}>Ara {fmt(ara)} · KDV {fmt(kdv)} · <b>Toplam {fmt(ara + kdv)} {f.para_birimi}</b></span>
          </div>
          {f.tip === 'alis' && <SiparisEslestir cariId={cariId} araToplamTRY={ara * kur} tarih={f.tarih} kalemler={kalemler} paraBirimi={f.para_birimi} kur={kur} secim={eslesme} onChange={setEslesme} />}
        </>}

        {tur === 'islem' && <FormGrid cols={3}>
          <Field label="Tür"><select className="adm-inp" value={i.tip} onChange={e => setI((x: any) => ({ ...x, tip: e.target.value }))}><option value="gider">Gider</option><option value="gelir">Gelir</option></select></Field>
          <Field label="Kategori *"><input className="adm-inp" list="kayit-kat" value={i.kategori} onChange={e => setI((x: any) => ({ ...x, kategori: e.target.value }))} /><datalist id="kayit-kat">{(d.kategoriler[i.tip] || []).map((k: string) => <option key={k} value={k} />)}</datalist></Field>
          <Field label="Tutar *"><input type="number" step="0.01" className="adm-inp" value={i.tutar} onChange={e => setI((x: any) => ({ ...x, tutar: e.target.value }))} /></Field>
          <Field label="Tarih *"><input type="date" className="adm-inp" value={i.tarih} onChange={e => setI((x: any) => ({ ...x, tarih: e.target.value }))} /></Field>
          <Field label="Ödeme yöntemi"><select className="adm-inp" value={i.odeme_yontemi} onChange={e => setI((x: any) => ({ ...x, odeme_yontemi: e.target.value }))}>{['nakit', 'havale', 'kredi_karti', 'cek', 'diger'].map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Kasa/banka hesabı *" hint="Bakiye bu hesaba işlenir"><select className="adm-inp" value={kasaId} onChange={e => setKasaId(e.target.value)}><option value="">— Seçin —</option>{d.kasalar.map((k: any) => <option key={k.id} value={k.id}>{k.ad}</option>)}</select></Field>
          <Field label="Cari (opsiyonel)" span={2}><select className="adm-inp" value={cariId} onChange={e => setCariId(e.target.value)}><option value="">—</option>{d.cariler.map((c: any) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
          <Field label="Açıklama" span={3}><input className="adm-inp" value={i.aciklama} onChange={e => setI((x: any) => ({ ...x, aciklama: e.target.value }))} /></Field>
        </FormGrid>}

        {yev.length > 0 && <>
          <Divider label="Yevmiye kaydı önerisi (Tek Düzen Hesap Planı — öneridir, sisteme işlenmez)" />
          <table className="adm-table" style={{ width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Hesap</th><th style={{ textAlign: 'left' }}>Hesap adı</th><th style={{ textAlign: 'right' }}>Borç</th><th style={{ textAlign: 'right' }}>Alacak</th></tr></thead>
            <tbody>{yev.map((y: any, j: number) => <tr key={j}><td style={{ fontWeight: 600 }}>{y.hesap_kodu}</td><td>{y.hesap_adi}</td><td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }}>{y.borc ? fmt(y.borc) : ''}</td><td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }}>{y.alacak ? fmt(y.alacak) : ''}</td></tr>)}
              <tr><td colSpan={2} style={{ fontWeight: 700 }}>Toplam <Badge tone={d.yevmiyeToplam.dengeli ? 'green' : 'red'}>{d.yevmiyeToplam.dengeli ? 'dengeli' : 'DENGESİZ'}</Badge></td><td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>{fmt(d.yevmiyeToplam.borc)}</td><td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>{fmt(d.yevmiyeToplam.alacak)}</td></tr></tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={async () => { try { await navigator.clipboard.writeText(yevTsv()); toast.show('Yevmiye kopyalandı') } catch { toast.show('Kopyalanamadı', true) } }}><Copy size={12} />Kopyala</button>
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => csvDownload('yevmiye-onerisi.csv', yev.map((y: any) => ({ 'Hesap kodu': y.hesap_kodu, 'Hesap adı': y.hesap_adi, Borç: y.borc, Alacak: y.alacak })))}><Download size={12} />CSV</button>
          </div>
        </>}
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '14px 0 0' }}>Öneriler yapay zekayla üretilmiştir. Fatura yalnızca TASLAK olarak oluşur (cari bakiye ve stok etkilenmez); onaylamadan önce Faturalar ekranında kontrol edin. Yevmiye önerisi sisteme işlenmez, muhasebe programınıza siz girersiniz.</p>
      </>)}
    </Modal>
  )
}
