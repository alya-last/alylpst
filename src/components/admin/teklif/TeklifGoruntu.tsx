'use client'
import { etiket, satirNet, teklifHesapla, type Dil, type TKalem } from '@/lib/teklif'

const para = (n: number, pb: string) => `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)} ${pb}`
const tarih = (t: string) => (t ? t.split('-').reverse().join('.') : '')
const S = { td: { border: '1px solid #999', padding: '4px 6px', verticalAlign: 'top' as const, fontSize: 11 }, th: { border: '1px solid #999', padding: '4px 6px', background: '#eee', fontSize: 10.5, textAlign: 'left' as const } }

export default function TeklifGoruntu({ no, dil, firma, musteri, tarihi, gecerlilik, paraBirimi, kdvOrani, kalemler, kosullar }: {
  no: string; dil: Dil; firma: string; musteri: string; tarihi: string; gecerlilik: string; paraBirimi: string; kdvOrani: number; kalemler: TKalem[]; kosullar: string
}) {
  const T = etiket(dil), s = teklifHesapla(kalemler, kdvOrani), sat = kalemler.filter(k => k.urun_adi.trim()), iskVar = sat.some(k => +k.iskonto_yuzde > 0)
  return (
    <div id="teklif-alani" style={{ background: '#fff', color: '#000', width: '210mm', minHeight: '297mm', padding: '12mm', boxSizing: 'border-box', fontFamily: 'Arial, Helvetica, sans-serif', margin: '0 auto', boxShadow: '0 1px 8px rgba(0,0,0,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e55f28', paddingBottom: 8, marginBottom: 12 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>{T.baslik}</div><div style={{ fontSize: 11, color: '#555', whiteSpace: 'pre-line', marginTop: 4 }}>{firma}</div></div>
        <div style={{ textAlign: 'right', fontSize: 11.5 }}><div><b>{T.no}: {no || '—'}</b></div><div>{T.tarih}: {tarih(tarihi)}</div>{gecerlilik && <div>{T.gecerlilik}: {tarih(gecerlilik)}</div>}</div>
      </div>
      <div style={{ fontSize: 12, marginBottom: 10 }}>{T.sayin}: <b>{musteri.split('\n')[0]}</b>{musteri.includes('\n') && <div style={{ whiteSpace: 'pre-line', color: '#444', fontSize: 11 }}>{musteri.split('\n').slice(1).join('\n')}</div>}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={S.th}>#</th><th style={S.th}>{T.urun}</th><th style={{ ...S.th, textAlign: 'right' }}>{T.miktar}</th><th style={S.th}>{T.birim}</th><th style={{ ...S.th, textAlign: 'right' }}>{T.fiyat}</th>{iskVar && <th style={{ ...S.th, textAlign: 'right' }}>{T.isk}</th>}<th style={{ ...S.th, textAlign: 'right' }}>{T.tutar}</th></tr></thead>
        <tbody>{sat.map((k, i) => <tr key={i}><td style={S.td}>{i + 1}</td><td style={S.td}>{k.urun_adi}{k.aciklama && <div style={{ color: '#555', fontSize: 10 }}>{k.aciklama}</div>}</td><td style={{ ...S.td, textAlign: 'right' }}>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(k.miktar)}</td><td style={S.td}>{k.birim}</td><td style={{ ...S.td, textAlign: 'right' }}>{para(k.birim_fiyat, paraBirimi)}</td>{iskVar && <td style={{ ...S.td, textAlign: 'right' }}>{k.iskonto_yuzde ? `%${k.iskonto_yuzde}` : ''}</td>}<td style={{ ...S.td, textAlign: 'right' }}>{para(satirNet(k), paraBirimi)}</td></tr>)}</tbody>
        <tfoot>
          <tr><td colSpan={iskVar ? 6 : 5} style={{ ...S.td, textAlign: 'right' }}>{T.ara}</td><td style={{ ...S.td, textAlign: 'right' }}>{para(s.ara, paraBirimi)}</td></tr>
          <tr><td colSpan={iskVar ? 6 : 5} style={{ ...S.td, textAlign: 'right' }}>{T.kdv} (%{kdvOrani})</td><td style={{ ...S.td, textAlign: 'right' }}>{para(s.kdv, paraBirimi)}</td></tr>
          <tr><td colSpan={iskVar ? 6 : 5} style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{T.toplam}</td><td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{para(s.toplam, paraBirimi)}</td></tr>
        </tfoot>
      </table>
      {kosullar.trim() && <div style={{ marginTop: 12, border: '1px solid #999', padding: 8 }}><div style={{ fontSize: 9.5, color: '#555', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{T.kosul}</div><div style={{ whiteSpace: 'pre-line', fontSize: 11.5 }}>{kosullar}</div></div>}
      {gecerlilik && <div style={{ marginTop: 10, fontSize: 11, color: '#555' }}>{T.gecer}</div>}
      <div style={{ marginTop: 36, display: 'flex', justifyContent: 'flex-end' }}><div style={{ width: 200, borderTop: '1px solid #000', paddingTop: 4, fontSize: 11, textAlign: 'center' }}>{T.imza}</div></div>
    </div>
  )
}
