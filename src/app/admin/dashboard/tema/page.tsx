'use client'
import { useEffect, useState } from 'react'
import { web } from '@/lib/web-data'
import { aiIstek } from '@/lib/ai-client'
import AdminTopBar from '@/components/admin/TopBar'
import { Modal, useToast } from '@/components/admin/erp/ui'
import { IMG, TEMA_ALANLARI, resolveImg } from '@/data/images'
import { Wand2, RotateCcw, Undo2, Palette, Gauge } from 'lucide-react'

const GORSEL_STIL = { studyo: 'Stüdyo', yasam: 'Yaşam alanı' } as const
type GorselStil = keyof typeof GORSEL_STIL

// Depoda hâlihazırda duran, sıkıştırılmamış (>~220KB) AI görselleri — bkz. `gorsel_toplu_sikistir`
// admin eylemi. Yeni üretilen görseller zaten sıkıştırılmış kaydediliyor; bu liste yalnızca geçmiş
// stoğu bir kerelik temizlemek içindir.
const SIKISTIRILACAK_YOLLAR: string[] = [
  "renkler/a990f35f-b616-479a-b491-d7ea86628983/varyant-b4b56296-e4b1-4fcb-8ae1-8cc8cee3f603-1790604921868.png",
  "61104650-a2cc-4e57-8bc5-b19f490dbf51/1790599070623.png",
  "bd0752ec-7a04-4fef-be95-fb7055b8366e/1790599051202.png",
  "e9e0ee3d-3c05-49d2-b08c-de05c6f0380a/1790599088589.png",
  "renkler/a990f35f-b616-479a-b491-d7ea86628983/varyant-da5580b6-6a5d-4086-bdcb-09848d928a32-1790604929766.png",
  "c715f965-e024-4537-bb22-644a344faf3b/1790599098886.png",
  "renkler/a990f35f-b616-479a-b491-d7ea86628983/varyant-563089e1-630b-498b-b408-f25b90a09e6a-1790604890389.png",
  "renkler/44dcd537-1fed-4532-8f5e-1719c610a134/varyant-9797bbbd-6cba-455a-80d6-4de412a73e8e-1790604945247.png",
  "2748c071-1e38-43d0-bc30-ba8e86e25972/1790599056963.png",
  "renkler/44dcd537-1fed-4532-8f5e-1719c610a134/varyant-a792d8b4-2089-460a-b573-c70d398682a0-1790604980939.png",
  "renkler/8b287240-2941-46d8-bdfd-db73edb4fd58/varyant-20f04f61-3bde-46fa-9d74-537b8945d0eb-1790678515624.png",
  "renkler/25686cfc-1359-4a27-b479-1dc04afef371/varyant-2ac0d378-b447-4a4b-8ba6-3f48db2c036a-1790605054192.png",
  "44dcd537-1fed-4532-8f5e-1719c610a134/1790525707578.png",
  "renkler/44dcd537-1fed-4532-8f5e-1719c610a134/varyant-46ae88ea-d77a-4f40-a992-c928a52e6c31-1790604939527.png",
  "2c649073-a39c-43b6-87d2-1a139a89224c/1790599075931.png",
  "renkler/44dcd537-1fed-4532-8f5e-1719c610a134/varyant-46ae88ea-d77a-4f40-a992-c928a52e6c31-1790679064469.png",
  "renkler/a990f35f-b616-479a-b491-d7ea86628983/varyant-aaa9460d-5c4d-4302-a4ed-af961d6fa867-1790604904219.png",
  "renkler/44dcd537-1fed-4532-8f5e-1719c610a134/varyant-5384d8b6-b7f9-4195-ac81-97f605dc90fc-1790604973757.png",
  "renkler/8b287240-2941-46d8-bdfd-db73edb4fd58/varyant-f04e6e57-9adc-46f2-8591-0a3b7ab3c49f-1790605079629.png",
  "renkler/44dcd537-1fed-4532-8f5e-1719c610a134/varyant-cee0572f-af05-4ad5-9c12-e276c876d7aa-1790604965331.png",
  "tema/d3/1790528029203.png",
  "renkler/f09d2c1f-2e86-4e19-978b-79d18cac52f0/varyant-865d4344-2f1c-4dc9-a647-cf4336b4e527-1790605008808.png",
  "tema/venusAsk/1790528088874.png",
  "renkler/f09d2c1f-2e86-4e19-978b-79d18cac52f0/varyant-9b1dfa0b-66b0-4afd-b60e-aba5c253e132-1790605014551.png",
  "44dcd537-1fed-4532-8f5e-1719c610a134/1790527362252.png",
  "8b287240-2941-46d8-bdfd-db73edb4fd58/1790527387849.png",
  "f9c38ef8-9dea-447a-828c-f94986fe973d/1790527376007.png",
  "renkler/44dcd537-1fed-4532-8f5e-1719c610a134/varyant-faf7a464-51ec-4024-9735-98d20a0fe71a-1790604959553.png",
  "renkler/a990f35f-b616-479a-b491-d7ea86628983/varyant-c6db5407-9f9d-42ad-982d-ac36b1c70291-1790604896968.png",
  "25686cfc-1359-4a27-b479-1dc04afef371/1790527404229.png",
  "renkler/25686cfc-1359-4a27-b479-1dc04afef371/varyant-5c720c83-5817-449e-a39d-9b54d23f78d5-1790605072852.png",
  "renkler/f09d2c1f-2e86-4e19-978b-79d18cac52f0/varyant-7620fe6b-dc6d-47f3-891a-a246055e3369-1790604987456.png",
  "4fb43d0b-5488-4b13-875d-c7969fe68978/1790527399471.png",
  "renkler/4fb43d0b-5488-4b13-875d-c7969fe68978/varyant-eabdd0c9-168a-421d-9ace-4846db554ad4-1790605019895.png",
  "renkler/25686cfc-1359-4a27-b479-1dc04afef371/varyant-37158a20-abf5-4cef-b894-bd32649ea84b-1790605066319.png",
  "renkler/25686cfc-1359-4a27-b479-1dc04afef371/varyant-48a12c05-ca4d-42c9-a035-b1391e55f5ba-1790605059614.png",
  "2f88f35f-eaf9-4f20-a41d-485f5d7a293a/1790524769348.png",
  "4bcecf2a-e57f-4590-a25f-108d6854bade/1790599092678.png",
  "renkler/f09d2c1f-2e86-4e19-978b-79d18cac52f0/varyant-161de460-e475-4a2b-95d6-a489cd489d0d-1790604994438.png",
  "renkler/4fb43d0b-5488-4b13-875d-c7969fe68978/varyant-24b2637b-1aa6-42f2-8d8e-59b59f313c77-1790605025143.png",
  "renkler/a990f35f-b616-479a-b491-d7ea86628983/varyant-6a5d11a5-bf15-42d2-a1bf-bd352ccdbd4c-1790604915033.png",
  "renkler/8b287240-2941-46d8-bdfd-db73edb4fd58/varyant-760eabef-d283-48e2-98f4-44c4b1481795-1790605085623.png",
  "renkler/057d9e2a-e24f-4f9c-8702-37c24cf8267e/varyant-9445a089-61f8-4e60-912c-ba667c6a2ee1-1790678543716.png",
  "renkler/2f88f35f-eaf9-4f20-a41d-485f5d7a293a/varyant-77b9b20a-866a-4f14-9489-e56c3f705718-1790679155889.png",
  "renkler/f09d2c1f-2e86-4e19-978b-79d18cac52f0/varyant-f5b5e4e3-bd43-4b31-b90b-d6953dec1fdb-1790605000948.png",
  "f09d2c1f-2e86-4e19-978b-79d18cac52f0/1790527382105.png",
  "renkler/2f88f35f-eaf9-4f20-a41d-485f5d7a293a/varyant-71e63845-ac6d-49a2-9eef-80124f2d8558-1790678977971.png",
  "5ef9b8dd-bd16-4585-b604-23759f1ff990/1790599044392.png",
  "057d9e2a-e24f-4f9c-8702-37c24cf8267e/1790527369354.png",
  "renkler/2f88f35f-eaf9-4f20-a41d-485f5d7a293a/varyant-849f10ab-987b-469b-bcc6-7f4af5680840-1790678986577.png",
  "renkler/4fb43d0b-5488-4b13-875d-c7969fe68978/varyant-e1c4ebc0-653f-4943-a8c9-f2781c1526c3-1790605042565.png",
  "renkler/057d9e2a-e24f-4f9c-8702-37c24cf8267e/varyant-c80487b7-b924-42e9-a2a4-e3a69d0469a5-1790678969683.png",
  "renkler/917af7df-19da-4e85-81b3-e0e26294840a/varyant-d7cb4c5e-65ba-4f6f-a1bc-6db548224deb-1790678097603.png",
  "renkler/4fb43d0b-5488-4b13-875d-c7969fe68978/varyant-261a4d27-6fad-4a3a-abba-d432d4923e3f-1790605032289.png",
  "tema/fikir/1790527824319.png",
  "0e6af8fd-f1e2-4811-9df8-32fee011b6e6/1790599081733.png",
  "renkler/057d9e2a-e24f-4f9c-8702-37c24cf8267e/varyant-b4730ef5-8f5b-48a6-bc9a-f69593d8f4b8-1790678534507.png",
  "renkler/2f88f35f-eaf9-4f20-a41d-485f5d7a293a/varyant-41fdedca-a62b-46df-9514-cf2409720f72-1790678056892.png",
  "tema/kordon/1790528232838.png",
  "renkler/ffe4d1c0-b971-4198-816d-4d17aa645981/varyant-fe074d0a-00c7-49ec-a98b-2df35fa48405-1790678148999.png",
  "2cdbe242-b463-444c-96e5-b01d3f5e16e1/1790599062632.png",
  "tema/hero2/1790528769900.png",
  "a990f35f-b616-479a-b491-d7ea86628983/1790525574130.png",
  "renkler/4fb43d0b-5488-4b13-875d-c7969fe68978/varyant-f2e9fd55-e97f-43fa-b99c-7b42d8a1e8bc-1790605047712.png",
  "renkler/4fb43d0b-5488-4b13-875d-c7969fe68978/varyant-d66eeb71-f5d4-4db1-93a0-894e8e9d2af6-1790605037106.png",
  "renkler/917af7df-19da-4e85-81b3-e0e26294840a/varyant-d7150c44-1acf-4b06-8269-448092913205-1790678083581.png",
  "c4218df6-a447-4164-b5ca-6e94bc103b72/1790527393536.png",
  "renkler/057d9e2a-e24f-4f9c-8702-37c24cf8267e/varyant-841c7cb3-ace5-4d28-8828-ca0f0e86bb6a-1790678527148.png",
  "ffe4d1c0-b971-4198-816d-4d17aa645981/1790527419121.png",
  "renkler/ffe4d1c0-b971-4198-816d-4d17aa645981/varyant-cc3d6241-abe2-47c1-9ee5-58652d94861d-1790678121330.png",
  "renkler/ffe4d1c0-b971-4198-816d-4d17aa645981/varyant-da4a64b0-8817-4b8a-80a2-2d6d51755f18-1790678111411.png",
  "renkler/917af7df-19da-4e85-81b3-e0e26294840a/varyant-df9693f3-4c38-4671-8516-04b18ac47579-1790678067258.png",
  "a990f35f-b616-479a-b491-d7ea86628983/1790527347759.png",
  "917af7df-19da-4e85-81b3-e0e26294840a/1790527411432.png",
  "tema/kordon/1790528135975.png",
  "renkler/917af7df-19da-4e85-81b3-e0e26294840a/varyant-a8b436cd-317d-4a7d-aafd-f81778ecf913-1790678074723.png",
  "renkler/ffe4d1c0-b971-4198-816d-4d17aa645981/varyant-63182948-4b1b-4ab1-b47f-68be176f5f2a-1790678136973.png",
  "2f88f35f-eaf9-4f20-a41d-485f5d7a293a/1790527354198.png",
  "tema/dantel/1790527954856.png",
  "tema/ufo/1790527881493.png",
  "renkler/depolama-sandigi/CAEAFF.png",
  "renkler/depolama-sandigi/FFC6C6.png",
  "renkler/depolama-sandigi/8E7CC3.png",
  "renkler/depolama-sandigi/F5F5F5.png",
  "renkler/venus-saksi/CE7E00.png",
];

export default function TemaYonetimiPage() {
  const toast = useToast()
  const [override, setOverride] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [ai, setAi] = useState<{ alan: string; stil: GorselStil; b64: string | null; busy: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [sikistirma, setSikistirma] = useState<{ calisiyor: boolean; islenen: number; toplam: number; eskiMB: number; yeniMB: number; hata: number; bitti: boolean } | null>(null)

  async function gorselleriSikistir() {
    const yollar = SIKISTIRILACAK_YOLLAR
    setSikistirma({ calisiyor: true, islenen: 0, toplam: yollar.length, eskiMB: 0, yeniMB: 0, hata: 0, bitti: false })
    let islenen = 0, eskiToplam = 0, yeniToplam = 0, hataSayisi = 0
    for (let i = 0; i < yollar.length; i += 12) {
      const parca = yollar.slice(i, i + 12)
      try {
        const r: any = await aiIstek('gorsel_toplu_sikistir', { yollar: parca })
        for (const s of r.sonuclar || []) {
          islenen++
          if (s.hata) hataSayisi++
          else { eskiToplam += s.eski || 0; yeniToplam += s.yeni ?? s.eski ?? 0 }
        }
      } catch (e: any) {
        hataSayisi += parca.length; islenen += parca.length
      }
      setSikistirma({ calisiyor: true, islenen, toplam: yollar.length, eskiMB: eskiToplam / 1048576, yeniMB: yeniToplam / 1048576, hata: hataSayisi, bitti: false })
    }
    setSikistirma(s => s && { ...s, calisiyor: false, bitti: true })
  }

  useEffect(() => {
    web.from('settings').select('value').eq('key', 'tema_gorselleri').maybeSingle().then(({ data }) => {
      setOverride(data?.value || {}); setLoading(false)
    })
  }, [])

  const img = resolveImg(override)

  async function uret(stil: GorselStil) {
    if (!ai) return
    setAi(a => a && { ...a, stil, b64: null, busy: true })
    try {
      const kaynak = img[ai.alan as keyof typeof IMG]
      const r: any = await aiIstek('urun_gorsel_tasarim', { url: kaynak, stil })
      setAi(a => a && { ...a, b64: r.b64, busy: false })
    } catch (e: any) { toast.show(e.message, true); setAi(a => a && { ...a, busy: false }) }
  }
  async function kullan() {
    if (!ai?.b64) return
    setBusy(true)
    try {
      const r: any = await aiIstek('tema_gorsel_yukle', { alan: ai.alan, b64: ai.b64 })
      const yeni = { ...override, [ai.alan]: r.url }
      const { error } = await web.from('settings').upsert({ key: 'tema_gorselleri', value: yeni })
      if (error) throw new Error(error.message)
      setOverride(yeni); setAi(null); toast.show('Tema görseli güncellendi — anasayfada birkaç dakika içinde görünecek')
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }
  async function sifirla(alan: string) {
    if (!override[alan]) return
    setBusy(true)
    try {
      const yeni = { ...override }; delete yeni[alan]
      const { error } = await web.from('settings').upsert({ key: 'tema_gorselleri', value: yeni })
      if (error) throw new Error(error.message)
      setOverride(yeni); toast.show('Varsayılan görsele döndürüldü')
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Tema Yönetimi" />
      <div style={{ padding: 24, maxWidth: 980 }}>
        <div className="adm-card" style={{ marginBottom: 18, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Palette size={16} style={{ color: 'var(--adm-ac)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', lineHeight: 1.6, margin: 0 }}>
            Anasayfada sabit olarak kullanılan vitrin/dekoratif fotoğrafları burada AI ile yeniden tasarlayabilirsin (yalnızca arka plan/stil değişir, ürünün kendisi değişmez).
            Bu, logo, renk paleti veya sayfa düzeni gibi markanın kod tarafını <b>değiştirmez</b> — sadece bu fotoğrafların hangi görsel olduğunu değiştirir. Her alan için ayrı ayrı önizleyip onaylarsın; onaylamazsan hiçbir şey değişmez.
          </p>
        </div>

        <div className="adm-card" style={{ marginBottom: 18, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Gauge size={16} style={{ color: 'var(--adm-ac)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', lineHeight: 1.6, margin: '0 0 10px' }}>
              Sitede daha önce üretilmiş <b>{SIKISTIRILACAK_YOLLAR.length} görsel</b> sıkıştırılmamış (~1MB+) kaydedilmiş — bu, sayfaların yavaş açılmasının ana sebebi.
              Aşağıdaki buton bunları aynı adreste kalitesi bozulmadan WebP'ye çevirip küçültür (site hızını ciddi şekilde artırır). Yeni üretilen görseller zaten otomatik sıkıştırılıyor.
            </p>
            {sikistirma ? (
              <div style={{ fontSize: 12, color: 'var(--adm-tx2)' }}>
                <div style={{ height: 6, background: 'var(--adm-s2)', borderRadius: 999, overflow: 'hidden', marginBottom: 8, maxWidth: 320 }}>
                  <div style={{ height: '100%', width: `${(sikistirma.islenen / sikistirma.toplam) * 100}%`, background: 'var(--adm-ac)', transition: 'width .3s' }} />
                </div>
                {sikistirma.islenen}/{sikistirma.toplam} işlendi
                {sikistirma.yeniMB > 0 && <> — {sikistirma.eskiMB.toFixed(1)}MB → {sikistirma.yeniMB.toFixed(1)}MB</>}
                {sikistirma.hata > 0 && <span style={{ color: 'var(--adm-red)' }}> · {sikistirma.hata} hata</span>}
                {sikistirma.bitti && <span style={{ color: 'var(--adm-green)', fontWeight: 600 }}> · Tamamlandı ✓</span>}
              </div>
            ) : (
              <button className="adm-btn" style={{ fontSize: 12 }} onClick={gorselleriSikistir}><Gauge size={13} />Görselleri Sıkıştır</button>
            )}
          </div>
        </div>

        {loading ? <p style={{ fontSize: 13, color: 'var(--adm-tx3)' }}>Yükleniyor…</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {TEMA_ALANLARI.map(a => (
              <div key={a.key} className="adm-card" style={{ overflow: 'hidden' }}>
                <div style={{ aspectRatio: '16/10', background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img[a.key]} alt={a.ad} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{a.ad}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginBottom: 10, lineHeight: 1.5 }}>{a.aciklama}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="adm-btn-ghost" style={{ fontSize: 12, flex: 1, justifyContent: 'center' }} disabled={busy} onClick={() => setAi({ alan: a.key, stil: 'studyo', b64: null, busy: false })}><Wand2 size={12} />AI ile Yeniden Tasarla</button>
                    {override[a.key] && <button className="adm-btn-ghost" title="Varsayılana döndür" style={{ fontSize: 12, padding: '6px 8px' }} disabled={busy} onClick={() => sifirla(a.key)}><Undo2 size={12} /></button>}
                  </div>
                  {override[a.key] && <div style={{ fontSize: 10.5, color: 'var(--adm-green)', marginTop: 6 }}>Özelleştirildi</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!ai} onClose={() => setAi(null)} width={640} title={`AI ile Yeniden Tasarla — ${TEMA_ALANLARI.find(a => a.key === ai?.alan)?.ad || ''}`}
        footer={<>
          <button type="button" className="adm-btn-ghost" onClick={() => setAi(null)}>{ai?.b64 ? 'Vazgeç' : 'İptal'}</button>
          {ai?.b64 && <button type="button" className="adm-btn-ghost" disabled={ai.busy} onClick={() => uret(ai.stil)}><RotateCcw size={13} />Tekrar Dene</button>}
          {ai?.b64 ? <button type="button" className="adm-btn" disabled={busy} onClick={kullan}>{busy ? 'Kaydediliyor…' : 'Bu Görseli Kullan'}</button>
            : <button type="button" className="adm-btn" disabled={ai?.busy} onClick={() => uret(ai!.stil)}><Wand2 size={13} />{ai?.busy ? 'Oluşturuluyor…' : 'Oluştur'}</button>}
        </>}>
        <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 12px' }}>Sonucu onaylarsan bu alan için kullanılır; onaylamazsan mevcut görsel değişmeden kalır.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(Object.keys(GORSEL_STIL) as GorselStil[]).map(s => (
            <button key={s} type="button" className={ai?.stil === s ? 'adm-chip on' : 'adm-chip'} disabled={ai?.busy} onClick={() => setAi(f => f && { ...f, stil: s, b64: null })}>{GORSEL_STIL[s]}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginBottom: 6 }}>Mevcut</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {ai && <img src={img[ai.alan as keyof typeof IMG]} alt="" style={{ width: 220, height: 140, objectFit: 'cover', borderRadius: 12, background: 'var(--adm-s2)' }} />}
          </div>
          <div style={{ fontSize: 20, color: 'var(--adm-tx3)' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginBottom: 6 }}>AI önerisi</div>
            {ai?.busy ? <div style={{ width: 220, height: 140, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--adm-tx3)' }}>Oluşturuluyor…</div>
              : ai?.b64 ? <img src={`data:image/png;base64,${ai.b64}`} alt="" style={{ width: 220, height: 140, objectFit: 'cover', borderRadius: 12, background: 'var(--adm-s2)' }} />
              : <div style={{ width: 220, height: 140, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wand2 size={22} style={{ color: 'var(--adm-tx3)' }} /></div>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
