import type { Dil } from "@/lib/diller";
import { Y } from "./metin";
import { M } from "@/lib/site-metin";

// Marka şeridi yerine: ürün grupları (kategori) — veriden gelen kategoriler.
export default function YSerit({ kategoriler, dil = "tr" }: { kategoriler: { k: string; adet: number }[]; dil?: Dil }) {
  const ad = M[dil].kategori as Record<string, string>;
  return (
    <section className="bg-[#f2f2f2] py-9" aria-label={Y[dil].seritBaslik}>
      <div className="yt-wrap flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
        {kategoriler.map(c => (
          <a key={c.k} href={`?kategori=${c.k}#urunler`} className="text-[22px] md:text-[26px] font-semibold text-black/45 hover:text-[var(--yt-accent)] transition-colors">
            {ad[c.k] ?? c.k} <span className="text-[14px] align-top text-black/30">{c.adet}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
