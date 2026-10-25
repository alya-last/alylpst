import type { ReactNode } from "react";
import type { Settings } from "@/lib/supabase";
import type { Dil } from "@/lib/diller";
import YCerceve from "@/components/yeni/YCerceve";

// Kurumsal içerik sayfaları (Hakkımızda, Üretim Süreci, Sertifikalar, KVKK) için ortak sayfa iskeleti.
// dil verilmezse Türkçe; altDiller dil değiştiricinin aynı sayfada kalmasını sağlar.
export default function KurumsalSayfa({ settings, dil = "tr", altDiller, etiket, baslik, children }: { settings: Settings | null; dil?: Dil; altDiller?: Partial<Record<Dil, string>>; etiket: string; baslik: string; children: ReactNode }) {
  return (
    <YCerceve settings={settings} dil={dil} altDiller={altDiller}>
      <main>
        <section className="bg-[#f5f5f2]" style={{ paddingBlock: "clamp(40px,6vw,88px)" }}>
          <div className="yt-wrap">
            <p className="text-[13px] tracking-[0.2em] text-[var(--yt-accent)] font-semibold mb-4">{etiket.replace("—", "").trim().toUpperCase()}</p>
            <h1 className="font-semibold tracking-[-0.025em] leading-[1.05] max-w-[20ch]" style={{ fontSize: "clamp(34px,5.4vw,68px)" }}>{baslik}</h1>
          </div>
        </section>
        <section className="bg-white" style={{ paddingBlock: "clamp(40px,6vw,88px)" }}>
          <div className="yt-wrap">
            <div className="yt-prose">{children}</div>
          </div>
        </section>
      </main>
    </YCerceve>
  );
}
