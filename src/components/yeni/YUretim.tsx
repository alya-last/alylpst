import Link from "next/link";
import type { Stats, Settings } from "@/lib/supabase";
import { type Dil, kurumsalYolu } from "@/lib/diller";
import { Y } from "./metin";

export default function YUretim({ dil = "tr", stats, settings, gorsel }: { dil?: Dil; stats: Stats | null; settings: Settings | null; gorsel: string }) {
  const t = Y[dil].uretim;
  const rak = [
    { n: String(settings?.founded ?? 1968), l: t.yil },
    { n: `${stats?.countries ?? 20}+`, l: t.ulke },
    { n: `${stats?.models ?? 200}+`, l: t.model },
  ];
  return (
    <section className="bg-white" style={{ paddingBlock: "clamp(40px,6vw,90px)" }}>
      <div className="yt-wrap grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className="aspect-[16/11] rounded-sm overflow-hidden bg-[#e8e8e4]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gorsel} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-[13px] tracking-[0.2em] text-black/50 mb-4">{t.etiket}</p>
          <h2 className="font-light tracking-[-0.025em] leading-[1.08]" style={{ fontSize: "clamp(32px,4.2vw,56px)" }}>{t.baslik(stats?.models ?? 200)}</h2>
          <p className="mt-5 text-[17px] text-black/65 max-w-[560px]">{t.alt}</p>
          <div className="grid grid-cols-3 gap-6 mt-9">
            {rak.map(r => (
              <div key={r.l} className="border-t border-black pt-5">
                <div className="font-light text-black/65" style={{ fontSize: "clamp(32px,4vw,54px)", lineHeight: 1 }}>{r.n}</div>
                <div className="mt-2 text-[15px] text-black/55">{r.l}</div>
              </div>
            ))}
          </div>
          <Link href={kurumsalYolu(dil, "uretim-sureci")} className="inline-block mt-8 font-semibold border-b-2 border-black pb-0.5 hover:text-[var(--yt-accent)] hover:border-[var(--yt-accent)]">{t.kesfet}</Link>
        </div>
      </div>
    </section>
  );
}
