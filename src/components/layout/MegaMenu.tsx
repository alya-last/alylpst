"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { kategoriYolu, bolumYolu } from "@/lib/site-metin";
import type { Dil } from "@/lib/urun-sayfasi";

// Kategori görselleri statik olarak tutuluyor — Header, sayfa başına ürün verisi çekmiyor
// (birçok sayfada kullanılıyor, ekstra sorgu maliyeti istenmiyor). Nadiren değişir.
// Görseller ilgili kategorideki bir ürünün GÜNCEL (yapay zeka üretimi) image_url'i — eski
// stok/Cloudinary/yerel görseller kaldırıldığında bunlar da güncellenmeli.
const KATEGORILER: { slug: string; gorsel: string; yeni?: boolean }[] = [
  { slug: "saksi", gorsel: "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/4fb43d0b-5488-4b13-875d-c7969fe68978/1790527399471.png" },
  { slug: "sepet", gorsel: "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/057d9e2a-e24f-4f9c-8702-37c24cf8267e/1790527369354.png" },
  { slug: "sandik", gorsel: "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/8b287240-2941-46d8-bdfd-db73edb4fd58/1790527387849.png" },
  { slug: "ev", gorsel: "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/25686cfc-1359-4a27-b479-1dc04afef371/1790527404229.png" },
  { slug: "bahce", gorsel: "https://cwhxrusysuumndijapeb.supabase.co/storage/v1/object/public/urun-gorselleri/61104650-a2cc-4e57-8bc5-b19f490dbf51/1790599070623.png", yeni: true },
];

const METIN: Record<Dil, { baslik: string; alt: string; tumu: string; yeni: string }> = {
  tr: { baslik: "ÜRÜN KATEGORİLERİ", alt: "55+ yıllık üretim tecrübesiyle 200'den fazla model", tumu: "Tüm Ürünleri Gör", yeni: "YENİ" },
  en: { baslik: "PRODUCT CATEGORIES", alt: "200+ models, backed by 55+ years of manufacturing", tumu: "See All Products", yeni: "NEW" },
  ru: { baslik: "КАТЕГОРИИ ТОВАРОВ", alt: "200+ моделей и более 55 лет производственного опыта", tumu: "Все товары", yeni: "НОВОЕ" },
  zh: { baslik: "产品分类", alt: "55年以上生产经验，200多款产品", tumu: "查看全部产品", yeni: "新品" },
};

export default function MegaMenu({ dil, kategoriAd, label }: { dil: Dil; kategoriAd: Record<string, string>; label: string }) {
  const [acik, setAcik] = useState(false);
  const kutuRef = useRef<HTMLDivElement>(null);
  const kapatZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = METIN[dil];

  useEffect(() => {
    if (!acik) return;
    const disaTikla = (e: MouseEvent) => { if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) setAcik(false); };
    const escTusu = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    document.addEventListener("mousedown", disaTikla);
    document.addEventListener("keydown", escTusu);
    return () => { document.removeEventListener("mousedown", disaTikla); document.removeEventListener("keydown", escTusu); };
  }, [acik]);

  // Fareyle diğer nav linklerine geçerken menünün anında kapanmaması için küçük bir gecikme.
  const ac = () => { if (kapatZamanlayici.current) clearTimeout(kapatZamanlayici.current); setAcik(true); };
  const kapatGecikmeli = () => { kapatZamanlayici.current = setTimeout(() => setAcik(false), 140); };

  return (
    <div ref={kutuRef} className="relative" onMouseEnter={ac} onMouseLeave={kapatGecikmeli}>
      <button type="button" onClick={() => setAcik(p => !p)} aria-expanded={acik} aria-haspopup="true"
        className="eyebrow text-white/80 hover:text-white transition-colors duration-200 flex items-center gap-1.5" style={{ fontSize: 12.5 }}>
        {label}
      </button>

      {/* Header'daki "Ürünler" linki nav grubunun en solunda; panel ona göre değil, viewport'a göre
          ortalanıyor (position:fixed) — yoksa geniş panel sol kenardan taşardı (bkz. ürün sayfası testi). */}
      <div role="menu" aria-label={label}
        className="fixed top-[92px] left-1/2 w-[min(760px,86vw)] p-6 bg-[#0b0e0b] border border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] origin-top transition-all duration-200 z-10"
        style={{ opacity: acik ? 1 : 0, transform: `translateX(-50%) scale(${acik ? 1 : 0.97}) translateY(${acik ? 0 : -6}px)`, pointerEvents: acik ? "auto" : "none" }}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <span className="eyebrow text-[#e55f28]" style={{ fontSize: 12 }}>{t.baslik}</span>
            <p className="text-[#9aa294] mt-1.5" style={{ fontSize: 13.5 }}>{t.alt}</p>
          </div>
          {/* Düz <a>: Collection bileşeni ?kategori= parametresini yalnızca mount anında okuyor
              (bkz. Collection.tsx). Next <Link> ile aynı sayfada kalınarak yapılan bir geçiş bu
              effect'i yeniden tetiklemediğinden seçili kategori güncellenmiyordu — tam sayfa
              yenilemesi (<a>) her tıklamada doğru filtrelenmiş listeyle mount olmasını garantiler. */}
          <a href={bolumYolu(dil, "collection")}
            className="eyebrow text-white/70 hover:text-white flex items-center gap-1.5 shrink-0 transition-colors" style={{ fontSize: 12 }}>
            {t.tumu} <ArrowRight size={13} />
          </a>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {KATEGORILER.map(k => (
            <a key={k.slug} href={kategoriYolu(dil, k.slug)}
              className="group flex flex-col gap-2.5">
              <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={k.gorsel} alt={kategoriAd[k.slug] || k.slug}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.08]" />
                {k.yeni && (
                  <span className="absolute top-2 start-2 bg-[#e55f28] text-white text-[9.5px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 rounded-full">
                    {t.yeni}
                  </span>
                )}
              </div>
              <span className="eyebrow text-[#9aa294] group-hover:text-white transition-colors text-center" style={{ fontSize: 12 }}>
                {kategoriAd[k.slug] || k.slug}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
