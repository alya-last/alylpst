"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/supabase";
import { type Dil, urunLinki, ad, kurumsalYolu } from "@/lib/diller";
import { kategoriGoster } from "@/lib/site-metin";
import { Y } from "./metin";

const T: Record<Dil, { incele: string; baslik: string; alt: string; btn: string }> = {
  tr: { incele: "İncele", baslik: "Aradığınız modeli bulamadınız mı?", alt: "Ölçü, renk ve adet için size özel teklif hazırlayalım.", btn: "Teklif isteyin" },
  en: { incele: "View", baslik: "Can't find the model you need?", alt: "We'll prepare a custom quote for size, colour and quantity.", btn: "Request a quote" },
  ru: { incele: "Смотреть", baslik: "Не нашли нужную модель?", alt: "Подготовим индивидуальное предложение по размеру, цвету и количеству.", btn: "Запросить цену" },
  zh: { incele: "查看", baslik: "没找到合适的型号？", alt: "我们可根据尺寸、颜色和数量为您定制报价。", btn: "获取报价" },
};

// Üç ürün grubundan birini büyük "vitrin" karosu yapan, araya teklif kartı giren mozaik ızgara.
export default function YUrunIzgara({ liste, dil = "tr" }: { liste: Product[]; dil?: Dil }) {
  const t = T[dil];
  const buyukVar = liste.length >= 3;
  const ctaSira = liste.length >= 6 ? 5 : -1;

  const cta = (
    <Link key="cta" href={kurumsalYolu(dil, "iletisim")} className="group relative flex flex-col justify-between rounded-[28px] p-6 md:p-7 text-white overflow-hidden aspect-square" style={{ background: "linear-gradient(135deg, #e55f28 0%, #c9440f 100%)" }}>
      <span aria-hidden className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10" />
      <span aria-hidden className="absolute -right-2 bottom-10 w-24 h-24 rounded-full border border-white/25" />
      <h3 className="relative text-[clamp(20px,2vw,26px)] font-semibold leading-tight">{t.baslik}</h3>
      <div className="relative">
        <p className="text-[14px] text-white/85 mb-4 leading-snug">{t.alt}</p>
        <span className="inline-flex items-center gap-2 bg-white text-black font-semibold text-[14px] rounded-full pl-5 pr-2 py-2 group-hover:gap-3 transition-all">{t.btn}<span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center"><ArrowRight size={16} /></span></span>
      </div>
    </Link>
  );

  const karolar = liste.map((p, i) => {
    const buyuk = buyukVar && i % 9 === 0;
    return (
      <Link key={p.id} href={urunLinki(p, dil)}
        className={`group relative block overflow-hidden bg-[#e9e6e0] ${buyuk ? "col-span-2 row-span-2 rounded-[32px]" : "aspect-square rounded-[24px]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image_url} alt={ad(p, dil)} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
        {p.is_new && <span className="absolute top-3 left-3 z-10 bg-[var(--yt-accent)] text-white text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-md">{Y[dil].yeni.yeni}</span>}
        {buyuk && <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0))" }} />}
        <span className={`absolute z-10 top-3 right-3 text-[12px] font-semibold tabular-nums ${buyuk ? "text-white/80" : "text-black/35"}`}>{String(i + 1).padStart(2, "0")}</span>
        {buyuk ? (
          <div className="absolute z-10 left-5 right-5 bottom-5 text-white flex items-end justify-between gap-3">
            <div>
              <p className="text-[12px] tracking-[0.18em] uppercase text-white/75">{kategoriGoster(dil, p.category)} · {p.code}</p>
              <h3 className="text-[clamp(24px,2.8vw,38px)] font-semibold leading-tight mt-1">{ad(p, dil)}</h3>
            </div>
            <span className="w-12 h-12 shrink-0 rounded-full bg-white text-black flex items-center justify-center transition-transform group-hover:rotate-45"><ArrowUpRight size={20} /></span>
          </div>
        ) : (
          <div className="absolute z-10 left-2.5 right-2.5 bottom-2.5 rounded-2xl bg-white/90 backdrop-blur-md px-3.5 py-2.5 flex items-center justify-between gap-2 transition-all duration-300 group-hover:bg-white group-hover:shadow-lg">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-snug truncate">{ad(p, dil)}</h3>
              <p className="text-[12px] text-black/50 truncate">{kategoriGoster(dil, p.category)} · {p.code}</p>
            </div>
            <span className="shrink-0 w-8 h-8 rounded-full bg-black/5 text-black flex items-center justify-center transition-colors group-hover:bg-[var(--yt-accent)] group-hover:text-white"><ArrowUpRight size={15} /></span>
          </div>
        )}
      </Link>
    );
  });
  if (ctaSira >= 0) karolar.splice(ctaSira, 0, cta);

  return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5" style={{ gridAutoFlow: "dense" }}>{karolar}</div>;
}
