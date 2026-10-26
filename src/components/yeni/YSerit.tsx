"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/lib/supabase";
import { type Dil, kurumsalYolu } from "@/lib/diller";
import { M } from "@/lib/site-metin";
import { Y } from "./metin";
import { UM } from "./urunler-metin";
import YUrunIzgara from "./YUrunIzgara";

export type Kat = { k: string; adet: number; gorsel?: string };

// Kategori kartları (görselli) + seçilen kategoriye göre süzülen ürün ızgarası. Footer'daki ?kategori=… bağlantıları da burada çalışır.
export default function YSerit({ kategoriler, products, dil = "tr" }: { kategoriler: Kat[]; products: Product[]; dil?: Dil }) {
  const t = Y[dil].katBolum;
  const ad_ = M[dil].kategori as Record<string, string>;
  const u = UM[dil];
  const [sec, setSec] = useState("");
  const [mekan, setMekan] = useState<"ic" | "dis">("dis");
  const mekanda = (p: Product, m: "ic" | "dis") => !p.mekan || p.mekan === m;
  const adetIc = products.filter(p => mekanda(p, "ic")).length, adetDis = products.filter(p => mekanda(p, "dis")).length;
  useEffect(() => {
    queueMicrotask(() => {
      const q = new URLSearchParams(window.location.search);
      const m = q.get("mekan");
      if (m === "ic" || m === "dis") setMekan(m); else if (!products.some(p => mekanda(p, "dis"))) setMekan("ic");
      const k = q.get("kategori"); if (k && kategoriler.some(c => c.k === k)) setSec(k);
    });
  }, [kategoriler, products]);
  const urunler = products.filter(p => mekanda(p, mekan));
  const kats = kategoriler.map(c => ({ ...c, adet: urunler.filter(p => p.category === c.k).length })).filter(c => c.adet > 0);
  const url = (fn: (q: URLSearchParams) => void) => { const x = new URL(window.location.href); fn(x.searchParams); window.history.replaceState(null, "", x.pathname + x.search + x.hash); };
  const secMekan = (m: "ic" | "dis") => { setMekan(m); setSec(""); url(q => { q.set("mekan", m); q.delete("kategori"); }); };
  const sec_ = (k: string) => {
    const y = k === sec ? "" : k;
    setSec(y);
    url(q => { if (y) q.set("kategori", y); else q.delete("kategori"); });
  };
  const aktifSec = sec && kats.some(c => c.k === sec) ? sec : "";
  const liste = aktifSec ? urunler.filter(p => p.category === aktifSec) : urunler;

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

        <div className="flex gap-3 mb-8" role="tablist">
          {([["dis", u.dis, adetDis], ["ic", u.ic, adetIc]] as const).map(([m, e, n]) => (
            <button key={m} type="button" role="tab" aria-selected={mekan === m} onClick={() => secMekan(m)}
              className={`rounded-full px-6 py-3 text-[16px] font-semibold transition-colors ${mekan === m ? "bg-black text-white" : "bg-white text-black/70 border border-black/15 hover:border-black/40"}`}>
              {e} <span className={mekan === m ? "text-white/60 font-normal" : "text-black/35 font-normal"}>({n})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
          {kats.map(c => {
            const aktif = aktifSec === c.k;
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
            {aktifSec ? (ad_[aktifSec] ?? aktifSec) : (mekan === "ic" ? u.ic : u.dis)} <span className="text-black/35 font-normal">({liste.length})</span>
          </h3>
          {aktifSec && <button type="button" onClick={() => sec_(aktifSec)} className="text-[15px] font-semibold border-b-2 border-black pb-0.5 hover:text-[var(--yt-accent)] hover:border-[var(--yt-accent)]">{t.temizle}</button>}
        </div>
        <YUrunIzgara liste={liste} dil={dil} />
      </div>
    </section>
  );
}
