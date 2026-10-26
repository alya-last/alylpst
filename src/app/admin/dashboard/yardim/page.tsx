'use client'
import { useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { Page, PageHead, Card, Badge, SearchBox } from '@/components/admin/erp/ui'
import { CheckCircle2, XCircle, Printer, Sparkles } from 'lucide-react'
import { ILK_GUN, RUTIN, MODULLER, AI_ORNEK, AI_IPUCU, SOZLUK, SORUN, ALTIN } from '@/lib/baslangic-rehberi'

const BOLUMLER = [['ilk', 'İlk gün'], ['rutin', 'Günlük rutin'], ['modul', 'Nasıl yapılır'], ['ai', 'AI Asistan'], ['sozluk', 'Sözlük'], ['sorun', 'Sorun giderme'], ['kural', 'Altın kurallar']] as const

const Adim = ({ n, t, a }: { n: number; t: string; a: string }) => (
  <li style={{ display: 'flex', gap: 12, padding: '9px 0' }}>
    <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 13, background: 'var(--adm-ac)', color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
    <div><div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div><div style={{ fontSize: 13.5, color: 'var(--adm-tx2)', lineHeight: 1.55, marginTop: 2 }}>{a}</div></div>
  </li>
)

export default function YardimPage() {
  const [q, setQ] = useState('')
  const [bolum, setBolum] = useState<string>('ilk')
  const n = q.trim().toLocaleLowerCase('tr')
  const bul = (...m: string[]) => !n || m.join(' ').toLocaleLowerCase('tr').includes(n)
  const moduller = useMemo(() => MODULLER.filter(m => bul(m.baslik, m.menu, m.ne, ...m.adimlar.map(a => a.t + a.a))), [n]) // eslint-disable-line
  const gor = (b: string) => (n ? true : bolum === b)

  return (
    <>
      <AdminTopBar title="Başlangıç Rehberi" />
      <Page maxWidth={980}>
        <PageHead title="Başlangıç Rehberi" sub="Panele yeni başlayanlar için: neyi, nerede, nasıl yaparsın." actions={<button className="adm-btn" onClick={() => window.print()} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Printer size={15} /> Yazdır</button>} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <SearchBox value={q} onChange={setQ} placeholder="Rehberde ara (ör. fatura, stok, tahsilat)" width={320} />
          {!n && BOLUMLER.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setBolum(k)} className="adm-btn" style={{ fontWeight: bolum === k ? 700 : 500, background: bolum === k ? 'var(--adm-ac)' : undefined, color: bolum === k ? '#fff' : undefined }}>{l}</button>
          ))}
        </div>

        {gor('ilk') && bul('ilk gün giriş şifre menü özet asistan', ...ILK_GUN.map(i => i.t + i.a)) && (
          <Card title="İlk gün: bu 6 adımı sırayla yap" pad={16}><ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>{ILK_GUN.map((a, i) => <Adim key={a.t} n={i + 1} t={a.t} a={a.a} />)}</ol></Card>
        )}

        {gor('rutin') && (!n || RUTIN.some(r => bul(r.zaman, ...r.isler))) && (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginTop: n ? 12 : 0 }}>
            {RUTIN.filter(r => bul(r.zaman, ...r.isler)).map(r => (
              <Card key={r.zaman} title={r.zaman} pad={16}><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6, color: 'var(--adm-tx2)' }}>{r.isler.map(i => <li key={i}>{i}</li>)}</ul></Card>
            ))}
          </div>
        )}

        {gor('modul') && moduller.map(m => (
          <div key={m.id} style={{ marginTop: 12 }}>
            <Card title={m.baslik} right={<Badge tone="muted">{m.menu}</Badge>} pad={16}>
              <p style={{ margin: '0 0 6px', fontSize: 14, lineHeight: 1.55 }}>{m.ne}</p>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>{m.adimlar.map((a, i) => <Adim key={a.t} n={i + 1} t={a.t} a={a.a} />)}</ol>
              {m.dikkat && <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--adm-amber-bg, rgba(245,158,11,.1))', fontSize: 13, lineHeight: 1.55 }}><b>Dikkat:</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{m.dikkat.map(d => <li key={d}>{d}</li>)}</ul></div>}
            </Card>
          </div>
        ))}

        {gor('ai') && bul('ai asistan yapay zeka soru ses', ...AI_ORNEK.flatMap(a => a.sorular), ...AI_IPUCU) && (
          <div style={{ marginTop: n ? 12 : 0 }}>
            <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Sparkles size={16} /> {"AI Asistan'a ne sorulur?"}</span>} pad={16}>
              <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6, color: 'var(--adm-tx2)' }}>{AI_IPUCU.map(i => <li key={i}>{i}</li>)}</ul>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
                {AI_ORNEK.map(g => <div key={g.k}><div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{g.k}</div>{g.sorular.map(s => <div key={s} style={{ fontSize: 13, padding: '5px 9px', margin: '3px 0', borderRadius: 8, background: 'var(--adm-bg2, rgba(0,0,0,.04))' }}>“{s}”</div>)}</div>)}
              </div>
            </Card>
          </div>
        )}

        {gor('sozluk') && (
          <div style={{ marginTop: n ? 12 : 0 }}><Card title="Sözlük: sık geçen kelimeler" pad={16}>
            {SOZLUK.filter(s => bul(s.t, s.a)).map(s => <div key={s.t} style={{ padding: '7px 0', borderBottom: '1px solid var(--adm-bd, rgba(0,0,0,.07))', fontSize: 13.5 }}><b>{s.t}:</b> <span style={{ color: 'var(--adm-tx2)' }}>{s.a}</span></div>)}
          </Card></div>
        )}

        {gor('sorun') && (
          <div style={{ marginTop: n ? 12 : 0 }}><Card title="Takılırsan: sık sorunlar" pad={16}>
            {SORUN.filter(s => bul(s.s, s.c)).map(s => <div key={s.s} style={{ padding: '9px 0', borderBottom: '1px solid var(--adm-bd, rgba(0,0,0,.07))' }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.s}</div><div style={{ fontSize: 13.5, color: 'var(--adm-tx2)', marginTop: 2, lineHeight: 1.55 }}>{s.c}</div></div>)}
          </Card></div>
        )}

        {gor('kural') && (
          <div style={{ marginTop: n ? 12 : 0 }}><Card title="Altın kurallar" pad={16}>
            {ALTIN.map(k => <div key={k.m} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', fontSize: 14 }}>{k.y ? <CheckCircle2 size={18} color="var(--adm-green, #16a34a)" /> : <XCircle size={18} color="var(--adm-red, #dc2626)" />}{k.m}</div>)}
          </Card></div>
        )}
      </Page>
    </>
  )
}
