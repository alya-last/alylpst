'use client'
import { useEffect, useState } from 'react'
import { Lightbulb, ChevronDown, ChevronUp, AlertTriangle, MousePointerClick, ListOrdered, BookOpen, MessageCircle } from 'lucide-react'
import { YARDIM } from '@/lib/yardim-icerik'

/** Sayfanın üstünde "Bu sayfa ne işe yarar?" kutusu: sade anlatım, adım adım, animasyonlu akış, kelime sözlüğü ve seçili sekmenin açıklaması. */
export default function Yardim({ sayfa, sekme }: { sayfa: string; sekme?: string }) {
  const c = YARDIM[sayfa]
  const [acik, setAcik] = useState(true)
  useEffect(() => { try { setAcik(localStorage.getItem('adm-yardim-' + sayfa) !== '0') } catch { /* özel pencere vb. */ } }, [sayfa])
  if (!c) return null
  const ayarla = (v: boolean) => { setAcik(v); try { localStorage.setItem('adm-yardim-' + sayfa, v ? '1' : '0') } catch { /* yoksay */ } }
  const sk = sekme ? c.sekmeler?.[sekme] : undefined
  const n = c.akis?.length || 1

  return (
    <>
      <div className="adm-y">
        <button type="button" className="adm-y-h" onClick={() => ayarla(!acik)} aria-expanded={acik}>
          <span className="adm-y-bulb"><Lightbulb size={16} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{acik ? `Bu sayfa ne işe yarar? — ${c.baslik}` : `Yardım: ${c.baslik} nasıl kullanılır?`}</span>
            {!acik && <span style={{ display: 'block', fontSize: 12, color: 'var(--adm-tx3)', marginTop: 1 }}>Açmak için tıkla</span>}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--adm-tx3)' }}>{acik ? 'Gizle' : 'Göster'}{acik ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        </button>

        {acik && (
          <div className="adm-y-b">
            <p className="adm-y-ozet">{c.ozet}</p>

            {c.akis && (
              <>
                <div className="adm-y-sec"><MousePointerClick size={12} />Nasıl ilerler?</div>
                <div className="adm-y-flow" style={{ ['--adm-y-d' as any]: `${n * 1.5}s` }}>
                  {c.akis.map((a, i) => (
                    <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="adm-y-chip" style={{ animationDelay: `${i * 1.5}s` }}>{a}</span>
                      {i < c.akis!.length - 1 && <span className="adm-y-arrow">→</span>}
                    </span>
                  ))}
                </div>
              </>
            )}

            <div className="adm-y-sec"><ListOrdered size={12} />Adım adım</div>
            {c.adimlar.map((a, i) => (
              <div key={a.t} className="adm-y-step" style={{ animationDelay: `${i * 90}ms` }}>
                <span className="adm-y-num">{i + 1}</span>
                <div><b>{a.t}</b><p>{a.a}</p></div>
              </div>
            ))}

            {c.ornekler && (
              <>
                <div className="adm-y-sec"><MessageCircle size={12} />Şöyle sorabilirsin</div>
                <div>{c.ornekler.map(o => <span key={o} className="adm-y-ornek">{o}</span>)}</div>
              </>
            )}

            {c.dikkat && (
              <div className="adm-y-warn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, marginBottom: 4 }}><AlertTriangle size={14} style={{ color: 'var(--adm-amber)' }} />Dikkat et</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{c.dikkat.map(d => <li key={d}>{d}</li>)}</ul>
              </div>
            )}

            {c.terimler && (
              <>
                <div className="adm-y-sec"><BookOpen size={12} />Bu kelimeler ne demek?</div>
                <div>{c.terimler.map(t => <span key={t.t} className="adm-y-terim" title={t.a}><b>{t.t}:</b> {t.a}</span>)}</div>
              </>
            )}
          </div>
        )}
      </div>

      {sk && (
        <div key={sekme} className="adm-y-sekme">
          <MousePointerClick size={16} style={{ color: 'var(--adm-ac)', flexShrink: 0, marginTop: 1 }} />
          <span><b>Şu an baktığın bölüm: {sk.t}.</b> {sk.a}</span>
        </div>
      )}
    </>
  )
}
