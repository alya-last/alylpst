import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type Dil, kurumsalYolu } from "@/lib/diller";
import { Y } from "./metin";

export default function YKoleksiyon({ dil = "tr", icGorsel, disGorsel }: { dil?: Dil; icGorsel?: string; disGorsel?: string }) {
  const t = Y[dil].koleksiyon;
  const kartlar = [{ ...t.ic, g: icGorsel, k: "ic" }, { ...t.dis, g: disGorsel, k: "dis" }];
  return (
    <section className="bg-white" style={{ paddingBottom: "clamp(56px,7vw,100px)" }}>
      <div className="yt-wrap">
        <div className="flex items-end justify-between gap-4 mb-8">
          <h2 className="font-semibold tracking-[-0.02em]" style={{ fontSize: "clamp(32px,4.4vw,56px)" }}>{t.baslik}</h2>
          <p className="text-black/55 text-[17px] hidden sm:block">{t.alt}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {kartlar.map(c => (
            <Link key={c.k} href={`${kurumsalYolu(dil, "urunler")}?mekan=${c.k}`} className="group relative block aspect-[4/3] md:aspect-[5/4] rounded-2xl overflow-hidden bg-[#1c1c1c] text-white">
              {c.g && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.g} alt={c.ad} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />}
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.05) 60%)" }} />
              <div className="absolute left-7 right-7 bottom-7 flex items-end justify-between">
                <div>
                  <h3 className="font-light tracking-[-0.02em]" style={{ fontSize: "clamp(34px,4.4vw,58px)", lineHeight: 1 }}>{c.ad}</h3>
                  <p className="mt-2 text-white/85">{c.alt}</p>
                </div>
                <span className="w-14 h-14 shrink-0 rounded-full border border-white flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors"><ArrowRight size={22} /></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
