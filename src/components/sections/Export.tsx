"use client";
import { useEffect, useRef } from "react";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";

export default function Export({ countries, dil = "tr" }: { countries: string[]; dil?: Dil }) {
  const x_ = M[dil].ihracat;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if(!el) return;
    let x=0, raf: number;
    const half = el.scrollWidth/2;
    const tick = () => { x-=0.4; if(Math.abs(x)>=half) x=0; el.style.transform=`translateX(${x}px)`; raf=requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section id="export" className="bg-[#eae6dd] overflow-hidden" data-bg="#eae6dd" style={{ paddingBlock:"clamp(72px,9vw,130px)" }}>
      <div className="mb-12" style={{ paddingInline:"clamp(20px,5vw,80px)" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-end">
          <div>
            <p className="anim-eyebrow eyebrow text-[#e55f28] mb-3">{x_.etiket}</p>
            <h2 className="anim-split-heading heading text-[#0b0e0b]" style={{ fontSize:"clamp(44px,7vw,96px)" }}>
              {countries.length}+ {x_.ulke}
            </h2>
          </div>
          <div className="anim-up">
            <p className="font-light leading-loose text-[#6b7366] mb-6" style={{ fontSize:"clamp(14px,1.4vw,16px)" }}>
              {x_.aciklama}
            </p>
            <a href="#contact" className="eyebrow text-[#6b7366] hover:text-[#0b0e0b] transition-colors border-b border-[#0b0e0b]/15 pb-1.5 inline-block text-[10px]">
              {x_.bilgi}
            </a>
          </div>
        </div>
      </div>

      <div className="overflow-hidden border-y border-[#0b0e0b]/10 py-[18px]">
        <div ref={ref} className="flex whitespace-nowrap" style={{ width:"max-content" }}>
          {[...countries, ...countries].map((c, i) => (
            <span key={i} className="inline-flex items-center gap-4 px-4 eyebrow text-[#6b7366] text-[11px]">
              {c} <span className="text-[#e55f28] opacity-50 text-[6px]">◆</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
