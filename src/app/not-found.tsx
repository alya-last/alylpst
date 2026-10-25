import Link from "next/link";
import YCerceve from "@/components/yeni/YCerceve";
import { getSettings } from "@/lib/supabase";

export default async function NotFound() {
  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  try { settings = await getSettings(); } catch { /* ayarlar yoksa varsayılanlarla devam */ }
  return (
    <YCerceve settings={settings} dil="tr">
      <main className="bg-white">
        <div className="yt-wrap flex flex-col items-center text-center" style={{ paddingBlock: "clamp(64px,10vw,140px)" }}>
          <p className="font-semibold tracking-[-0.04em] text-[var(--yt-accent)]" style={{ fontSize: "clamp(96px,18vw,200px)", lineHeight: 1 }}>404</p>
          <h1 className="font-semibold tracking-[-0.02em] mt-4" style={{ fontSize: "clamp(26px,3.6vw,44px)" }}>Sayfa bulunamadı</h1>
          <p className="mt-4 text-[18px] text-black/60 max-w-[460px]">Aradığınız sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-9">
            <Link href="/" className="yt-btn">Ana sayfaya dön</Link>
            <Link href="/urunler" className="inline-flex items-center border border-black/25 hover:border-black rounded-[10px] px-6 py-3.5 font-semibold transition-colors">Ürünleri incele</Link>
            <Link href="/iletisim" className="inline-flex items-center border border-black/25 hover:border-black rounded-[10px] px-6 py-3.5 font-semibold transition-colors">İletişim</Link>
          </div>
        </div>
      </main>
    </YCerceve>
  );
}
