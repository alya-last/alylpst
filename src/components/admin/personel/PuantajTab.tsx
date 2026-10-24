'use client'
import { useCallback, useEffect, useState } from 'react'
import { personelIstek } from '@/lib/personel-client'
import { Badge, Modal, Empty } from '@/components/admin/erp/ui'
import { DURUM, hm, tarihTR, saatTR, bugunTR, IZIN_TUR } from './ortak'
import { Download, Printer, ChevronLeft, ChevronRight } from 'lucide-react'

type Toast = { show: (m: string, err?: boolean) => void }
const ayEkle = (d: string, n: number) => { const [y, m] = d.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return t.toISOString().slice(0, 7) }
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const SEMBOL: Record<string, string> = { calisti: 'Ç', icerde: 'İç', eksik: '?', devamsiz: 'D', izinli: 'İ', tatil: 'R', yarim_tatil: 'R½', hafta_tatili: 'H', tatilde_calisti: 'T', gelmedi: '', gelecek: '', kapsam_disi: '' }
const RENK: Record<string, string> = { calisti: 'var(--adm-green)', icerde: 'var(--adm-blue)', eksik: 'var(--adm-amber)', devamsiz: 'var(--adm-red)', izinli: 'var(--adm-blue)', tatilde_calisti: 'var(--adm-ac)' }

export default function PuantajTab({ toast }: { toast: Toast }) {
  const [donem, setDonem] = useState(bugunTR().slice(0, 7))
  const [veri, setVeri] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sec, setSec] = useState<any>(null)

  const yukle = useCallback(async () => {
    setLoading(true)
    try { setVeri(await personelIstek('puantaj', { donem })) } catch (e: any) { toast.show(e.message, true); setVeri(null) }
    setLoading(false)
  }, [donem]) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  const [y, m] = donem.split('-').map(Number)
  const gunler: string[] = veri?.satirlar?.[0]?.gunler.map((g: any) => g.tarih) || []

  return (
    <div id="puantaj-alani">
      <style>{`@media print { body * { visibility: hidden !important; } #puantaj-alani, #puantaj-alani * { visibility: visible !important; } #puantaj-alani { position: absolute; left: 0; top: 0; width: 100%; padding: 12px; background: #fff; color: #000; } .no-print { display: none !important; } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button className="adm-btn-ghost" onClick={() => setDonem(ayEkle(donem + '-01', -1))}><ChevronLeft size={14} /></button>
        <b style={{ minWidth: 130, textAlign: 'center' }}>{AYLAR[m - 1]} {y}</b>
        <button className="adm-btn-ghost" onClick={() => setDonem(ayEkle(donem + '-01', 1))}><ChevronRight size={14} /></button>
        <input type="month" className="adm-inp" style={{ width: 160 }} value={donem} onChange={e => e.target.value && setDonem(e.target.value)} />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="adm-btn-ghost" onClick={() => window.print()}><Printer size={13} />Yazdır</button>
          <a className="adm-btn" style={{ textDecoration: 'none' }} href={`/api/admin/personel-puantaj?donem=${donem}`}><Download size={13} />Excel</a>
        </span>
      </div>

      {loading ? <p style={{ color: 'var(--adm-tx3)' }}>Yükleniyor…</p> : !veri || !veri.satirlar.length ? <Empty title="Bu dönem için personel yok" sub="Personel sekmesinden personel ekleyin" /> : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid var(--adm-bd)' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11.5, width: '100%' }}>
              <thead><tr style={{ background: 'var(--adm-bg2)' }}>
                <th style={th}>Personel</th>
                {gunler.map(t => <th key={t} style={{ ...th, textAlign: 'center', minWidth: 26 }}>{+t.slice(8)}</th>)}
                <th style={th}>Süre</th><th style={th}>F.Mesai</th><th style={th}>Geç</th><th style={th}>Dev.</th>
              </tr></thead>
              <tbody>{veri.satirlar.map((s: any) => (
                <tr key={s.personel.id} className="adm-row" style={{ cursor: 'pointer' }} onClick={() => setSec(s)}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}><b>{s.personel.ad_soyad}</b> <span style={{ color: 'var(--adm-tx3)' }}>{s.personel.sicil_no}</span></td>
                  {s.gunler.map((g: any) => <td key={g.tarih} title={`${tarihTR(g.tarih)} — ${DURUM[g.durum]?.l || ''}`} style={{ ...td, textAlign: 'center', color: RENK[g.durum] || 'var(--adm-tx3)', fontWeight: 700, padding: '5px 2px' }}>{SEMBOL[g.durum] ?? ''}</td>)}
                  <td style={td}>{hm(s.ozet.calisilan_dk)}</td>
                  <td style={td}>{s.ozet.fazla_mesai_dk + s.ozet.haftalik_fazla_dk ? hm(s.ozet.fazla_mesai_dk + s.ozet.haftalik_fazla_dk) : ''}</td>
                  <td style={{ ...td, color: s.ozet.gec_gun ? 'var(--adm-red)' : undefined }}>{s.ozet.gec_gun ? `${s.ozet.gec_gun}g/${s.ozet.gec_dk}dk` : ''}</td>
                  <td style={{ ...td, color: s.ozet.devamsiz_gun ? 'var(--adm-red)' : undefined, fontWeight: 700 }}>{s.ozet.devamsiz_gun || ''}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>Ç çalıştı · İç içeride · ? çıkış kaydı yok · D devamsız · İ izinli · R resmî tatil · H hafta tatili · T tatilde çalıştı. Satıra tıklayınca gün gün detay açılır. Yasal eşikler (haftalık {veri.ayar.haftalik_normal_saat} saat, çarpan) Ayarlar’dan değiştirilebilir; bordro öncesi mali müşavirinizle doğrulayın.</p>
        </>
      )}

      <Modal open={!!sec} onClose={() => setSec(null)} width={780} title={sec ? `${sec.personel.ad_soyad} — ${AYLAR[m - 1]} ${y}` : ''} footer={<button type="button" className="adm-btn-ghost" onClick={() => setSec(null)}>Kapat</button>}>
        {sec && <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 12.5 }}>
            <Badge tone="green">{sec.ozet.calisilan_gun} gün · {hm(sec.ozet.calisilan_dk)} saat</Badge>
            {sec.ozet.fazla_mesai_dk + sec.ozet.haftalik_fazla_dk > 0 && <Badge tone="ac">Fazla mesai {hm(sec.ozet.fazla_mesai_dk + sec.ozet.haftalik_fazla_dk)}</Badge>}
            {sec.ozet.tatil_calisma_dk > 0 && <Badge tone="ac">Tatilde {hm(sec.ozet.tatil_calisma_dk)}</Badge>}
            {sec.ozet.devamsiz_gun > 0 && <Badge tone="red">{sec.ozet.devamsiz_gun} devamsız</Badge>}
            {sec.ozet.eksik_kayit_gun > 0 && <Badge tone="amber">{sec.ozet.eksik_kayit_gun} eksik kayıt</Badge>}
            {Object.entries(sec.ozet.izin_gun || {}).map(([k, v]) => <Badge key={k} tone="blue">{IZIN_TUR[k] || k}: {String(v)} gün</Badge>)}
          </div>
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%' }}>
              <thead><tr><th style={th}>Tarih</th><th style={th}>Durum</th><th style={th}>Giriş</th><th style={th}>Çıkış</th><th style={th}>Süre</th><th style={th}>Not</th></tr></thead>
              <tbody>{sec.gunler.filter((g: any) => !['kapsam_disi', 'gelecek'].includes(g.durum)).map((g: any) => (
                <tr key={g.tarih} className="adm-row">
                  <td style={td}>{tarihTR(g.tarih)}</td>
                  <td style={td}><Badge tone={DURUM[g.durum]?.tone}>{g.izin_tur ? IZIN_TUR[g.izin_tur] || g.izin_tur : g.tatil_ad || DURUM[g.durum]?.l}</Badge></td>
                  <td style={td}>{saatTR(g.giris)}</td><td style={td}>{saatTR(g.cikis)}</td>
                  <td style={td}>{g.calisilan_dk ? hm(g.calisilan_dk) : ''}</td>
                  <td style={{ ...td, fontSize: 11.5 }}>{[g.gec_dk ? `${g.gec_dk} dk geç` : '', g.erken_cikis_dk ? `${g.erken_cikis_dk} dk erken çıkış` : '', g.fazla_mesai_dk ? `+${hm(g.fazla_mesai_dk)} mesai` : '', ...g.uyarilar].filter(Boolean).join(' · ')}</td>
                </tr>))}</tbody>
            </table>
          </div>
          {sec.ozet.haftalik?.some((h: any) => h.fazla_dk > 0) && <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>Haftalık eşik aşımı: {sec.ozet.haftalik.filter((h: any) => h.fazla_dk > 0).map((h: any) => `${tarihTR(h.hafta)} haftası +${hm(h.fazla_dk)}`).join(', ')}</p>}
        </>}
      </Modal>
    </div>
  )
}
const th: React.CSSProperties = { padding: '7px 8px', textAlign: 'left', fontSize: 11, color: 'var(--adm-tx3)', borderBottom: '1px solid var(--adm-bd)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--adm-bd)' }
