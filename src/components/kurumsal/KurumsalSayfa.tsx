import type { ReactNode } from "react";
import type { Settings } from "@/lib/supabase";
import type { Dil } from "@/lib/diller";
import { HREFLANG } from "@/lib/diller";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// Kurumsal içerik sayfaları (Hakkımızda, Üretim Süreci, Sertifikalar, KVKK) için ortak sayfa
// iskeleti — anasayfayla aynı Header/Footer'ı kullanır. dil verilmezse (kök /hakkimizda vb.)
// Türkçe varsayılır; /en, /ru, /zh altındaki karşılıkları dil geçer, böylece dil değiştirici
// bu sayfalarda da doğru dile kalır (bkz. altDiller).
export default function KurumsalSayfa({ settings, dil = "tr", altDiller, etiket, baslik, children }: { settings: Settings | null; dil?: Dil; altDiller?: Partial<Record<Dil, string>>; etiket: string; baslik: string; children: ReactNode }) {
  return (
    <div lang={HREFLANG[dil]}>
      <Header settings={settings} dil={dil} altDiller={altDiller} />
      <main className="bg-[#eae6dd] min-h-svh pt-[84px]">
        <div style={{ paddingInline: "clamp(20px,5vw,80px)", paddingBlock: "clamp(48px,7vw,96px)" }}>
          <p className="eyebrow text-[#e55f28] mb-3">{etiket}</p>
          <h1 className="heading text-[#0b0e0b] mb-10" style={{ fontSize: "clamp(36px,6vw,68px)", lineHeight: 0.98, maxWidth: "18ch" }}>{baslik}</h1>
          <div className="flex flex-col gap-5 text-[#3c4238]" style={{ maxWidth: "72ch", fontSize: "clamp(15px,1.6vw,17px)", lineHeight: 1.85 }}>
            {children}
          </div>
        </div>
      </main>
      <Footer settings={settings} dil={dil} />
    </div>
  );
}
