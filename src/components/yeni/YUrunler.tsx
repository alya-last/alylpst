"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/supabase";
import { type Dil, urunLinki, ad, kurumsalYolu } from "@/lib/diller";
import { kategoriGoster } from "@/lib/site-metin";
import { Y } from "./metin";

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
    <section id="urunler" className="bg-white" style={{ paddingBlock: "clamp(56px,7vw,100px)" }}>
      <div className="yt-wrap">
        <div className="flex items-end justify-between gap-4 mb-10">
          <h2 className="font-semibold tracking-[-0.02em]" style={{ fontSize: "clamp(32px,4.4vw,56px)" }}>{t.baslik}</h2>
          <div className="flex items-center gap-4">
            <Link href={kurumsalYolu(dil, "urunler")} className="font-semibold border-b-2 border-black pb-0.5 hover:text-[var(--yt-accent)] hover:border-[var(--yt-accent)]">{t.tum}</Link>
            <div className="hidden md:flex gap-2">
              <button onClick={() => kaydir(-1)} aria-label="‹" className="w-10 h-10 rounded-full border border-black/25 flex items-center justify-center hover:bg-black/5"><ChevronLeft size={18} /></button>
              <button onClick={() => kaydir(1)} aria-label="›" className="w-10 h-10 rounded-full border border-black/25 flex items-center justify-center hover:bg-black/5"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        <div ref={ref} onScroll={guncelle} className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.map(p => (
            <Link key={p.id} href={urunLinki(p, dil)} className="group snap-start shrink-0 w-[62%] sm:w-[34%] lg:w-[calc(20%-19.2px)] text-center">
              <div className="relative aspect-square flex items-center justify-center bg-[#f6f6f4] rounded-2xl overflow-hidden">
                {p.is_new && <span className="absolute top-3 left-3 z-10 bg-[var(--yt-accent)] text-white text-[12px] font-bold tracking-wider px-3 py-1.5 rounded-md">{t.yeni}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={ad(p, dil)} loading="lazy" className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05]" />
              </div>
              <h3 className="mt-4 text-[18px] font-semibold">{ad(p, dil)}</h3>
              <p className="text-[15px] text-black/55">{kategoriGoster(dil, p.category)} · {p.code}</p>
            </Link>
          ))}
        </div>

        <div className="relative h-2 mt-2 rounded-full bg-black/8">
          <div className="absolute top-0 bottom-0 rounded-full bg-[var(--yt-accent)]" style={{ width: `${oran * 100}%`, left: `${konum * (1 - oran) * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
