'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Volume2, Loader2, Headphones } from 'lucide-react'

// Eller serbest sesli asistan (OpenAI Realtime, WebRTC): "başlat"a bir kez basılır, sonrası normal konuşma —
// bas-konuş yok; model konuşmayı kendisi algılar, sözü kesilebilir. Araç çağrıları sunucuda kullanıcının yetkisiyle çalışır.
type Durum = 'kapali' | 'baglaniyor' | 'dinliyor' | 'dusunuyor' | 'konusuyor'
type Satir = { rol: 'user' | 'assistant'; metin: string; excel?: string }
type Bilgi = { aktif: boolean; birimler: { k: string; ad: string }[]; varsayilan: string }

const DURUM_YAZI: Record<Durum, string> = { kapali: 'Kapalı', baglaniyor: 'Bağlanıyor…', dinliyor: 'Sizi dinliyorum', dusunuyor: 'Düşünüyor…', konusuyor: 'Konuşuyor' }

export default function SesliAsistan({ birim: sabitBirim, baslik = 'Sesli Asistan' }: { birim?: string; baslik?: string }) {
  const [bilgi, setBilgi] = useState<Bilgi | null>(null)
  const [birim, setBirim] = useState(sabitBirim || '')
  const [durum, setDurum] = useState<Durum>('kapali')
  const [satirlar, setSatirlar] = useState<Satir[]>([])
  const [hata, setHata] = useState('')
  const [sessiz, setSessiz] = useState(false)
  const [kalite, setKalite] = useState<'yuksek' | 'ekonomik'>('yuksek')
  useEffect(() => { try { const k = localStorage.getItem('ses_kalite'); if (k === 'yuksek' || k === 'ekonomik') setKalite(k) } catch { /* */ } }, [])
  const R = useRef<{ pc?: RTCPeerConnection; dc?: RTCDataChannel; stream?: MediaStream; audio?: HTMLAudioElement; timer?: any; basla?: number; son?: number; oturum?: string | null; arac: number; bekleyen: number; maxSn: number; bosSn: number; birim: string }>({ arac: 0, bekleyen: 0, maxSn: 600, bosSn: 90, birim: '' })
  const alt = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/admin/ses').then(r => r.ok ? r.json() : null).then((b: Bilgi | null) => {
      if (!b) return
      setBilgi(b)
      setBirim(sabitBirim && b.birimler.some(x => x.k === sabitBirim) ? sabitBirim : b.varsayilan)
    }).catch(() => {})
  }, [sabitBirim])
  useEffect(() => { alt.current?.scrollIntoView({ behavior: 'smooth' }) }, [satirlar])

  const gonder = (o: unknown) => { const dc = R.current.dc; if (dc?.readyState === 'open') dc.send(JSON.stringify(o)) }

  const durdur = useCallback(async (neden?: string) => {
    const r = R.current
    if (r.timer) { clearInterval(r.timer); r.timer = undefined }
    try { r.dc?.close() } catch { /* */ }
    try { r.pc?.close() } catch { /* */ }
    r.stream?.getTracks().forEach(t => t.stop())
    if (r.audio) { r.audio.srcObject = null }
    const sure = r.basla ? Math.round((Date.now() - r.basla) / 1000) : 0
    if (r.oturum) fetch('/api/admin/ses/bitir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oturum_id: r.oturum, sure_sn: sure, arac_sayisi: r.arac }), keepalive: true }).catch(() => {})
    R.current = { arac: 0, bekleyen: 0, maxSn: 600, bosSn: 90, birim: '' }
    setDurum('kapali'); setSessiz(false)
    if (neden) setHata(neden)
  }, [])
  useEffect(() => () => { if (R.current.pc) durdur() }, [durdur])
  useEffect(() => { const f = () => { if (R.current.pc) durdur() }; window.addEventListener('pagehide', f); return () => window.removeEventListener('pagehide', f) }, [durdur])

  async function aracCalistir(item: any) {
    const r = R.current
    r.bekleyen++; r.arac++
    let sonuc = 'HATA: araç çalıştırılamadı'
    try {
      const res = await fetch('/api/admin/ses/arac', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birim: r.birim, ad: item.name, args: item.arguments }) })
      const j = await res.json().catch(() => ({})); sonuc = String(j.sonuc || j.error || sonuc)
    } catch { /* ağ hatası */ }
    r.bekleyen--
    const xl = /\/api\/admin\/ai-excel\?id=[0-9a-f-]{36}/i.exec(sonuc)
    if (xl) setSatirlar(s => [...s, { rol: 'assistant', metin: 'Excel dosyası hazır', excel: xl[0] }])
    gonder({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output: sonuc.slice(0, 12000) } })
    if (r.bekleyen === 0) gonder({ type: 'response.create' })
  }

  function olay(e: MessageEvent) {
    let m: any; try { m = JSON.parse(e.data) } catch { return }
    const r = R.current; r.son = Date.now()
    switch (m.type) {
      case 'input_audio_buffer.speech_started': setDurum('dinliyor'); break
      case 'input_audio_buffer.speech_stopped': setDurum('dusunuyor'); break
      case 'response.created': setDurum('dusunuyor'); break
      case 'output_audio_buffer.started': setDurum('konusuyor'); break
      case 'output_audio_buffer.stopped': case 'output_audio_buffer.cleared': setDurum('dinliyor'); break
      case 'conversation.item.input_audio_transcription.completed': if (m.transcript?.trim()) setSatirlar(s => [...s, { rol: 'user', metin: m.transcript.trim() }]); break
      case 'response.output_audio_transcript.done': if (m.transcript?.trim()) setSatirlar(s => [...s, { rol: 'assistant', metin: m.transcript.trim() }]); break
      case 'response.output_item.done': if (m.item?.type === 'function_call' && m.item.call_id) aracCalistir(m.item); break
      case 'response.done': if (m.response?.status === 'failed') setHata('Asistan yanıt üretemedi, tekrar deneyin.'); if (!r.bekleyen) setDurum(d => (d === 'konusuyor' ? d : 'dinliyor')); break
      case 'error': setHata(String(m.error?.message || 'Bağlantı hatası').slice(0, 160)); break
    }
  }

  async function baslat() {
    if (durum !== 'kapali') return
    setHata(''); setSatirlar([]); setDurum('baglaniyor')
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') throw new Error('Bu tarayıcı sesli görüşmeyi desteklemiyor.')
      const res = await fetch('/api/admin/ses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birim, kalite }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Sesli asistan başlatılamadı.')
      R.current.oturum = j.oturum_id; R.current.basla = Date.now()   // sonraki adım (mikrofon vb.) başarısız olsa da oturum kaydı kapatılır
      let stream: MediaStream
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }) }
      catch (e: any) { throw new Error(e?.name === 'NotFoundError' ? 'Mikrofon bulunamadı. Bir mikrofon/kulaklık bağlayıp tekrar deneyin.' : e?.name === 'NotReadableError' ? 'Mikrofon başka bir uygulama tarafından kullanılıyor.' : 'Mikrofon izni verilmedi. Tarayıcı adres çubuğundan mikrofona izin verin.') }
      const pc = new RTCPeerConnection()
      const audio = new Audio(); audio.autoplay = true
      pc.ontrack = ev => { audio.srcObject = ev.streams[0] }
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      const dc = pc.createDataChannel('oai-events')
      const r = R.current
      Object.assign(r, { pc, dc, stream, audio, basla: Date.now(), son: Date.now(), oturum: j.oturum_id, arac: 0, bekleyen: 0, maxSn: j.maxSn || 600, bosSn: j.bosSn || 90, birim: j.birim || birim })
      dc.onmessage = olay
      dc.onopen = () => { setDurum('dinliyor'); gonder({ type: 'response.create', response: { instructions: 'Kendini "Ben Alya" diye kısaca tanıtarak kullanıcıyı bir cümleyle selamla ve nasıl yardımcı olabileceğini sor.' } }) }
      pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && R.current.pc === pc) durdur('Bağlantı koptu.') }
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer)
      const sdp = await fetch(j.sdpUrl, { method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${j.token}`, 'Content-Type': 'application/sdp' } })
      if (!sdp.ok) throw new Error('Sesli bağlantı kurulamadı (' + sdp.status + ').')
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() })
      r.timer = setInterval(() => {
        const s = R.current; if (!s.basla) return
        if ((Date.now() - s.basla) / 1000 > s.maxSn) durdur('Süre doldu (en fazla ' + Math.round(s.maxSn / 60) + ' dk). Yeniden başlatabilirsiniz.')
        else if ((Date.now() - (s.son || s.basla)) / 1000 > s.bosSn) durdur('Uzun süre konuşulmadığı için görüşme kapatıldı.')
      }, 5000)
    } catch (err: any) { await durdur(err?.message || 'Sesli asistan başlatılamadı.') }
  }

  function sessizeAl() { const t = R.current.stream?.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; setSessiz(!t.enabled) }

  if (!bilgi || !bilgi.aktif) return null
  if (sabitBirim && !bilgi.birimler.some(x => x.k === sabitBirim)) return null   // bu birime yetkisi yok
  const acik = durum !== 'kapali'
  const renk = durum === 'konusuyor' ? 'var(--adm-green)' : durum === 'dinliyor' ? 'var(--adm-ac)' : 'var(--adm-tx3)'
  return (
    <div className="adm-card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: acik ? renk : 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: acik ? '#fff' : 'var(--adm-tx3)', transition: 'background .2s', boxShadow: durum === 'konusuyor' || durum === 'dinliyor' ? `0 0 0 6px color-mix(in srgb, ${renk} 22%, transparent)` : undefined }}>
          {durum === 'baglaniyor' || durum === 'dusunuyor' ? <Loader2 size={18} className="spin" /> : durum === 'konusuyor' ? <Volume2 size={18} /> : <Headphones size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{baslik}</div>
          <div style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>{acik ? DURUM_YAZI[durum] + (sessiz ? ' · mikrofon kapalı' : '') : 'Bir kez başlatın, sonra normal konuşun — bas-konuş yok; sözünüzü kesebilirsiniz. En iyi tanıma için kulaklık/mikrofonlu kulaklık kullanın.'}</div>
        </div>
        {!sabitBirim && bilgi.birimler.length > 1 && <select className="adm-sel" disabled={acik} value={birim} onChange={e => setBirim(e.target.value)}>{bilgi.birimler.map(b => <option key={b.k} value={b.k}>{b.ad}</option>)}</select>}
        <select className="adm-sel" disabled={acik} value={kalite} title="Anlama kalitesi" onChange={e => { const k = e.target.value as 'yuksek' | 'ekonomik'; setKalite(k); try { localStorage.setItem('ses_kalite', k) } catch { /* */ } }}><option value="yuksek">Yüksek doğruluk</option><option value="ekonomik">Ekonomik</option></select>
        {acik && <button className="adm-btn-ghost" onClick={sessizeAl} title="Mikrofonu sessize al" disabled={durum === 'baglaniyor'}>{sessiz ? <MicOff size={14} /> : <Mic size={14} />}{sessiz ? 'Sesi aç' : 'Sessize al'}</button>}
        {acik ? <button className="adm-btn-danger" onClick={() => durdur()}><PhoneOff size={14} />Bitir</button> : <button className="adm-btn" onClick={baslat}><Mic size={14} />Sesli sohbeti başlat</button>}
      </div>
      {hata && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--adm-red)' }}>{hata}</p>}
      {satirlar.length > 0 && (
        <div style={{ marginTop: 12, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {satirlar.map((s, i) => <div key={i} style={{ alignSelf: s.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '7px 11px', borderRadius: 10, fontSize: 13, lineHeight: 1.5, background: s.rol === 'user' ? 'var(--adm-ac2)' : 'var(--adm-s2)' }}>{s.metin}{s.excel && <div style={{ marginTop: 6 }}><a className="adm-btn" style={{ textDecoration: 'none', display: 'inline-flex' }} href={s.excel}>Excel indir</a></div>}</div>)}
          <div ref={alt} />
        </div>
      )}
      <style>{`.spin{animation:sesspin 1s linear infinite}@keyframes sesspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
