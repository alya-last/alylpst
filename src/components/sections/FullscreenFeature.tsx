import { IMG } from "@/data/images";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";

export default function FullscreenFeature({ dil = "tr", img = IMG }: { dil?: Dil; img?: typeof IMG }) {
  const f = M[dil].felsefe;
  return (
    <section className="relative grain overflow-hidden flex items-center bg-[#0b0e0b] min-h-[85svh]"
      data-bg="#0b0e0b">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.hero2} alt="Alya Plastik"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
        style={{ objectPosition: "center 35%" }} />
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(100deg, rgba(11,14,11,0.96) 0%, rgba(11,14,11,0.7) 50%, rgba(11,14,11,0.5) 100%)" }} />

      <div className="relative z-10 w-full"
        style={{ paddingInline: "clamp(20px,5vw,80px)", paddingBlock: "clamp(80px,10vw,140px)" }}>

        <p className="anim-eyebrow eyebrow text-[#e55f28] mb-5">{f.etiket}</p>

        <h2 className="anim-split-heading heading text-[#eae6dd] mb-8"
          style={{ fontSize: "clamp(48px,8vw,110px)", maxWidth: "72%", lineHeight: 0.95 }}>
          {f.baslik[0]} <span style={{ color: "#e55f28" }}>{f.baslik[1]}</span>
        </h2>

        <p className="anim-up font-light leading-loose text-[#6b7366] mb-10"
          style={{ maxWidth: 400, fontSize: "clamp(14px,1.5vw,16px)" }}>
          {f.aciklama}
        </p>

        <div className="flex flex-wrap gap-3 anim-up" data-delay="0.12">
          <a href="#why"
            className="anim-magnetic inline-flex items-center gap-2 bg-[#e55f28] hover:bg-[#c94f1e] text-white text-[11px] font-semibold tracking-[0.14em] uppercase px-7 py-3.5 transition-colors">
            {f.surec}
          </a>
          <a href="#contact"
            className="anim-magnetic inline-flex items-center gap-2 border border-white/20 hover:border-white/50 text-[#eae6dd] text-[11px] font-semibold tracking-[0.14em] uppercase px-7 py-3.5 transition-colors">
            {f.teklif}
          </a>
        </div>
      </div>

      <div className="absolute right-0 top-0 bottom-0 hidden xl:flex flex-col justify-center"
        style={{ paddingRight: "clamp(20px,5vw,80px)", paddingLeft: 40 }}>
        {f.stat.map(([n,l],i) => (
          <div key={i} className="anim-up py-6 pl-6 border-l border-[#e55f28]/30"
            data-delay={String(i * 0.1)}>
            <div className="heading text-[#e55f28] text-[34px] mb-1">{n}</div>
            <div className="eyebrow text-[#6b7366] text-[10px]">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
