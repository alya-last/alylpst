"use client";
import type { Stats } from "@/lib/supabase";
import { IMG } from "@/data/images";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";

export default function Why({ stats, dil = "tr", img = IMG }: { stats: Stats | null; dil?: Dil; img?: typeof IMG }) {
  const w = M[dil].neden, FEATURES = w.ozellikler, y = stats?.years ?? 55, u = stats?.countries ?? 20;
  const st = [
    { n: y,                              s: "+", ...w.stat[0] },
    { n: stats?.models ?? 200,           s: "+", ...w.stat[1] },
    { n: u,                              s: "+", ...w.stat[2] },
    { n: stats?.local_production ?? 100, s: "%", ...w.stat[3] },
  ];

  return (
    <>
      {/* Quote section — krem */}
      <section className="section-cream relative overflow-hidden" data-bg="#eae6dd"
        style={{ paddingBlock: "clamp(80px,10vw,140px)", paddingInline: "clamp(20px,5vw,80px)" }}>
        <div className="anim-line-expand absolute top-0 left-[clamp(20px,5vw,80px)] right-[clamp(20px,5vw,80px)] h-px bg-[#0b0e0b]/15" />

        <p className="anim-eyebrow eyebrow text-[#6b7366] mb-8">{w.miras(y)}</p>
        <blockquote className="anim-split-heading heading"
          style={{ fontSize: "clamp(36px,6vw,90px)", maxWidth: "80%", lineHeight: 0.92, color: "#0b0e0b" }}>
          &ldquo;{w.alinti[0]}<br />
          <span style={{ color: "#e55f28" }}>{w.alinti[1]}</span><br />
          {w.alinti[2]}&rdquo;
        </blockquote>
      </section>

      {/* Why - krem */}
      <section id="why" className="bg-[#eae6dd]" data-bg="#eae6dd"
        style={{ paddingBlock: "clamp(72px,9vw,130px)" }}>
        <div style={{ paddingInline: "clamp(20px,5vw,80px)" }}>

          <div className="flex flex-wrap items-end justify-between gap-4 mb-14">
            <div>
              <p className="anim-eyebrow eyebrow text-[#e55f28] mb-3">{w.etiket}</p>
              <h2 className="anim-split-heading heading text-[#0b0e0b]"
                style={{ fontSize: "clamp(44px,7vw,96px)" }}>
                {w.baslik(y)[0]}<br />{w.baslik(y)[1]}
              </h2>
            </div>
            <p className="anim-up font-light leading-relaxed text-[#6b7366] text-sm max-w-[260px]">
              {w.alt(y, u)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-start">
            <div>
              <div className="anim-list mb-10">
                {FEATURES.map((f, i) => (
                  <div key={i} className="anim-list-item flex items-center gap-4 py-4 border-b border-[#0b0e0b]/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#e55f28] shrink-0" />
                    <span className="scramble text-[#0b0e0b] flex-1 text-sm">{f}</span>
                    <span className="eyebrow text-[#6b7366] text-[10px]">{String(i+1).padStart(2,"0")}</span>
                  </div>
                ))}
              </div>
              <a href="#contact"
                className="anim-magnetic anim-up inline-flex items-center gap-2 bg-[#e55f28] hover:bg-[#c94f1e] text-white text-[11px] font-semibold tracking-[0.14em] uppercase px-7 py-3.5 transition-colors">
                {w.teklif}
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <div className="anim-img-reveal relative overflow-hidden bg-[#e3ddcf] aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.ufo} alt="UFO"
                  className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4 pt-12"
                  style={{ background: "linear-gradient(to top, rgba(11,14,11,0.85), transparent)" }}>
                  <div>
                    <p className="eyebrow text-[#e55f28] text-[9px] mb-1">ALY-601</p>
                    <p className="font-semibold text-[#eae6dd] text-sm">UFO Saksı</p>
                  </div>
                  <span className="eyebrow text-white bg-[#e55f28] px-2 py-1 text-[9px]">{w.yeni}</span>
                </div>
              </div>

              <div className="anim-stagger-parent grid grid-cols-2 gap-3">
                {st.map(s => (
                  <div key={s.label} className="anim-stagger-child bg-[#e3ddcf] flex flex-col justify-between p-5 min-h-[110px]">
                    <div className="heading text-[#e55f28]"
                      style={{ fontSize: "clamp(28px,4vw,48px)", lineHeight: 1 }}>
                      {s.n}{s.s}
                    </div>
                    <div>
                      <p className="font-semibold text-[#0b0e0b] text-sm">{s.label}</p>
                      <p className="eyebrow text-[#6b7366] text-[10px] mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
