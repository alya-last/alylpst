"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/lib/supabase";
import { type Dil, urunLinki, ad, kurumsalYolu } from "@/lib/diller";
import { M, kategoriGoster } from "@/lib/site-metin";
import { Y } from "./metin";

export type Kat = { k: string; adet: number; gorsel?: string };

// Kategori kartları (görselli) + seçilen kategoriye göre süzülen ürün ızgarası. Footer'daki ?kategori=… bağlantıları da burada çalışır.
export default function YSerit({ kategoriler, products, dil = "tr" }: { kategoriler: Kat[]; products: Product[]; dil?: Dil }) {
  const t = Y[dil].katBolum;
  const ad_ = M[dil].kategori as Record<string, string>;
  const [sec, setSec] = useState("");
  useEffect(() => {
    queueMicrotask(() => { const k = new URLSearchParams(window.location.search).get("kategori"); if (k && kategoriler.some(c => c.k === k)) setSec(k); });
  }, [kategoriler]);
  const sec_ = (k: string) => {
    const y = k === sec ? "" : k;
    setSec(y);
    const u = new URL(window.location.href); if (y) u.searchParams.set("kategori", y); else u.searchParams.delete("kategori");
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  };
  const liste = sec ? products.filter(p => p.category === sec) : products;

  return (
    <section id="collection" className="bg-[#f5f5f2]" style={{ paddingBlock: "clamp(56px,7vw,100px)" }}>
      <div className="yt-wrap">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-10">
          <div>
            <p className="text-[13px] tracking-[0.2em] text-black/45 mb-3">{t.etiket}</p>
            <h2 className="font-semibold tracking-[-0.02em]" style={{ fontSize: "clamp(32px,4.4vw,56px)" }}>{t.baslik}</h2>
          </div>
          <Link href={kurumsalYolu(dil, "urunler")} className="font-semibold border-b-2 border-black pb-0.5 hover:text-[var(--yt-accent)] hover:border-[var(--yt-accent)]">{Y[dil].yeni.tum}</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
          {kategoriler.map(c => {
            const aktif = sec === c.k;
            return (
              <button key={c.k} type="button" onClick={() => sec_(c.k)} aria-pressed={aktif}
                className={`group relative text-left aspect-[4/5] rounded-2xl overflow-hidden bg-[#2a2a2a] text-white transition-all ${aktif ? "ring-4 ring-[var(--yt-accent)]" : ""}`}>
                {c.gorsel && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.gorsel} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.15) 55%, rgba(0,0,0,0) 100%)" }} />
                <div className="absolute left-5 right-5 bottom-5 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[clamp(22px,2.2vw,30px)] font-medium leading-tight">{ad_[c.k] ?? c.k}</div>
                    <div className="text-[14px] text-white/75 mt-1">{c.adet} {t.model}</div>
                  </div>
                  <span className={`w-10 h-10 shrink-0 rounded-full border flex items-center justify-center transition-colors ${aktif ? "bg-[var(--yt-accent)] border-[var(--yt-accent)]" : "border-white/80 group-hover:bg-white group-hover:text-black"}`}><ArrowRight size={18} /></span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-12 mb-6">
          <h3 className="text-[22px] md:text-[26px] font-semibold">
            {sec ? (ad_[sec] ?? sec) : t.tumUrun} <span className="text-black/35 font-normal">({liste.length})</span>
          </h3>
          {sec && <button type="button" onClick={() => sec_(sec)} className="text-[15px] font-semibold border-b-2 border-black pb-0.5 hover:text-[var(--yt-accent)] hover:border-[var(--yt-accent)]">{t.temizle}</button>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {liste.map(p => (
            <Link key={p.id} href={urunLinki(p, dil)} className="group bg-white rounded-2xl overflow-hidden border border-black/6 hover:shadow-lg transition-shadow">
              <div className="relative aspect-square bg-[#f6f6f4] flex items-center justify-center">
                {p.is_new && <span className="absolute top-3 left-3 z-10 bg-[var(--yt-accent)] text-white text-[12px] font-bold tracking-wider px-3 py-1.5 rounded-md">{Y[dil].yeni.yeni}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={ad(p, dil)} loading="lazy" className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05]" />
              </div>
              <div className="p-4">
                <h4 className="text-[17px] font-semibold leading-snug">{ad(p, dil)}</h4>
                <p className="text-[14px] text-black/50 mt-1">{kategoriGoster(dil, p.category)} · {p.code}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
