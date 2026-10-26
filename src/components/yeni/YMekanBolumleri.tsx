"use client";
import { useEffect } from "react";
import type { Product } from "@/lib/supabase";
import { type Dil } from "@/lib/diller";
import { M } from "@/lib/site-metin";
import { Y } from "./metin";
import { UM } from "./urunler-metin";
import YUrunIzgara from "./YUrunIzgara";

type Mekan = "dis" | "ic";
const TEMA: Record<Mekan, { zemin: string; panel: string; no: string }> = {
  dis: { zemin: "#f3efe7", panel: "#e6dfd0", no: "01" },
  ic: { zemin: "#eef0f2", panel: "#dfe3e8", no: "02" },
};

// İç mekan / dış mekan iki ayrı "bölüm" olarak anlatılır; süzgeç yok — her bölümün kendi başlığı, kolajı ve ürün mozaiği var.
export default function YMekanBolumleri({ products, dil = "tr" }: { products: Product[]; dil?: Dil }) {
  const u = UM[dil];
  const k = Y[dil].koleksiyon;
  const katAd = M[dil].kategori as Record<string, string>;
  const mekanda = (p: Product, m: Mekan) => !p.mekan || p.mekan === m;

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mekan");
    if (m === "ic" || m === "dis") setTimeout(() => document.getElementById(`${m}-mekan`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, []);

  const bolumler = (["dis", "ic"] as const).map(m => {
    const liste = products.filter(p => mekanda(p, m)).sort((a, b) => (a.category || "").localeCompare(b.category || "", "tr"));
    const kats = [...new Set(liste.map(p => p.category).filter(Boolean))] as string[];
    return { m, liste, kats };
  }).filter(b => b.liste.length > 0);

  return (
    <div>
      {bolumler.length > 1 && (
        <nav className="flex flex-wrap gap-3 mb-10" aria-label="mekan">
          {bolumler.map(b => (
            <a key={b.m} href={`#${b.m}-mekan`} className="group inline-flex items-center gap-3 rounded-full border border-black/15 bg-white pl-2 pr-5 py-2 text-[16px] font-semibold hover:border-black/40 transition-colors">
              <span className="w-8 h-8 rounded-full bg-black text-white text-[12px] flex items-center justify-center tabular-nums">{TEMA[b.m].no}</span>
              {k[b.m].ad}
              <span className="text-black/35 font-normal">{b.liste.length}</span>
            </a>
          ))}
        </nav>
      )}

      <div className="space-y-16 md:space-y-24">
        {bolumler.map(b => {
          const t = TEMA[b.m];
          const kolaj = b.liste.slice(0, 3);
          return (
            <section key={b.m} id={`${b.m}-mekan`} className="scroll-mt-24">
              <div className="relative overflow-hidden rounded-[32px] mb-6 md:mb-8 grid md:grid-cols-[1.1fr_1fr] items-stretch" style={{ background: t.zemin }}>
                <div className="p-7 md:p-12 flex flex-col justify-between gap-10">
                  <span className="text-[13px] tracking-[0.2em] text-black/45 font-semibold tabular-nums">{t.no} / {String(bolumler.length).padStart(2, "0")}</span>
                  <div>
                    <h2 className="font-semibold tracking-[-0.025em] leading-[1.02]" style={{ fontSize: "clamp(40px,6vw,84px)" }}>{k[b.m].ad}</h2>
                    <p className="mt-4 text-[clamp(16px,1.5vw,20px)] text-black/60 max-w-[460px]">{k[b.m].alt}</p>
                    <p className="mt-6 text-[14px] text-black/50">
                      <span className="font-semibold text-black">{b.liste.length}</span> {u.urun}
                      {b.kats.length > 0 && <> · {b.kats.map(c => katAd[c] ?? c).join(" · ")}</>}
                    </p>
                  </div>
                </div>
                <div className="relative min-h-[260px] md:min-h-[380px]" style={{ background: t.panel }} aria-hidden>
                  {kolaj[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={kolaj[0].image_url} alt="" className="absolute left-[8%] top-[10%] w-[52%] aspect-[4/5] object-cover rounded-3xl shadow-xl rotate-[-3deg]" />}
                  {kolaj[1] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={kolaj[1].image_url} alt="" className="absolute right-[7%] top-[6%] w-[36%] aspect-square object-cover rounded-3xl shadow-xl rotate-[4deg]" />}
                  {kolaj[2] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={kolaj[2].image_url} alt="" className="absolute right-[14%] bottom-[7%] w-[34%] aspect-square object-cover rounded-3xl shadow-xl rotate-[-2deg]" />}
                </div>
              </div>
              <YUrunIzgara liste={b.liste} dil={dil} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
