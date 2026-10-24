'use client'
import { TUR_AD, etiket, hesapla, satirTutar, type Dil, type Tur, type Veri } from '@/lib/ihracat-evrak'

const para = (x: number, pb: string, d = 2) => `${new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(x || 0)} ${pb}`
const say = (x: number, d = 3) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(x || 0)
const tarih = (t: string) => (t ? t.split('-').reverse().join('.') : '')
const S = { td: { border: '1px solid #999', padding: '4px 6px', verticalAlign: 'top' as const, fontSize: 11 }, th: { border: '1px solid #999', padding: '4px 6px', background: '#eee', fontSize: 10.5, textAlign: 'left' as const } }
const Blok = ({ baslik, children }: { baslik: string; children: React.ReactNode }) => <div style={{ border: '1px solid #999', padding: 6, minHeight: 64 }}><div style={{ fontSize: 9.5, color: '#555', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{baslik}</div><div style={{ whiteSpace: 'pre-line', fontSize: 11.5 }}>{children}</div></div>
const Alan = ({ k, v }: { k: string; v?: string }) => v ? <div style={{ fontSize: 11 }}><span style={{ color: '#555' }}>{k}: </span><b>{v}</b></div> : null

// A4 yazdırma görünümü. Sayfa dışında (ekranda) da aynı görünür; yazdırmada yalnızca #evrak-alani basılır.
export default function EvrakGoruntu({ tur, dil, v, no }: { tur: Tur; dil: Dil; v: Veri; no: string }) {
  const T = etiket(dil), s = hesapla(v), pb = v.paraBirimi, satirlar = v.kalemler.filter(k => k.aciklama.trim())
  const baslik = TUR_AD[tur][dil].toLocaleUpperCase(dil === 'tr' ? 'tr-TR' : 'en-US')
  return (
    <div id="evrak-alani" style={{ background: '#fff', color: '#000', width: '210mm', minHeight: '297mm', padding: '12mm', boxSizing: 'border-box', fontFamily: 'Arial, Helvetica, sans-serif', margin: '0 auto', boxShadow: '0 1px 8px rgba(0,0,0,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e55f28', paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{baslik}</div>
        <div style={{ textAlign: 'right', fontSize: 11.5 }}><div><b>{T.no}: {no || '—'}</b></div><div>{T.tarih}: {tarih(v.belgeTarihi)}</div>{tur === 'proforma' && v.gecerlilik && <div>{T.gecerlilik}: {tarih(v.gecerlilik)}</div>}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <Blok baslik={T.firma}>{v.ihracatci}</Blok>
        <Blok baslik={T.alici}>{v.alici}</Blok>
        {v.bildirimTarafi.trim() && <Blok baslik={T.bildirim}>{v.bildirimTarafi}</Blok>}
        <div style={{ border: '1px solid #999', padding: 6, display: 'grid', gap: 2, alignContent: 'start' }}>
          <Alan k={T.ref} v={v.referans} />
          {tur !== 'packing' && <Alan k={T.incoterm} v={[v.incoterm, v.teslimYeri].filter(Boolean).join(' ')} />}
          {tur !== 'packing' && <Alan k={T.odeme} v={v.odemeKosulu} />}
          {tur !== 'proforma' && <Alan k={T.mensei} v={v.mensei} />}
          <Alan k={T.yukleme} v={v.yuklemeLimani} /><Alan k={T.varis} v={v.varisLimani} /><Alan k={T.tasima} v={v.tasima} /><Alan k={T.konteyner} v={v.konteynerNo} />
        </div>
      </div>

      {tur !== 'packing' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
          <thead><tr><th style={S.th}>#</th><th style={S.th}>{T.aciklama}</th>{tur === 'commercial' && <th style={S.th}>{T.gtip}</th>}<th style={{ ...S.th, textAlign: 'right' }}>{T.miktar}</th><th style={S.th}>{T.birim}</th><th style={{ ...S.th, textAlign: 'right' }}>{T.fiyat} ({pb})</th><th style={{ ...S.th, textAlign: 'right' }}>{T.tutar} ({pb})</th></tr></thead>
          <tbody>{satirlar.map((k, i) => <tr key={i}><td style={S.td}>{i + 1}</td><td style={S.td}>{k.aciklama}</td>{tur === 'commercial' && <td style={S.td}>{k.gtip}</td>}<td style={{ ...S.td, textAlign: 'right' }}>{say(k.miktar)}</td><td style={S.td}>{k.birim}</td><td style={{ ...S.td, textAlign: 'right' }}>{para(k.fiyat, '', 4).trim()}</td><td style={{ ...S.td, textAlign: 'right' }}>{para(satirTutar(k), '').trim()}</td></tr>)}</tbody>
          <tfoot>
            <tr><td colSpan={tur === 'commercial' ? 6 : 5} style={{ ...S.td, textAlign: 'right' }}>{T.alt}</td><td style={{ ...S.td, textAlign: 'right' }}>{para(s.altToplam, pb)}</td></tr>
            {v.navlun > 0 && <tr><td colSpan={tur === 'commercial' ? 6 : 5} style={{ ...S.td, textAlign: 'right' }}>{T.navlun}</td><td style={{ ...S.td, textAlign: 'right' }}>{para(v.navlun, pb)}</td></tr>}
            {v.sigorta > 0 && <tr><td colSpan={tur === 'commercial' ? 6 : 5} style={{ ...S.td, textAlign: 'right' }}>{T.sigorta}</td><td style={{ ...S.td, textAlign: 'right' }}>{para(v.sigorta, pb)}</td></tr>}
            <tr><td colSpan={tur === 'commercial' ? 6 : 5} style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{T.genel}</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{para(s.genel, pb)}</td></tr>
          </tfoot>
        </table>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
          <thead><tr><th style={S.th}>#</th><th style={S.th}>{T.aciklama}</th><th style={{ ...S.th, textAlign: 'right' }}>{T.miktar}</th><th style={S.th}>{T.birim}</th><th style={{ ...S.th, textAlign: 'right' }}>{T.koli}</th><th style={{ ...S.th, textAlign: 'right' }}>{T.net}</th><th style={{ ...S.th, textAlign: 'right' }}>{T.brut}</th><th style={{ ...S.th, textAlign: 'right' }}>{T.m3}</th></tr></thead>
          <tbody>{satirlar.map((k, i) => <tr key={i}><td style={S.td}>{i + 1}</td><td style={S.td}>{k.aciklama}</td><td style={{ ...S.td, textAlign: 'right' }}>{say(k.miktar)}</td><td style={S.td}>{k.birim}</td><td style={{ ...S.td, textAlign: 'right' }}>{k.koli ? say(k.koli, 0) : ''}</td><td style={{ ...S.td, textAlign: 'right' }}>{k.net ? say(k.net) : ''}</td><td style={{ ...S.td, textAlign: 'right' }}>{k.brut ? say(k.brut) : ''}</td><td style={{ ...S.td, textAlign: 'right' }}>{k.m3 ? say(k.m3) : ''}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={2} style={{ ...S.td, fontWeight: 800 }}>{T.toplam}</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{say(s.miktar)}</td><td style={S.td} /><td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{say(s.koli, 0)}</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{say(s.net)}</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{say(s.brut)}</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{say(s.m3)}</td></tr></tfoot>
        </table>
      )}
      {tur === 'packing' && (v.palet > 0 || v.isaretler.trim()) && <div style={{ marginTop: 8, fontSize: 11.5, display: 'grid', gap: 2 }}>{v.palet > 0 && <div>{T.palet}: <b>{say(v.palet, 0)}</b></div>}{v.isaretler.trim() && <div style={{ whiteSpace: 'pre-line' }}>{T.isaret}: <b>{v.isaretler}</b></div>}</div>}
      {tur !== 'packing' && v.banka.trim() && <div style={{ marginTop: 10 }}><Blok baslik={T.banka}>{v.banka}</Blok></div>}
      {v.notlar.trim() && <div style={{ marginTop: 8 }}><Blok baslik={T.not}>{v.notlar}</Blok></div>}
      <div style={{ marginTop: 34, display: 'flex', justifyContent: 'flex-end' }}><div style={{ width: 200, borderTop: '1px solid #000', paddingTop: 4, fontSize: 11, textAlign: 'center' }}>{T.imza}</div></div>
    </div>
  )
}
