"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/supabase";
import { type Dil, urunLinki, ad, kurumsalYolu } from "@/lib/diller";
import { kategoriGoster } from "@/lib/site-metin";
import { Y } from "./metin";

const TON = ["#e6eee3", "#f7e4dc", "#efe8da", "#e1eaf1", "#ebebeb"];

export default function YUrunler({ products, dil = "tr" }: { products: Product[]; dil?: Dil }) {
  const t = Y[dil].yeni;
  const ref = useRef<HTMLDivElement>(null);
  const [oran, setOran] = useState(0.2);
  const [konum, setKonum] = useState(0);
  const guncelle = () => {
    const e = ref.current; if (!e) return;
    setOran(Math.min(1, e.clientWidth / Math.max(1, e.scrollWidth)));
    setKonum(e.scrollLeft / Math.max(1, e.scrollWidth - e.clientWidth));
  };
  useEffect(() => { guncelle(); window.addEventListener("resize", guncelle); return () => window.removeEventListener("resize", guncelle); }, [products]);
  const kaydir = (y: number) => ref.current?.scrollBy({ left: y * (ref.current.clientWidth * 0.8), behavior: "smooth" });

  return (
    <section id="urunler" className="relative overflow-hidden" style={{ paddingBlock: "clamp(56px,7vw,100px)", background: "linear-gradient(180deg,#fff 0%,#faf7f2 100%)" }}>
      <style>{`
        .yu-kart .yu-kemer{transition:transform .5s cubic-bezier(.2,.7,.2,1),box-shadow .5s}
        .yu-kart:hover .yu-kemer{transform:translateY(-10px);box-shadow:0 26px 40px -22px rgba(0,0,0,.35)}
        .yu-kart .yu-ok{opacity:0;transform:translate(-6px,6px) scale(.8);transition:all .35s}
        .yu-kart:hover .yu-ok{opacity:1;transform:none}
        .yu-kart img{mix-blend-mode:multiply}
        .yu-ok2{width:46px;height:46px;border-radius:14px;border:1px solid rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:all .2s;background:#fff}
        .yu-ok2:hover{background:var(--yt-accent);border-color:var(--yt-accent);color:#fff}
        @media (prefers-reduced-motion:reduce){.yu-kart .yu-kemer,.yu-kart .yu-ok{transition:none}}
      `}</style>
      <div className="yt-wrap">
        <div className="flex items-end justify-between gap-4 mb-12">
          <div>
            <span className="block w-14 h-1.5 rounded-full bg-[var(--yt-accent)] mb-5" />
            <h2 className="font-semibold tracking-[-0.02em]" style={{ fontSize: "clamp(32px,4.4vw,56px)" }}>{t.baslik}</h2>
          </div>
          <div className="flex items-center gap-4">
            <Link href={kurumsalYolu(dil, "urunler")} className="font-semibold border-b-2 border-black pb-0.5 hover:text-[var(--yt-accent)] hover:border-[var(--yt-accent)]">{t.tum}</Link>
            <div className="hidden md:flex gap-2">
              <button onClick={() => kaydir(-1)} aria-label="‹" className="yu-ok2"><ChevronLeft size={18} /></button>
              <button onClick={() => kaydir(1)} aria-label="›" className="yu-ok2"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        <div ref={ref} onScroll={guncelle} className="flex gap-6 overflow-x-auto snap-x snap-mandatory pt-2 pb-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.map((p, k) => (
            <Link key={p.id} href={urunLinki(p, dil)} className={`yu-kart group snap-start shrink-0 w-[62%] sm:w-[34%] lg:w-[calc(20%-19.2px)] text-center ${k % 2 ? "lg:mt-10" : ""}`}>
              <div className="yu-kemer relative aspect-[4/5] flex items-center justify-center overflow-hidden" style={{ background: TON[k % TON.length], borderRadius: "999px 999px 22px 22px" }}>
                <span className="absolute top-3 left-4 text-[13px] font-bold tracking-widest text-black/30 tabular-nums">{String(k + 1).padStart(2, "0")}</span>
                {p.is_new && <span className="absolute top-[14%] right-3 z-10 w-14 h-14 rounded-full bg-[var(--yt-accent)] text-white text-[11px] font-bold tracking-wider flex items-center justify-center rotate-12 shadow-md">{t.yeni}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={ad(p, dil)} loading="lazy" className="w-full h-full object-contain px-5 pt-[22%] pb-8 transition-transform duration-500 group-hover:scale-[1.06]" />
                <span className="yu-ok absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black text-white flex items-center justify-center"><ArrowUpRight size={18} /></span>
              </div>
              <h3 className="mt-5 text-[18px] font-semibold">{ad(p, dil)}</h3>
              <p className="text-[15px] text-black/55">{kategoriGoster(dil, p.category)} · {p.code}</p>
            </Link>
          ))}
        </div>

        <div className="relative h-1.5 rounded-full bg-black/10">
          <div className="absolute top-0 bottom-0 rounded-full bg-[var(--yt-accent)]" style={{ width: `${oran * 100}%`, left: `${konum * (1 - oran) * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
