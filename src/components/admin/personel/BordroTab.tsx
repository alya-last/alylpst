'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { web } from '@/lib/web-data'
import { createClient } from '@/lib/supabase/client'
import { personelIstek } from '@/lib/personel-client'
import { Badge, Modal, Field, FormGrid, Card, Empty } from '@/components/admin/erp/ui'
import { hesaplaBordroSatiri, type BordroParametre } from '@/lib/bordro'
import { tarihTR, bugunTR } from './ortak'
import { ChevronLeft, ChevronRight, Calculator, CheckCircle2, Plus } from 'lucide-react'

type Toast = { show: (m: string, err?: boolean) => void }
const ayEkle = (d: string, n: number) => { const [y, m] = d.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return t.toISOString().slice(0, 7) }
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const paraTR = (n: number) => (n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const EK = ['devir', 'mesai_ucreti', 'yemek', 'banka_odeme', 'elden_odeme'] as const
const ekAlanlar = (k: any) => Object.fromEntries(EK.map(a => [a, +(k?.[a]) || 0]))
// Net / kalan = (brüt − yasal kesintiler) + devir + mesai ücreti + yemek − avans − banka − elden
const netToplam = (k: any) => +((+k.brut_maas || 0) - (+k.sgk_isci_kesintisi || 0) - (+k.issizlik_kesintisi || 0) - (+k.gelir_vergisi || 0) - (+k.damga_vergisi || 0)
  + (+k.devir || 0) + (+k.mesai_ucreti || 0) + (+k.yemek || 0) - (+k.avans_mahsup || 0) - (+k.banka_odeme || 0) - (+k.elden_odeme || 0)).toFixed(2)
const DURUM_L: Record<string, { l: string; tone: any }> = { taslak: { l: 'Taslak', tone: 'amber' }, onaylandi: { l: 'Onaylandı', tone: 'blue' }, muhasebelesti: { l: 'Muhasebeleşti', tone: 'green' } }

export default function BordroTab({ toast }: { toast: Toast }) {
  const [donem, setDonem] = useState(bugunTR().slice(0, 7))
  const [personel, setPersonel] = useState<any[]>([])
  const [maaslar, setMaaslar] = useState<any[]>([])
  const [parametre, setParametre] = useState<any>(null)
  const [donemRow, setDonemRow] = useState<any>(null)
  const [kalemler, setKalemler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [maasModal, setMaasModal] = useState<{ personel_id: string; ad_soyad: string } | null>(null)
  const [odemeModal, setOdemeModal] = useState<{ personel_id: string; ad_soyad: string } | null>(null)
  const [odemeler, setOdemeler] = useState<any[]>([])
  const [odemeForm, setOdemeForm] = useState<any>({ tur: 'avans', tarih: bugunTR(), tutar: '', aciklama: '' })
  const [maasForm, setMaasForm] = useState<any>({ brut_maas: '', maas_tipi: 'aylik', gecerlilik_baslangic: bugunTR() })

  const yil = +donem.slice(0, 4)
  const donemSonu = `${donem}-31`

  const yukle = useCallback(async () => {
    setLoading(true)
    const [p, m, par, d] = await Promise.all([
      web.from('personel').select('id,sicil_no,ad_soyad,departman,ise_giris,isten_cikis,aktif').order('ad_soyad'),
      web.from('bordro_maas_bilgileri').select('*').order('gecerlilik_baslangic', { ascending: false }).limit(5000),
      web.from('bordro_parametreleri').select('*').eq('yil', yil).maybeSingle(),
      web.from('bordro_donemleri').select('*').eq('donem', `${donem}-01`).maybeSingle(),
    ])
    setPersonel(p.data || []); setMaaslar(m.data || []); setParametre(par.data || null); setDonemRow(d.data || null)
    if (d.data) {
      const k = await web.from('bordro_kalemleri').select('*').eq('donem_id', d.data.id)
      setKalemler(k.data || [])
    } else setKalemler([])
    setLoading(false)
  }, [donem, yil])
  useEffect(() => { yukle() }, [yukle])

  const odemeYukle = useCallback(async (pid: string) => {
    const { data } = await web.from('personel_odemeleri').select('*').eq('personel_id', pid).eq('donem', `${donem}-01`).order('tarih')
    setOdemeler(data || [])
  }, [donem])
  useEffect(() => { if (odemeModal) odemeYukle(odemeModal.personel_id); else setOdemeler([]) }, [odemeModal, odemeYukle])

  async function odemeEkle(e: React.FormEvent) {
    e.preventDefault(); if (busy || !odemeModal) return
    if (!(+odemeForm.tutar > 0)) return toast.show('Tutar 0\'dan büyük olmalı', true)
    setBusy(true)
    const { data: { user } } = await createClient().auth.getUser()
    const { error } = await web.from('personel_odemeleri').insert({ personel_id: odemeModal.personel_id, donem: `${donem}-01`, tur: odemeForm.tur, tarih: odemeForm.tarih, tutar: +odemeForm.tutar, aciklama: odemeForm.aciklama || null, created_by: user?.id ?? null })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setOdemeForm((f: any) => ({ ...f, tutar: '', aciklama: '' })); odemeYukle(odemeModal.personel_id); yukle()
  }
  async function odemeSil(id: string) {
    if (!confirm('Bu ödeme kaydı silinsin mi?')) return
    const { error } = await web.from('personel_odemeleri').delete().eq('id', id)
    if (error) return toast.show(error.message, true)
    if (odemeModal) odemeYukle(odemeModal.personel_id); yukle()
  }

  const guncelMaas = useMemo(() => {
    const m = new Map<string, any>()
    for (const p of personel) {
      const aday = maaslar.filter(x => x.personel_id === p.id && x.gecerlilik_baslangic <= donemSonu).sort((a, b) => b.gecerlilik_baslangic.localeCompare(a.gecerlilik_baslangic))[0]
      if (aday) m.set(p.id, aday)
    }
    return m
  }, [personel, maaslar, donemSonu])

  const aktifPersonel = useMemo(() => personel.filter(p => p.aktif || (p.isten_cikis && p.isten_cikis >= `${donem}-01`)), [personel, donem])
  const kalemMap = useMemo(() => new Map(kalemler.map(k => [k.personel_id, k])), [kalemler])
  const kilitli = donemRow && donemRow.durum !== 'taslak'

  async function hesapla() {
    if (!parametre) return toast.show(`${yil} yılı için bordro parametreleri tanımlı değil`, true)
    if (kilitli) return toast.show('Bu dönem zaten onaylanmış, yeniden hesaplanamaz', true)
    setBusy(true)
    try {
      const puantaj: any = await personelIstek('puantaj', { donem })
      const { data: { user } } = await createClient().auth.getUser()

      let donemId = donemRow?.id
      if (!donemId) {
        const { data, error } = await web.from('bordro_donemleri').insert({ donem: `${donem}-01`, olusturan: user?.id ?? null }).select('*').single()
        if (error) throw new Error(error.message)
        donemId = data.id; setDonemRow(data)
      }

      // Bu yıl, bu aydan önceki aylarda biriken vergi matrahı (kümülatif gelir vergisi dilimi için)
      const { data: gecmis } = await web.from('bordro_kalemleri')
        .select('personel_id, brut_maas, sgk_isci_kesintisi, issizlik_kesintisi, bordro_donemleri!inner(donem)')
        .gte('bordro_donemleri.donem', `${yil}-01-01`).lt('bordro_donemleri.donem', `${donem}-01`)
      const kumulatif = new Map<string, number>()
      for (const g of (gecmis || []) as any[]) {
        const onceki = kumulatif.get(g.personel_id) || 0
        kumulatif.set(g.personel_id, onceki + Math.max(0, (g.brut_maas || 0) - (g.sgk_isci_kesintisi || 0) - (g.issizlik_kesintisi || 0)))
      }

      const par: BordroParametre = {
        sgk_isci_orani: +parametre.sgk_isci_orani, issizlik_isci_orani: +parametre.issizlik_isci_orani,
        sgk_isveren_orani: +parametre.sgk_isveren_orani, damga_vergisi_orani: +parametre.damga_vergisi_orani,
        gelir_vergisi_dilimleri: parametre.gelir_vergisi_dilimleri || [],
      }

      const satirlar = (puantaj?.satirlar || [])
      const kayitlar: any[] = []
      for (const s of satirlar) {
        const p = s.personel
        const maas = guncelMaas.get(p.id)
        if (!maas) continue // maaş bilgisi girilmemiş personel atlanır
        if (maas.maas_tipi === 'net') {
          // Net bazlı cetvel: SGK/vergi hesaplanmaz; elle girilmiş/içe aktarılmış satır (avans, banka, mesai…) ezilmez.
          if (kalemMap.has(p.id)) continue
          kayitlar.push({
            donem_id: donemId, personel_id: p.id, calisilan_gun: s.ozet.calisilan_gun, calisilan_dk: s.ozet.calisilan_dk, fazla_mesai_dk: s.ozet.fazla_mesai_dk,
            devamsiz_gun: s.ozet.devamsiz_gun, izin_gun: Object.values(s.ozet.izin_gun || {}).reduce((a: number, b: any) => a + b, 0),
            brut_maas: +maas.brut_maas, sgk_isci_kesintisi: 0, issizlik_kesintisi: 0, gelir_vergisi: 0, damga_vergisi: 0, avans_mahsup: 0,
            net_maas: +maas.brut_maas, net_bazli: true, updated_by: user?.id ?? null,
          })
          continue
        }
        const sonuc = hesaplaBordroSatiri({ brutMaas: +maas.brut_maas, kumulatifMatrahOncesi: kumulatif.get(p.id) || 0, parametre: par })
        kayitlar.push({
          donem_id: donemId, personel_id: p.id,
          calisilan_gun: s.ozet.calisilan_gun, calisilan_dk: s.ozet.calisilan_dk, fazla_mesai_dk: s.ozet.fazla_mesai_dk,
          devamsiz_gun: s.ozet.devamsiz_gun, izin_gun: Object.values(s.ozet.izin_gun || {}).reduce((a: number, b: any) => a + b, 0),
          brut_maas: sonuc.brut_maas, sgk_isci_kesintisi: sonuc.sgk_isci_kesintisi, issizlik_kesintisi: sonuc.issizlik_kesintisi,
          gelir_vergisi: sonuc.gelir_vergisi, damga_vergisi: sonuc.damga_vergisi, avans_mahsup: kalemMap.get(p.id)?.avans_mahsup || 0,
          net_maas: netToplam({ ...sonuc, ...ekAlanlar(kalemMap.get(p.id)), avans_mahsup: kalemMap.get(p.id)?.avans_mahsup || 0 }),
          updated_by: user?.id ?? null,
        })
      }
      if (!kayitlar.length) throw new Error('Maaş bilgisi girilmiş aktif personel bulunamadı')
      const { error } = await web.from('bordro_kalemleri').upsert(kayitlar, { onConflict: 'donem_id,personel_id' })
      if (error) throw new Error(error.message)
      toast.show(`${kayitlar.length} personel için bordro hesaplandı (taslak)`)
      yukle()
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }

  async function alanGuncelle(kalemId: string, alan: string, deger: number) {
    const mevcut = kalemler.find(k => k.id === kalemId) || {}
    const net = netToplam({ ...mevcut, [alan]: deger })
    const { error } = await web.from('bordro_kalemleri').update({ [alan]: deger, net_maas: net, updated_at: new Date().toISOString() }).eq('id', kalemId)
    if (error) return toast.show(error.message, true)
    yukle()
  }

  async function onayla() {
    if (!donemRow) return
    if (!confirm(`${AYLAR[+donem.slice(5, 7) - 1]} ${yil} bordrosu onaylanıp muhasebeye (gider) işlensin mi? Bu işlem geri alınamaz.`)) return
    setBusy(true)
    const { error } = await web.rpc('rpc_bordro_onayla', { p_donem_id: donemRow.id })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    toast.show('Bordro onaylandı ve muhasebeye işlendi'); yukle()
  }

  async function kaydetMaas(e: React.FormEvent) {
    e.preventDefault(); if (busy || !maasModal) return
    setBusy(true)
    const { data: { user } } = await createClient().auth.getUser()
    const { error } = await web.from('bordro_maas_bilgileri').insert({
      personel_id: maasModal.personel_id, brut_maas: +maasForm.brut_maas, maas_tipi: maasForm.maas_tipi,
      gecerlilik_baslangic: maasForm.gecerlilik_baslangic, created_by: user?.id ?? null,
    })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setMaasModal(null); toast.show('Maaş bilgisi kaydedildi'); yukle()
  }

  const toplam = useMemo(() => kalemler.reduce((s, k) => ({ net: s.net + (+k.net_maas || 0), brut: s.brut + (+k.brut_maas || 0), devir: s.devir + (+k.devir || 0), mesai: s.mesai + (+k.mesai_ucreti || 0), yemek: s.yemek + (+k.yemek || 0), avans: s.avans + (+k.avans_mahsup || 0), banka: s.banka + (+k.banka_odeme || 0), elden: s.elden + (+k.elden_odeme || 0) }), { net: 0, brut: 0, devir: 0, mesai: 0, yemek: 0, avans: 0, banka: 0, elden: 0 }), [kalemler])

  if (!parametre && !loading) return (
    <Empty title={`${yil} yılı için bordro parametreleri tanımlı değil`} sub="SGK/vergi oranları veritabanında bordro_parametreleri tablosunda tanımlanmalı — bir mali müşavirle teyit ettirip ekleyin." />
  )

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--adm-tx3)', background: 'var(--adm-bg2)', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
        Bu modüldeki hesaplama basitleştirilmiştir (asgari ücret istisnası gibi özel muafiyetler dahil değildir). Onaylamadan önce mali müşavirinizle teyit edin.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button className="adm-btn-ghost" onClick={() => setDonem(ayEkle(donem, -1))}><ChevronLeft size={14} /></button>
        <b style={{ minWidth: 130, textAlign: 'center' }}>{AYLAR[+donem.slice(5, 7) - 1]} {yil}</b>
        <button className="adm-btn-ghost" onClick={() => setDonem(ayEkle(donem, 1))}><ChevronRight size={14} /></button>
        <input type="month" className="adm-inp" style={{ width: 160 }} value={donem} onChange={e => e.target.value && setDonem(e.target.value)} />
        {donemRow && <Badge tone={DURUM_L[donemRow.durum]?.tone}>{DURUM_L[donemRow.durum]?.l}</Badge>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="adm-btn-ghost" disabled={busy || kilitli} onClick={hesapla}><Calculator size={13} />{kalemler.length ? 'Yeniden Hesapla' : 'Hesapla'}</button>
          {!!kalemler.length && !kilitli && <button className="adm-btn" disabled={busy} onClick={onayla}><CheckCircle2 size={13} />Onayla ve Muhasebeye Aktar</button>}
        </span>
      </div>

      {loading ? <p style={{ color: 'var(--adm-tx3)' }}>Yükleniyor…</p> : !kalemler.length ? (
        <Empty title="Bu dönem için bordro hesaplanmadı" sub="Aktif personelin güncel maaş bilgisi girilmiş olmalı — yoksa aşağıdan ekleyin, sonra Hesapla'ya basın" />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--adm-bd)' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
            <thead><tr style={{ background: 'var(--adm-bg2)' }}>
              {['Personel', 'Gün', 'Mesai (saat/dk)', 'Devamsız', 'İzin', 'Brüt / Maaş', 'SGK', 'İşsizlik', 'Gelir V.', 'Damga V.', 'Devir', 'Mesai Ücr.', 'Yemek', 'Avans', 'Banka', 'Elden', 'Ödeme Toplamı', 'Net / Kalan'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {aktifPersonel.filter(p => kalemMap.has(p.id)).map(p => {
                const k = kalemMap.get(p.id)
                return (
                  <tr key={p.id} className="adm-row">
                    <td style={td}><b>{p.ad_soyad}</b> <span style={{ color: 'var(--adm-tx3)' }}>{p.sicil_no}</span></td>
                    <td style={{ ...td, textAlign: 'right' }}>{k.calisilan_gun}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{k.net_bazli ? `${k.mesai_saat} sa` : k.fazla_mesai_dk}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{k.devamsiz_gun}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{k.izin_gun}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{paraTR(k.brut_maas)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{paraTR(k.sgk_isci_kesintisi)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{paraTR(k.issizlik_kesintisi)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{paraTR(k.gelir_vergisi)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{paraTR(k.damga_vergisi)}</td>
                    {(['devir', 'mesai_ucreti', 'yemek'] as const).map(alan => (
                      <td key={alan} style={{ ...td, textAlign: 'right', width: 90 }}>{kilitli ? paraTR(k[alan]) :
                        <input type="number" step="0.01" className="adm-inp" style={{ width: 84, textAlign: 'right', padding: '2px 6px' }} defaultValue={k[alan]}
                          onBlur={e => { const v = +e.target.value || 0; if (v !== +k[alan]) alanGuncelle(k.id, alan, v) }} />}
                      </td>
                    ))}
                    <td style={{ ...td, textAlign: 'right' }}>{paraTR(k.avans_mahsup)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{paraTR(k.banka_odeme)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{paraTR(k.elden_odeme)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {paraTR((+k.avans_mahsup || 0) + (+k.banka_odeme || 0) + (+k.elden_odeme || 0))}{' '}
                      <button className="adm-btn-ghost" style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => setOdemeModal({ personel_id: p.id, ad_soyad: p.ad_soyad })}>Ödemeler</button>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}><b>{paraTR(k.net_maas)}</b></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot><tr style={{ background: 'var(--adm-bg2)', fontWeight: 700 }}>
              <td style={td} colSpan={5}>Toplam</td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.brut)}</td>
              <td style={td} colSpan={4}></td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.devir)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.mesai)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.yemek)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.avans)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.banka)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.elden)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.avans + toplam.banka + toplam.elden)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{paraTR(toplam.net)}</td>
            </tr></tfoot>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Card title="Maaş Bilgileri" pad={0}>
          {aktifPersonel.map(p => {
            const m = guncelMaas.get(p.id)
            return (
              <div key={p.id} className="adm-row" style={{ padding: '8px 18px', display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
                <span style={{ flex: 1 }}><b>{p.ad_soyad}</b> <span style={{ color: 'var(--adm-tx3)', fontSize: 11.5 }}>{p.sicil_no}</span></span>
                {m ? <span>Brüt {paraTR(m.brut_maas)} <span style={{ color: 'var(--adm-tx3)', fontSize: 11 }}>({tarihTR(m.gecerlilik_baslangic)}&apos;den itibaren)</span></span> : <span style={{ color: 'var(--adm-red)' }}>Maaş bilgisi yok</span>}
                <button className="adm-btn-ghost" style={{ padding: '3px 10px' }} onClick={() => { setMaasModal({ personel_id: p.id, ad_soyad: p.ad_soyad }); setMaasForm({ brut_maas: m?.brut_maas || '', maas_tipi: m?.maas_tipi || 'aylik', gecerlilik_baslangic: bugunTR() }) }}><Plus size={12} />{m ? 'Zam / Güncelle' : 'Maaş Ekle'}</button>
              </div>
            )
          })}
        </Card>
      </div>

      <Modal open={!!odemeModal} onClose={() => setOdemeModal(null)} onSubmit={odemeEkle} width={560} title={`Avans / Ödemeler — ${odemeModal?.ad_soyad || ''} · ${AYLAR[+donem.slice(5, 7) - 1]} ${yil}`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setOdemeModal(null)}>Kapat</button>{!kilitli && <button type="submit" className="adm-btn" disabled={busy}>Ekle</button>}</>}>
        <div style={{ marginBottom: 12 }}>
          {odemeler.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)' }}>Bu dönem için ödeme kaydı yok.</p> : odemeler.map(o => (
            <div key={o.id} className="adm-row" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
              <Badge tone={o.tur === 'avans' ? 'amber' : o.tur === 'banka' ? 'blue' : 'green'}>{o.tur === 'avans' ? 'Avans' : o.tur === 'banka' ? 'Banka' : 'Elden'}</Badge>
              <span style={{ color: 'var(--adm-tx3)' }}>{tarihTR(o.tarih)}</span>
              <span style={{ flex: 1, color: 'var(--adm-tx3)', fontSize: 12 }}>{o.aciklama}</span>
              <b>{paraTR(+o.tutar)}</b>
              {!kilitli && <button type="button" className="adm-btn-ghost" style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => odemeSil(o.id)}>Sil</button>}
            </div>
          ))}
        </div>
        {!kilitli && (
          <FormGrid cols={2}>
            <Field label="Tür"><select className="adm-inp" value={odemeForm.tur} onChange={e => setOdemeForm((f: any) => ({ ...f, tur: e.target.value }))}><option value="avans">Avans (mahsup edilir)</option><option value="banka">Maaş — Banka</option><option value="elden">Maaş — Elden</option></select></Field>
            <Field label="Tarih *"><input type="date" className="adm-inp" required value={odemeForm.tarih} onChange={e => setOdemeForm((f: any) => ({ ...f, tarih: e.target.value }))} /></Field>
            <Field label="Tutar *"><input type="number" step="0.01" className="adm-inp" required value={odemeForm.tutar} onChange={e => setOdemeForm((f: any) => ({ ...f, tutar: e.target.value }))} /></Field>
            <Field label="Açıklama"><input className="adm-inp" value={odemeForm.aciklama} onChange={e => setOdemeForm((f: any) => ({ ...f, aciklama: e.target.value }))} /></Field>
          </FormGrid>
        )}
      </Modal>

      <Modal open={!!maasModal} onClose={() => setMaasModal(null)} onSubmit={kaydetMaas} width={460} title={`Maaş Bilgisi — ${maasModal?.ad_soyad || ''}`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setMaasModal(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid cols={2}>
          <Field label={maasForm.maas_tipi === 'net' ? 'Net Maaş *' : 'Brüt Maaş *'}><input type="number" step="0.01" className="adm-inp" required value={maasForm.brut_maas} onChange={e => setMaasForm((f: any) => ({ ...f, brut_maas: e.target.value }))} /></Field>
          <Field label="Tip"><select className="adm-inp" value={maasForm.maas_tipi} onChange={e => setMaasForm((f: any) => ({ ...f, maas_tipi: e.target.value }))}><option value="aylik">Aylık</option><option value="saatlik">Saatlik</option><option value="net">Net (kesintisiz cetvel)</option></select></Field>
          <Field label="Geçerlilik Başlangıcı *" span={2} hint="Bu tarihten itibaren geçerli olur, önceki kayıt geçmiş için saklı kalır"><input type="date" className="adm-inp" required value={maasForm.gecerlilik_baslangic} onChange={e => setMaasForm((f: any) => ({ ...f, gecerlilik_baslangic: e.target.value }))} /></Field>
        </FormGrid>
      </Modal>
    </div>
  )
}

const th: React.CSSProperties = { padding: '7px 10px', textAlign: 'left', fontSize: 11, color: 'var(--adm-tx3)', borderBottom: '1px solid var(--adm-bd)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--adm-bd)', whiteSpace: 'nowrap' }
