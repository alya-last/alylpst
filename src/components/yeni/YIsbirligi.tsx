import Link from "next/link";
import { type Dil, kurumsalYolu } from "@/lib/diller";
import { dilYolu } from "@/lib/site-metin";
import { Y } from "./metin";

export default function YIsbirligi({ dil = "tr", gorselSol, gorselSag }: { dil?: Dil; gorselSol?: string; gorselSag?: string }) {
  const k = Y[dil].katalogKutu, b = Y[dil].b2b;
  return (
    <section className="grid md:grid-cols-2">
      <div className="relative bg-[#3f5d46] text-white overflow-hidden" style={{ padding: "clamp(40px,6vw,80px) clamp(20px,5vw,80px)" }}>
        <p className="text-[13px] tracking-[0.2em] text-white/70 mb-4">{k.etiket}</p>
        <h2 className="font-light tracking-[-0.02em] leading-[1.08] max-w-[460px]" style={{ fontSize: "clamp(30px,3.6vw,48px)" }}>{k.baslik}</h2>
        <p className="mt-4 text-white/80 max-w-[420px]">{k.alt}</p>
        <Link href={kurumsalYolu(dil, "katalog")} className="yt-btn mt-8">{k.dugme}</Link>
        {gorselSol && /* eslint-disable-next-line @next/next/no-img-element */ <img src={gorselSol} alt="" loading="lazy" className="hidden lg:block absolute right-6 bottom-0 h-[85%] w-auto object-contain opacity-95" />}
      </div>
      <div className="relative bg-[#f2f2f2] overflow-hidden" style={{ padding: "clamp(40px,6vw,80px) clamp(20px,5vw,80px)" }}>
        <p className="text-[13px] tracking-[0.2em] text-black/50 mb-4">{b.etiket}</p>
        <h2 className="font-light tracking-[-0.02em] leading-[1.08] max-w-[460px]" style={{ fontSize: "clamp(30px,3.6vw,48px)" }}>{b.baslik}</h2>
        <p className="mt-4 text-black/65 max-w-[420px]">{b.alt}</p>
        <a href={`${dilYolu(dil)}#iletisim`.replace("//", "/")} className="yt-btn mt-8">{b.dugme}</a>
        {gorselSag && /* eslint-disable-next-line @next/next/no-img-element */ <img src={gorselSag} alt="" loading="lazy" className="hidden lg:block absolute right-6 bottom-0 h-[85%] w-auto object-contain" />}
      </div>
    </section>
  );
}
