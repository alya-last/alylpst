"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { kurumsalYolu, type Dil } from "@/lib/diller";
import { dilYolu } from "@/lib/site-metin";
import { Y } from "./metin";

export default function YHero({ dil = "tr", gorseller }: { dil?: Dil; gorseller: string[] }) {
  const t = Y[dil];
  const [i, setI] = useState(0);
  const n = t.slayt.length;
  useEffect(() => {
    const id = setInterval(() => setI(p => (p + 1) % n), 7000);
    return () => clearInterval(id);
  }, [n, i]);
  const git = (k: string) => k === "uretim" ? kurumsalYolu(dil, "uretim-sureci") : k === "katalog" ? kurumsalYolu(dil, "katalog") : `${dilYolu(dil)}#${k}`.replace("//", "/");

  return (
    <section className="relative h-[clamp(480px,62vh,660px)] bg-[#1c1c1c] overflow-hidden text-white">
      {t.slayt.map((s, k) => (
        <div key={k} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: k === i ? 1 : 0, pointerEvents: k === i ? "auto" : "none" }} aria-hidden={k !== i}>
          {gorseller[k % gorseller.length] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gorseller[k % gorseller.length]} alt="" className="absolute inset-0 w-full h-full object-cover" loading={k === 0 ? "eager" : "lazy"} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(10,10,10,.82) 0%, rgba(10,10,10,.55) 45%, rgba(10,10,10,.1) 100%)" }} />
          <div className="relative yt-wrap h-full flex flex-col justify-center items-start gap-6">
            <span className="inline-block bg-[var(--yt-accent)] text-white text-[13px] md:text-[15px] font-bold tracking-[0.1em] px-4 py-2 rounded-md">{s.etiket}</span>
            <h1 className="font-bold leading-[1.02] tracking-[-0.02em] max-w-[900px]" style={{ fontSize: "clamp(36px,6vw,78px)" }}>{s.baslik}</h1>
            <p className="text-[17px] md:text-[20px] text-white/90 max-w-[620px]">{s.alt}</p>
            <a href={git(s.href)} className="yt-btn mt-2">{s.dugme}</a>
          </div>
        </div>
      ))}
      <div className="absolute bottom-8 left-0 right-0">
        <div className="yt-wrap flex items-center gap-3">
          <button onClick={() => setI((i - 1 + n) % n)} aria-label="‹" className="w-[52px] h-[52px] rounded-full border border-white/80 flex items-center justify-center hover:bg-white/15"><ChevronLeft size={22} /></button>
          <button onClick={() => setI((i + 1) % n)} aria-label="›" className="w-[52px] h-[52px] rounded-full border border-white/80 flex items-center justify-center hover:bg-white/15"><ChevronRight size={22} /></button>
          <div className="flex items-center gap-2 ms-3">
            {t.slayt.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={String(k + 1)} className="h-3 rounded-full transition-all" style={{ width: k === i ? 40 : 12, background: k === i ? "#fff" : "rgba(255,255,255,.45)" }} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
