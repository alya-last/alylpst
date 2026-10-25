import Link from "next/link";
import { type Dil, kurumsalYolu } from "@/lib/diller";
import { Y } from "./metin";

// İki panel: metin solda, ürün görseli kendi yuvasında sağda (yazının üstüne binmez).
function Panel({ koyu, etiket, baslik, alt, children, gorsel }: { koyu?: boolean; etiket: string; baslik: string; alt: string; children: React.ReactNode; gorsel?: string }) {
  return (
    <div className={`flex ${koyu ? "bg-[#262626] text-white" : "bg-[#f2f2f0] text-[#1b1b1b]"}`}>
      <div className="flex-1 min-w-0 flex flex-col justify-center items-start" style={{ padding: "clamp(36px,5vw,72px) clamp(20px,4vw,64px)" }}>
        <p className={`text-[13px] tracking-[0.2em] mb-4 ${koyu ? "text-white/60" : "text-black/45"}`}>{etiket}</p>
        <h2 className="font-light tracking-[-0.02em] leading-[1.1]" style={{ fontSize: "clamp(28px,3.2vw,44px)" }}>{baslik}</h2>
        <p className={`mt-4 max-w-[400px] ${koyu ? "text-white/75" : "text-black/60"}`}>{alt}</p>
        <div className="mt-8">{children}</div>
      </div>
      {gorsel && (
        <div className="hidden md:block w-[34%] shrink-0 p-6 self-stretch">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gorsel} alt="" loading="lazy" className="w-full h-full object-cover rounded-2xl" />
        </div>
      )}
    </div>
  );
}

export default function YIsbirligi({ dil = "tr", gorselSol, gorselSag }: { dil?: Dil; gorselSol?: string; gorselSag?: string }) {
  const k = Y[dil].katalogKutu, b = Y[dil].b2b;
  return (
    <section className="grid lg:grid-cols-2">
      <Panel koyu etiket={k.etiket} baslik={k.baslik} alt={k.alt} gorsel={gorselSol}>
        <Link href={kurumsalYolu(dil, "katalog")} className="yt-btn">{k.dugme}</Link>
      </Panel>
      <Panel etiket={b.etiket} baslik={b.baslik} alt={b.alt} gorsel={gorselSag}>
        <a href={kurumsalYolu(dil, "iletisim")} className="yt-btn">{b.dugme}</a>
      </Panel>
    </section>
  );
}
