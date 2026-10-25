"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Product } from "@/lib/supabase";
import { type Dil, urunLinki, ad } from "@/lib/diller";
import { M, kategoriGoster } from "@/lib/site-metin";
import { Y } from "./metin";
import { UM } from "./urunler-metin";

const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();
const CHIP = "px-4 py-2.5 rounded-full text-[15px] font-medium border transition-colors";

export default function YUrunListe({ products, dil = "tr" }: { products: Product[]; dil?: Dil }) {
  const u = UM[dil];
  const katAd = M[dil].kategori as Record<string, string>;
  const [kat, setKat] = useState("");
  const [mekan, setMekan] = useState<"" | "ic" | "dis">("");
  const [q, setQ] = useState("");
  useEffect(() => {
    queueMicrotask(() => {
      const p = new URLSearchParams(window.location.search);
      const k = p.get("kategori"), m = p.get("mekan");
      if (k) setKat(k);
      if (m === "ic" || m === "dis") setMekan(m);
    });
  }, []);
  const kategoriler = useMemo(() => Object.entries(products.reduce<Record<string, number>>((a, p) => { if (p.category) a[p.category] = (a[p.category] || 0) + 1; return a; }, {})).sort((x, y) => y[1] - x[1]), [products]);
  const liste = useMemo(() => {
    const n = norm(q);
    return products.filter(p => (!kat || p.category === kat) && (!mekan || p.mekan === mekan) && (!n || norm(`${ad(p, dil)} ${p.code}`).includes(n)));
  }, [products, kat, mekan, q, dil]);
  const aktif = !!(kat || mekan || q);
  const secKat = (k: string) => { setKat(k); const url = new URL(window.location.href); if (k) url.searchParams.set("kategori", k); else url.searchParams.delete("kategori"); window.history.replaceState(null, "", url.pathname + url.search); };
  const secMekan = (m: "" | "ic" | "dis") => { setMekan(m); const url = new URL(window.location.href); if (m) url.searchParams.set("mekan", m); else url.searchParams.delete("mekan"); window.history.replaceState(null, "", url.pathname + url.search); };
  const act = (on: boolean) => on ? "bg-[var(--yt-accent)] border-[var(--yt-accent)] text-white" : "bg-white border-black/15 text-black/75 hover:border-black/40";

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] items-end mb-8">
        <div className="space-y-5">
          <div>
            <p className="text-[13px] tracking-[0.15em] text-black/45 mb-2.5">{u.mekan.toUpperCase()}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => secMekan("")} className={`${CHIP} ${act(!mekan)}`}>{u.tumu}</button>
              <button type="button" onClick={() => secMekan("ic")} className={`${CHIP} ${act(mekan === "ic")}`}>{u.ic}</button>
              <button type="button" onClick={() => secMekan("dis")} className={`${CHIP} ${act(mekan === "dis")}`}>{u.dis}</button>
            </div>
          </div>
          <div>
            <p className="text-[13px] tracking-[0.15em] text-black/45 mb-2.5">{u.kategori.toUpperCase()}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => secKat("")} className={`${CHIP} ${act(!kat)}`}>{u.tumu}</button>
              {kategoriler.map(([k, n]) => <button key={k} type="button" onClick={() => secKat(k === kat ? "" : k)} className={`${CHIP} ${act(kat === k)}`}>{katAd[k] ?? k} <span className="opacity-60">{n}</span></button>)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-b-2 border-black h-12 min-w-[260px]">
          <Search size={18} className="text-black/50" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={u.ara} aria-label={u.ara} className="flex-1 bg-transparent outline-none text-[16px] placeholder:text-black/40" />
        </div>
      </div>

      <div className="flex items-center justify-between mb-5">
        <p className="text-black/55">{liste.length} {u.urun}</p>
        {aktif && <button type="button" onClick={() => { setKat(""); setMekan(""); setQ(""); window.history.replaceState(null, "", window.location.pathname); }} className="text-[15px] font-semibold border-b-2 border-black pb-0.5 hover:text-[var(--yt-accent)] hover:border-[var(--yt-accent)]">{u.temizle}</button>}
      </div>

      {liste.length === 0 ? <p className="py-16 text-center text-black/55 text-[17px]">{u.bulunamadi}</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {liste.map(p => (
            <Link key={p.id} href={urunLinki(p, dil)} className="group bg-white rounded-2xl overflow-hidden border border-black/6 hover:shadow-lg transition-shadow">
              <div className="relative aspect-square bg-[#f6f6f4] flex items-center justify-center">
                {p.is_new && <span className="absolute top-3 left-3 z-10 bg-[var(--yt-accent)] text-white text-[12px] font-bold tracking-wider px-3 py-1.5 rounded-md">{Y[dil].yeni.yeni}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={ad(p, dil)} loading="lazy" className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05]" />
              </div>
              <div className="p-4">
                <h3 className="text-[17px] font-semibold leading-snug">{ad(p, dil)}</h3>
                <p className="text-[14px] text-black/50 mt-1">{kategoriGoster(dil, p.category)} · {p.code}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
