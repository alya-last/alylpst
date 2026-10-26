import YCerceve from "./YCerceve";
import YMekanBolumleri from "./YMekanBolumleri";
import { getAllProducts, getSettings } from "@/lib/supabase";
import { DILLER, kurumsalYolu, type Dil } from "@/lib/diller";
import { UM } from "./urunler-metin";

// Ayrı "Ürünler" sayfası (tüm diller): iç mekan ve dış mekan ayrı bölümler halinde ürün mozaiği.
export default async function UrunlerSayfasi({ dil }: { dil: Dil }) {
  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  let urunler: Awaited<ReturnType<typeof getAllProducts>> = [];
  try { [settings, urunler] = await Promise.all([getSettings(), getAllProducts()]); } catch (e) { console.error("Supabase fetch error:", e); }
  urunler = urunler.filter(p => typeof p.image_url === "string" && p.image_url.startsWith("https://"));
  const u = UM[dil];
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "urunler")]));
  return (
    <YCerceve settings={settings} dil={dil} altDiller={altDiller}>
      <main>
        <section className="bg-[#f5f5f2]" style={{ paddingBlock: "clamp(36px,5vw,72px)" }}>
          <div className="yt-wrap">
            <p className="text-[13px] tracking-[0.2em] text-[var(--yt-accent)] font-semibold mb-3">{u.etiket}</p>
            <h1 className="font-semibold tracking-[-0.025em] leading-[1.05]" style={{ fontSize: "clamp(34px,5.4vw,64px)" }}>{u.baslik}</h1>
            <p className="mt-4 text-[18px] text-black/60 max-w-[620px]">{u.aciklama}</p>
          </div>
        </section>
        <section className="bg-white" style={{ paddingBlock: "clamp(32px,5vw,64px)" }}>
          <div className="yt-wrap"><YMekanBolumleri products={urunler} dil={dil} /></div>
        </section>
      </main>
    </YCerceve>
  );
}
