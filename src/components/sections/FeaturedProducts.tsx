import type { Product } from "@/lib/supabase";
import type { Dil } from "@/lib/diller";
import { urunLinki, ad } from "@/lib/diller";
import { M, kategoriGoster } from "@/lib/site-metin";

export default function FeaturedProducts({ products, dil = "tr" }: { products: Product[]; dil?: Dil }) {
  const f = M[dil].featured;
  return (
    <section id="products" className="bg-[#eae6dd]" data-bg="#eae6dd"
      style={{ paddingBlock: "clamp(72px,9vw,130px)" }}>
      <div style={{ paddingInline: "clamp(20px,5vw,80px)" }}>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
          <div>
            <p className="anim-eyebrow eyebrow text-[#e55f28] mb-3">{f.etiket}</p>
            <h2 className="anim-split-heading heading text-[#0b0e0b]"
              style={{ fontSize: "clamp(44px,7vw,96px)" }}>
              {f.baslik}
            </h2>
          </div>
          <a href="#collection" className="scramble anim-up eyebrow text-[#6b7366] hover:text-[#0b0e0b] transition-colors">
            {f.tum}
          </a>
        </div>

        <div className="anim-stagger-parent grid grid-cols-2 md:grid-cols-4 gap-2">
          {products.map((p, i) => (
            <a key={p.id} href={urunLinki(p, dil)}
              className={`anim-stagger-child tilt-card group relative overflow-hidden aspect-square ${i === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
              style={{ background: i % 2 === 0 ? "#181d18" : "#1e241e" }}>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_url} alt={ad(p, dil)}
                className="tilt-card-inner product-spin absolute inset-0 w-full h-full object-cover transition-transform duration-700" />

              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                style={{ background: "linear-gradient(to top, rgba(11,14,11,0.95) 0%, transparent 55%)" }} />

              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-400">
                <p className="eyebrow text-[#e55f28] text-[9px] mb-1">{p.code}</p>
                <p className="font-semibold text-white" style={{ fontSize: "clamp(12px,1.4vw,16px)" }}>{ad(p, dil)}</p>
              </div>

              <div className="absolute top-3 left-3 flex gap-1.5">
                <span className="eyebrow text-[#6b7366] text-[9px] px-[7px] py-[3px]"
                  style={{ background: "rgba(11,14,11,0.7)", backdropFilter: "blur(6px)" }}>
                  {kategoriGoster(dil, p.category)}
                </span>
                {p.is_new && (
                  <span className="eyebrow text-white bg-[#e55f28] text-[9px] px-[7px] py-[3px]">{f.yeni}</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
