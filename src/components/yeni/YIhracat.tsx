import { type Dil, kurumsalYolu } from "@/lib/diller";
import { M } from "@/lib/site-metin";

// Yeni stil ihracat bölümü: büyük rakam + ülke etiketleri (kayan bant yerine sarmalanan liste).
export default function YIhracat({ countries, dil = "tr" }: { countries: string[]; dil?: Dil }) {
  const x = M[dil].ihracat;
  return (
    <section id="export" className="bg-white" style={{ paddingBlock: "clamp(56px,7vw,100px)" }}>
      <div className="yt-wrap grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-20 items-start">
        <div>
          <p className="text-[13px] tracking-[0.2em] text-black/45 mb-4">{x.etiket.toUpperCase()}</p>
          <div className="font-semibold tracking-[-0.03em] text-[var(--yt-accent)]" style={{ fontSize: "clamp(64px,9vw,128px)", lineHeight: 0.95 }}>{countries.length}+</div>
          <div className="font-light text-black/70" style={{ fontSize: "clamp(24px,2.6vw,36px)" }}>{x.ulke.replace(".", "").toLocaleLowerCase(dil === "tr" ? "tr-TR" : dil)}</div>
          <p className="mt-6 text-[17px] text-black/60 max-w-[460px]">{x.aciklama}</p>
          <a href={kurumsalYolu(dil, "iletisim")} className="inline-block mt-6 font-semibold border-b-2 border-black pb-0.5 hover:text-[var(--yt-accent)] hover:border-[var(--yt-accent)]">{x.bilgi.replace("→", "").trim()}</a>
        </div>
        <ul className="flex flex-wrap gap-3">
          {countries.map(c => (
            <li key={c} className="px-4 py-2.5 rounded-full bg-[#f2f2f0] text-[15px] font-medium text-black/75">{c}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
