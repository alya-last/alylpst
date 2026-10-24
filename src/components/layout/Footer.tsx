import { guvenliUrl, type Settings } from "@/lib/supabase";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";
import IletisimPopup from "@/components/sections/IletisimPopup";

export default function Footer({ settings, dil = "tr" }: { settings: Settings | null; dil?: Dil }) {
  const s = settings, m = M[dil].altbilgi;
  const email = s?.email ?? "info@alyaplastik.com", exportEmail = s?.export_email ?? "export@alyaplastik.com", phone = s?.phone ?? "+90 212 671 85 65";
  const cols = [
    ...m.kolonlar.map(k => ({ title: k.baslik, items: k.ogeler })),
    { title: m.iletisimBaslik, items: [
      { ad: email, href: `mailto:${email}` },
      { ad: exportEmail, href: `mailto:${exportEmail}` },
      { ad: phone, href: `tel:${phone.replace(/\D/g, "")}` },
      { ad: m.adres, href: "" },
    ] },
  ];
  const wa = s?.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g,"")}` : "https://wa.me/905357616524";

  const sosyal = [
    { ad: "LinkedIn", url: guvenliUrl(s?.linkedin) },
    { ad: "Instagram", url: guvenliUrl(s?.instagram) },
    { ad: "Facebook", url: guvenliUrl(s?.facebook) },
  ].filter((x): x is { ad: string; url: string } => !!x.url);

  return (
    <footer className="relative grain overflow-hidden bg-[#0b0e0b]" data-bg="#0b0e0b"
      style={{ paddingTop:"clamp(64px,8vw,110px)", paddingBottom:"clamp(28px,4vw,40px)" }}>

      {/* Üst turuncu çizgi — sitedeki bölüm ayraçlarıyla aynı dil */}
      <div className="absolute left-0 right-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, #e55f28 25%, #e55f28 75%, transparent)" }} />

      {/* Dev arka plan yazısı — dekoratif, tıklanamaz */}
      <p aria-hidden="true" className="heading absolute pointer-events-none select-none whitespace-nowrap"
        style={{ left: "clamp(-10px,-1vw,0px)", bottom: "clamp(-52px,-6vw,-18px)", fontSize: "clamp(110px,17vw,280px)", color: "transparent", WebkitTextStroke: "1px rgba(234,230,221,0.07)", lineHeight: 1 }}>
        ALYA PLASTİK
      </p>

      <div className="relative z-10" style={{ paddingInline:"clamp(20px,5vw,80px)" }}>
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12 lg:gap-20 mb-16">
          <div>
            <div className="mb-5 flex items-baseline gap-2">
              <span className="heading text-[#eae6dd] text-[30px] leading-none">ALYA<span className="text-[#e55f28]">.</span></span>
              <span className="eyebrow text-[#6b7366] text-[9px]">Plastik San.</span>
            </div>
            <p className="text-[#9a9790] font-light leading-loose text-sm mb-2" style={{ maxWidth: 300 }}>
              {m.lider(s?.founded ?? 1968)}
            </p>
            <p className="text-[#6b7366] font-light text-sm mb-7">
              {m.dunyaya(dil === "tr" ? (s?.address?.split(",")[1]?.trim() ?? m.varsayilanYer) : m.varsayilanYer)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href={wa} target="_blank" rel="noopener noreferrer nofollow"
                className="anim-magnetic inline-flex items-center gap-2 bg-[#e55f28] hover:bg-[#c94f1e] text-white text-[10px] font-semibold tracking-[0.14em] uppercase px-5 py-3 transition-colors">
                WhatsApp →
              </a>
              <IletisimPopup settings={s} dil={dil} label={`${m.iletisimBaslik} →`}
                className="anim-magnetic inline-flex items-center gap-2 border border-[#eae6dd]/15 hover:border-[#e55f28] text-[#eae6dd] text-[10px] font-semibold tracking-[0.14em] uppercase px-5 py-3 transition-colors" />
            </div>
            {sosyal.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-7">
                {sosyal.map(x => (
                  <a key={x.ad} href={x.url} target="_blank" rel="noopener noreferrer me" aria-label={`Alya Plastik ${x.ad}`}
                    className="eyebrow text-[10px] text-[#6b7366] hover:text-[#e55f28] transition-colors">{x.ad} ↗</a>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-8">
            {cols.map(col => (
              <div key={col.title}>
                <p className="eyebrow text-[#e55f28] text-[10px] mb-4">{col.title}</p>
                {col.items.map(item => item.href ? (
                  <a key={item.ad} href={item.href} className="group relative block w-fit text-[#9a9790] hover:text-[#eae6dd] transition-colors text-sm mb-2.5 leading-snug">
                    {item.ad}
                    <span className="absolute left-0 -bottom-0.5 h-px w-0 bg-[#e55f28] transition-all duration-300 group-hover:w-full" />
                  </a>
                ) : (
                  <p key={item.ad} className="text-[#6b7366] text-sm mb-2.5 leading-snug">{item.ad}</p>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#eae6dd]/10 pt-6 flex flex-wrap justify-between items-center gap-3">
          <p className="eyebrow text-[#6b7366] text-[10px]">
            © {new Date().getFullYear()} {s?.company ?? "Alya Plastik San. Tic. Ltd. Şti."} — {m.haklar}
          </p>
          <div className="flex items-center gap-5">
            <p className="eyebrow text-[#6b7366] text-[10px]">{m.yerel}</p>
            <a href="#hero" aria-label="Başa dön"
              className="anim-magnetic flex items-center justify-center w-8 h-8 rounded-full border border-[#eae6dd]/15 hover:border-[#e55f28] hover:text-[#e55f28] text-[#9a9790] transition-colors text-xs">
              ↑
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
