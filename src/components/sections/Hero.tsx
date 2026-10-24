import type { Stats, Settings } from "@/lib/supabase";
import { IMG } from "@/data/images";
import { kurumsalYolu, type Dil } from "@/lib/diller";
import { M } from "@/lib/site-metin";

export default function Hero({ stats, settings, dil = "tr", img = IMG }: { stats: Stats | null; settings: Settings | null; dil?: Dil; img?: typeof IMG }) {
  const h = M[dil].hero;
  const st = [
    { n: stats?.years ?? 55,     s: "+", l: h.yil   },
    { n: stats?.models ?? 200,   s: "+", l: h.model   },
    { n: stats?.countries ?? 20, s: "+", l: h.ulke },
  ];

  return (
    <section id="hero" className="relative grain overflow-hidden bg-[#eae6dd] min-h-[88svh] md:min-h-svh grid grid-cols-1 md:grid-cols-2"
      data-bg="#eae6dd"
      >

      {/* ── Sol: İçerik ────────────────────────────────── */}
      {/* Mobilde (tek sütun, sağ görsel sütunu yok) justify-end + tam ekran yükseklik header
          ile başlık arasında büyük, boş bir alan bırakıyordu — mobilde içerik dikeyde
          ortalanır, md+ üzerinde (yanında ürün görseli olduğu için) alta yaslı kalır. */}
      <div className="relative z-10 flex flex-col justify-center md:justify-end"
        style={{ paddingInline: "clamp(20px,5vw,80px)", paddingBottom: "clamp(48px,8vh,100px)", paddingTop: 100 }}>

        {/* BG sadece sola */}
        <div className="js-hero-bg absolute inset-0 origin-center" style={{ transform: "scale(1.06)", willChange: "transform" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.fikir} alt={h.alt}
            className="absolute inset-0 w-full h-full object-cover opacity-[0.09] hidden md:block"
            style={{ objectPosition: "30% center" }} />
          <div className="absolute inset-0 hidden md:block"
            style={{ background: "linear-gradient(to right, rgba(234,230,221,0.97) 0%, rgba(234,230,221,0.88) 100%)" }} />
        </div>

        {/* Turuncu dikey çizgi - sol kenar */}
        <div className="anim-line-expand absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: "linear-gradient(to bottom, transparent 0%, #e55f28 20%, #e55f28 80%, transparent 100%)" }} />

        {/* Overline */}
        <div className="anim-hero-sub flex items-center gap-3 mb-7 relative z-10">
          <div className="w-8 h-px bg-[#e55f28]" />
          <span className="eyebrow text-[#e55f28] tracking-[0.25em]">
            {h.since(settings?.founded ?? 1968)}
          </span>
        </div>

        {/* Ana başlık — maskeli reveal */}
        <div className="relative z-10 mb-10">
          {/* Başlık boyutu: mobilde (tek sütun) tam genişlik var, 8vw güvenli. md+ (768px) itibariyle
              sağ görsel sütunu genişliğin yarısını alıyor — aynı 8vw oranı burada uzun kelimeleri
              (ör. "ENJEKSİYONLA") taşırıp overflow-hidden sarmalayıcı tarafından kırpılmasına yol
              açıyordu. md: için sütun genişliğine göre ölçeklenen ayrı, daha küçük bir clamp kullanılır.
              (Not: inline style yerine Tailwind sınıfı kullanılıyor — inline style medya sorgusu
              içeren bir sınıfça ASLA ezilemez, bkz. Hero grid-template-columns geçmişi.) */}
          {/* lineHeight: .heading sınıfının sıkı 0.9 satır yüksekliği, Ö/Ü/İ gibi Türkçe büyük harf
              noktalarının üstünü bu statik overflow-hidden maskesiyle kırpıyordu (GSAP'in dinamik
              SplitText maskesini kullanan diğer başlıkların aksine burada satır yüksekliği sabit).
              1.08 aksanlara yetecek boşluğu bırakıyor. */}
          <div className="overflow-hidden">
            <h1 className="anim-hero-line heading text-[#0b0e0b] text-[clamp(32px,9.5vw,120px)] md:text-[clamp(34px,4.5vw,118px)]" style={{ lineHeight: 1.08 }}>{h.satir[0]}</h1>
          </div>
          <div className="overflow-hidden">
            <h1 className="anim-hero-line heading text-[#0b0e0b] text-[clamp(32px,9.5vw,120px)] md:text-[clamp(34px,4.5vw,118px)]" style={{ lineHeight: 1.08 }}>{h.satir[1]}</h1>
          </div>
          <div className="overflow-hidden">
            <h1 className="anim-hero-line heading text-[#e55f28] text-[clamp(32px,9.5vw,120px)] md:text-[clamp(34px,4.5vw,118px)]" style={{ lineHeight: 1.08 }}>{h.satir[2]}</h1>
          </div>
        </div>

        {/* Açıklama */}
        <p className="anim-hero-sub text-[#6b7366] font-light leading-relaxed mb-10 relative z-10"
          style={{ maxWidth: 360, fontSize: "clamp(14px,1.3vw,16px)" }}>
          {h.aciklama(stats?.years ?? 55)}
        </p>

        {/* CTA */}
        <div className="anim-hero-sub flex flex-wrap gap-3 relative z-10">
          <a href="#contact"
            className="anim-magnetic inline-flex items-center gap-2 bg-[#e55f28] hover:bg-[#c94f1e] text-white text-[11px] font-semibold tracking-[0.14em] uppercase px-7 py-4 transition-colors">
            {h.teklif}
          </a>
          <a href={kurumsalYolu(dil, "katalog")}
            className="anim-magnetic inline-flex items-center gap-2 border border-[#0b0e0b]/20 hover:border-[#0b0e0b]/50 text-[#0b0e0b] text-[11px] font-semibold tracking-[0.14em] uppercase px-7 py-4 transition-colors">
            {h.katalog}
          </a>
        </div>

        {/* Üretim özeti — statik, sayaç yok */}
        <div className="anim-hero-sub flex flex-wrap gap-x-10 gap-y-4 mt-14 relative z-10">
          {st.map(s => (
            <div key={s.l}>
              <div className="heading text-[#e55f28]" style={{ fontSize: "clamp(28px,3.6vw,44px)", lineHeight: 1 }}>
                {s.n}{s.s}
              </div>
              <div className="eyebrow text-[#6b7366] mt-2" style={{ fontSize: 9 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sağ: Ürün görseli ──────────────────────────── */}
      <div className="relative overflow-hidden hidden md:block" style={{ background: "#c17849" }}>
        {/* Turuncu bölücü çizgi */}
        <div className="split-line absolute left-0 top-0 bottom-0"
          style={{ background: "linear-gradient(to bottom, transparent, #e55f28 20%, #e55f28 80%, transparent)" }} />

        {/* Ürün grid — 2x2 dönen ürünler */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-[#0b0e0b]/12">
          {[img.ufo, img.dantel, img.d3, img.venusAsk].map((src, i) => (
            <div key={i} className="relative overflow-hidden tilt-card" style={{ background: i % 2 === 0 ? "#c17849" : "#ab6740" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={h.alt}
                className="tilt-card-inner product-spin absolute inset-0 w-full h-full object-cover" />
            </div>
          ))}
        </div>

        {/* Ürün kodu overlay */}
        <div className="absolute bottom-8 right-8 z-10">
          <span className="eyebrow text-white/60 text-[9px]">{h.koleksiyon}</span>
        </div>
      </div>

      {/* Mobilde ürün görseli */}
      <div className="absolute right-0 top-[9%] w-[44%] h-[22%] z-[5] pointer-events-none md:hidden"
        style={{ background: "radial-gradient(closest-side, rgba(193,120,73,0.35) 0%, rgba(193,120,73,0.12) 62%, rgba(193,120,73,0) 100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.kordon} alt="Alya Plastik ALY-110"
          className="js-hero-product w-full h-full object-contain"
          style={{ WebkitMaskImage: "radial-gradient(closest-side, #000 62%, transparent 100%)", maskImage: "radial-gradient(closest-side, #000 62%, transparent 100%)" }} />
      </div>

      {/* Alt progress çizgisi */}
      <div className="absolute bottom-0 left-0 right-0 h-px z-10"
        style={{ background: "linear-gradient(to right, #e55f28 0%, #e55f28 50%, rgba(229,95,40,0.1) 100%)" }} />

      {/* Scroll indicator */}
      <div className="anim-hero-sub absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2">
        <div className="relative w-5 h-8 rounded-full border border-[#0b0e0b]/20 flex justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-[#e55f28] animate-bounce" />
        </div>
        <span className="eyebrow text-[#0b0e0b]/35" style={{ fontSize: 9 }}>{h.kaydir}</span>
      </div>
    </section>
  );
}
