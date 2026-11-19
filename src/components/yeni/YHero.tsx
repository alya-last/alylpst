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
  const git = (k: string) => k === "iletisim" ? kurumsalYolu(dil, "iletisim") : k === "uretim" ? kurumsalYolu(dil, "uretim-sureci") : k === "katalog" ? kurumsalYolu(dil, "katalog") : `${dilYolu(dil)}#${k}`.replace("//", "/");
  const pad = (x: number) => String(x).padStart(2, "0");
  return (
    <section className="yh relative h-[clamp(540px,68vh,700px)] bg-[#1c1c1c] overflow-hidden text-white">
      <style>{`
        @keyframes yhZoom{from{transform:scale(1)}to{transform:scale(1.09)}}
        @keyframes yhUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
        @keyframes yhFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .yh-zoom{animation:yhZoom 9s ease-out forwards}
        .yh-in>*{opacity:0;animation:yhUp .8s cubic-bezier(.2,.7,.2,1) forwards}
        .yh-in>*:nth-child(2){animation-delay:.12s}.yh-in>*:nth-child(3){animation-delay:.24s}.yh-in>*:nth-child(4){animation-delay:.36s}
        .yh-fill{transform-origin:left;animation:yhFill 7s linear forwards}
        .yh-sayi{font-variant-numeric:tabular-nums}
        .yh-ok{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.12);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s}
        .yh-ok:hover{background:var(--yt-accent);border-color:var(--yt-accent)}
        .yh-ok:active{transform:scale(.94)}
        @media (prefers-reduced-motion:reduce){.yh-zoom,.yh-in>*,.yh-fill{animation:none!important;opacity:1;transform:none}}
      `}</style>
      {t.slayt.map((s, k) => (
        <div key={k} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: k === i ? 1 : 0, pointerEvents: k === i ? "auto" : "none" }} aria-hidden={k !== i}>
          {gorseller[k % gorseller.length] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gorseller[k % gorseller.length]} alt="" className={`absolute inset-0 w-full h-full object-cover ${k === i ? "yh-zoom" : ""}`} loading={k === 0 ? "eager" : "lazy"} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(10,10,10,.82) 0%, rgba(10,10,10,.55) 45%, rgba(10,10,10,.1) 100%)" }} />
          <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(0deg, rgba(10,10,10,.65), transparent)" }} />
          <div className="relative yt-wrap h-full pb-28 md:pb-32 flex">
            <div key={k === i ? `a${i}` : `p${k}`} className={`${k === i ? "yh-in" : ""} flex flex-col justify-center items-start gap-6 flex-1`}>
              <span className="inline-block bg-[var(--yt-accent)] text-white text-[13px] md:text-[15px] font-bold tracking-[0.1em] px-4 py-2 rounded-md">{s.etiket}</span>
              <h1 className="font-bold leading-[1.02] tracking-[-0.02em] max-w-[900px]" style={{ fontSize: "clamp(36px,6vw,78px)" }}>{s.baslik}</h1>
              <p className="text-[17px] md:text-[20px] text-white/90 max-w-[620px]">{s.alt}</p>
              <a href={git(s.href)} className="yt-btn mt-2">{s.dugme}</a>
            </div>
            <div className="hidden md:flex items-end pb-2 yh-sayi select-none" aria-hidden>
              <span className="font-bold leading-none text-white/15" style={{ fontSize: "clamp(120px,16vw,220px)" }}>{pad(k + 1)}</span>
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-0 left-0 right-0 pb-6 md:pb-8">
        <div className="yt-wrap flex items-end gap-4 md:gap-8">
          <div className="flex-1 grid gap-2 md:gap-4" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
            {t.slayt.map((s, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={String(k + 1)} aria-current={k === i} className="text-start group">
                <span className="hidden md:flex items-baseline gap-2 mb-3 transition-opacity" style={{ opacity: k === i ? 1 : 0.55 }}>
                  <span className="text-[13px] font-bold tracking-widest yh-sayi">{pad(k + 1)}</span>
                  <span className="text-[14px] font-semibold truncate group-hover:text-white">{s.etiket}</span>
                </span>
                <span className="block h-[3px] rounded-full bg-white/25 overflow-hidden">
                  {k === i ? <span key={i} className="yh-fill block h-full bg-[var(--yt-accent)]" /> : <span className="block h-full bg-white/0" style={{ width: k < i ? "100%" : 0, background: "rgba(255,255,255,.55)" }} />}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setI((i - 1 + n) % n)} aria-label="‹" className="yh-ok"><ChevronLeft size={22} /></button>
            <button onClick={() => setI((i + 1) % n)} aria-label="›" className="yh-ok"><ChevronRight size={22} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
