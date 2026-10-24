import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HtmlLang from "@/components/layout/HtmlLang";
import UrunGaleri from "@/components/urun/UrunGaleri";
import TeklifModal from "@/components/urun/TeklifModal";
import { bolumYolu, dilYolu, kategoriGoster } from "@/lib/site-metin";
import type { Settings } from "@/lib/supabase";
import { DILLER, DIL_AD, HREFLANG, UI, ad, aciklama, etiketAdi, jsonLdMetni, kategoriAdi, mevcutDiller, ozellikEtiketi, urunJsonLd, urunLinki, urunYolu, type Dil, type UrunKaydi } from "@/lib/urun-sayfasi";

// Sunucu bileşeni: ürün detay sayfası (tüm diller için ortak). İçerik yalnızca veritabanındaki ürün kaydından gelir.
export default function UrunSayfasi({ urun, dil, settings, benzer, kategoriler = {} }: { urun: UrunKaydi; dil: Dil; settings: Settings | null; benzer: UrunKaydi[]; kategoriler?: Record<string, string> }) {
  const T = UI[dil], rtl = false;
  const kn = (x: string) => (dil === "tr" ? kategoriAdi(x, kategoriler) : kategoriGoster(dil, x, kategoriler));
  const kat = kn(urun.category), altKat = urun.subcategory && kn(urun.subcategory).toLocaleLowerCase("tr-TR") !== kat.toLocaleLowerCase("tr-TR") ? kn(urun.subcategory) : "";
  const resimler = [urun.image_url, ...(urun.images || [])].filter((x, i, a) => typeof x === "string" && x.startsWith("https://") && a.indexOf(x) === i);
  const kareler360 = (urun.gorunum_360 || []).filter(x => typeof x === "string" && x.startsWith("https://"));
  const metin = aciklama(urun, dil);
  const ozellikler = Object.entries(urun.specs || {});
  const diller = mevcutDiller(urun);
  const urunAdi = ad(urun, dil);
  // Dil değiştirici bu ürünün sayfasında kalmalı: her zaman aynı ürünün o dildeki sayfasına gider
  // (çevirisi yoksa açıklama Türkçe'ye düşer, bkz. aciklama()) — önceden hem Header'ın varsayılanı
  // ana sayfaya yönlendiriyordu, hem de çevirisiz ürünlerde o dildeki sayfa hiç üretilmiyordu.
  const altDiller = Object.fromEntries(DILLER.map(d => [d, urunLinki(urun, d)])) as Partial<Record<Dil, string>>;
  const wa = (settings?.whatsapp || "+90 535 761 65 24").replace(/\D/g, "");
  const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(T.wamesaj(urunAdi, urun.code))}`;

  return (
    <div lang={HREFLANG[dil]} dir={rtl ? "rtl" : "ltr"}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdMetni(urunJsonLd(urun, dil, kat)) }} />
      <HtmlLang dil={dil} />
      {/* Önceden bu sayfanın kendi, ayrı/sadeleştirilmiş bir header'ı vardı (eski metin logo, mega menü
          ve dil seçici yoktu) — site genelindeki Header ile senkron değildi. Artık paylaşılan Header
          kullanılıyor, böylece logo/mega menü/dil seçici güncellemeleri her sayfada aynı anda geçerli olur. */}
      <Header settings={settings} dil={dil} altDiller={altDiller} />

      <main className="pt-[84px]">
        <div style={{ paddingInline: "clamp(20px,5vw,80px)", paddingBlock: "clamp(24px,4vw,56px)" }}>
          <nav aria-label="breadcrumb" className="eyebrow text-[#6b7366] mb-6 flex flex-wrap gap-2">
            <Link href={dilYolu(dil)} className="hover:text-[#0b0e0b]">{T.anasayfa}</Link><span>/</span>
            <Link href={bolumYolu(dil, "collection")} className="hover:text-[#0b0e0b]">{T.urunler}</Link><span>/</span>
            <span className="text-[#0b0e0b]">{urunAdi}</span>
          </nav>

          <div className="grid gap-10 grid-cols-1 min-w-0 lg:grid-cols-2 lg:gap-16">
            <UrunGaleri model3dUrl={urun.model_3d_url} kareler360={kareler360} resimler={resimler} renkler={urun.renkler} alt={`${urunAdi} — ${urun.code}`} />

            <div className="min-w-0">
              <p className="eyebrow text-[#e55f28] mb-3">{kat}{altKat ? ` · ${altKat}` : ""}{urun.is_new && <span className="ms-2 text-white bg-[#e55f28] px-1.5">{T.yeni}</span>}</p>
              <h1 className="heading text-[#0b0e0b]" style={{ fontSize: "clamp(38px,6vw,76px)", lineHeight: 0.95 }}><span lang={HREFLANG[dil]} dir="ltr">{urunAdi}</span></h1>
              <p className="eyebrow text-[#6b7366] mt-3">{T.kod}: <span dir="ltr" className="text-[#0b0e0b]">{urun.code}</span></p>
              {metin && <p className="text-[#3c4238] leading-relaxed mt-6" style={{ fontSize: "clamp(15px,1.6vw,17px)", maxWidth: "60ch", whiteSpace: "pre-line" }}>{metin}</p>}

              {ozellikler.length > 0 && (
                <div className="mt-8">
                  <h2 className="eyebrow text-[#6b7366] mb-3">{T.ozellikler}</h2>
                  <dl className="border-t border-[#0b0e0b]/15">
                    {ozellikler.slice(0, 20).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-6 py-2.5 border-b border-[#0b0e0b]/15 text-sm"><dt className="text-[#6b7366]">{ozellikEtiketi(k, dil)}</dt><dd dir="ltr" className="text-[#0b0e0b] font-medium text-end">{v}</dd></div>))}
                  </dl>
                </div>)}

              {/* Kutu/koli bilgisi — eski siteden (alyaplastik.com/products/N) taşınan "Ürün Bilgisi"
                  tablosu. Sadece veritabanında paket_bilgisi kaydı olan (eşleşmesi doğrulanmış)
                  ürünlerde gösterilir; her satır aynı modelin farklı kutu/beden seçeneğini temsil eder. */}
              {urun.paket_bilgisi && urun.paket_bilgisi.length > 0 && (
                <div className="mt-8">
                  <h2 className="eyebrow text-[#6b7366] mb-3">{T.paketBaslik}</h2>
                  <div className="overflow-x-auto border border-[#0b0e0b]/15">
                    <table className="w-full text-sm" dir="ltr">
                      <thead>
                        <tr className="border-b border-[#0b0e0b]/15 bg-[#0b0e0b]/[0.03]">
                          <th className="text-start font-semibold text-[#6b7366] px-3 py-2.5 whitespace-nowrap">{T.paketKod}</th>
                          <th className="text-start font-semibold text-[#6b7366] px-3 py-2.5 whitespace-nowrap">{T.paketAdet}</th>
                          <th className="text-start font-semibold text-[#6b7366] px-3 py-2.5 whitespace-nowrap">{T.paketKutuHacmi}</th>
                          <th className="text-start font-semibold text-[#6b7366] px-3 py-2.5 whitespace-nowrap">{T.paketKutuAgirligi}</th>
                          <th className="text-start font-semibold text-[#6b7366] px-3 py-2.5 whitespace-nowrap">{T.paketOlculer}</th>
                          <th className="text-start font-semibold text-[#6b7366] px-3 py-2.5 whitespace-nowrap">{T.paketHacim}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {urun.paket_bilgisi.slice(0, 20).map((p, i) => (
                          <tr key={p.kod || i} className="border-b border-[#0b0e0b]/10 last:border-b-0">
                            <td className="px-3 py-2.5 font-medium text-[#0b0e0b] whitespace-nowrap">{p.kod}</td>
                            <td className="px-3 py-2.5 text-[#0b0e0b]">{p.adet}</td>
                            <td className="px-3 py-2.5 text-[#0b0e0b]">{p.kutu_hacmi}</td>
                            <td className="px-3 py-2.5 text-[#0b0e0b]">{p.kutu_agirligi}</td>
                            <td className="px-3 py-2.5 text-[#0b0e0b] whitespace-nowrap">{p.olculer}</td>
                            <td className="px-3 py-2.5 text-[#0b0e0b]">{p.hacim}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>)}

              {urun.tags?.length > 0 && <p className="mt-6 flex flex-wrap gap-2">{urun.tags.slice(0, 12).map(t => <span key={t} className="eyebrow text-[#6b7366] border border-[#0b0e0b]/15 px-2 py-1">{etiketAdi(t, dil)}</span>)}</p>}

              <div className="mt-10 p-5 bg-[#0b0e0b] text-[#eae6dd]">
                <p className="text-sm mb-4 opacity-80">{T.b2b}</p>
                <div className="flex flex-wrap gap-3">
                  <TeklifModal urun={urun} dil={dil} className="eyebrow text-white bg-[#e55f28] hover:bg-[#c94f1e] px-5 py-3 transition-colors">{T.teklif}</TeklifModal>
                  <a href={waUrl} target="_blank" rel="noopener noreferrer nofollow" className="eyebrow text-white border border-white/30 hover:border-white px-5 py-3 transition-colors">{T.whatsapp}</a>
                </div>
              </div>

              {diller.length > 1 && (
                <p className="mt-6 flex flex-wrap items-center gap-3 text-sm"><span className="eyebrow text-[#6b7366]">{T.dil}:</span>
                  {DILLER.filter(d => diller.includes(d)).map(d => d === dil
                    ? <span key={d} className="font-semibold">{DIL_AD[d]}</span>
                    : <Link key={d} href={urunYolu(d, urun.slug)} hrefLang={HREFLANG[d]} lang={HREFLANG[d]} className="text-[#6b7366] hover:text-[#e55f28] underline">{DIL_AD[d]}</Link>)}
                </p>)}
            </div>
          </div>

          {benzer.length > 0 && (
            <section className="mt-20" aria-labelledby="benzer">
              <h2 id="benzer" className="heading text-[#0b0e0b] mb-6" style={{ fontSize: "clamp(28px,4vw,48px)" }}>{T.benzer}</h2>
              <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {benzer.map(b => (
                  <li key={b.id}>
                    <Link href={urunYolu(mevcutDiller(b).includes(dil) ? dil : "tr", b.slug)} className="block bg-[#e3ddcf] hover:bg-[#d8d1c1] transition-colors">
                      {b.image_url?.startsWith("https://") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.image_url} alt={ad(b, dil)} loading="lazy" className="w-full aspect-square object-contain p-4" />
                      ) : (
                        <div className="w-full aspect-square flex items-center justify-center p-4 text-center text-[#0b0e0b]/40 font-semibold" aria-hidden="true">{b.code}</div>
                      )}
                      <span className="block p-3"><span className="eyebrow text-[#e55f28] block">{b.code}</span><span lang={HREFLANG[dil]} className="block font-semibold mt-1">{ad(b, dil)}</span></span>
                    </Link>
                  </li>))}
              </ul>
            </section>)}
        </div>
      </main>
      <Footer settings={settings} dil={dil} />
    </div>
  );
}
