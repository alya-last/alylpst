import Link from "next/link";
import { guvenliUrl, type Settings } from "@/lib/supabase";
import { type Dil, kurumsalYolu } from "@/lib/diller";
import { dilYolu } from "@/lib/site-metin";
import { Y } from "./metin";

export default function YFooter({ settings, dil = "tr" }: { settings: Settings | null; dil?: Dil }) {
  const t = Y[dil], s = settings;
  const phone = s?.phone ?? "+90 212 671 85 65", email = s?.email ?? "info@alyaplastik.com";
  const wa = s?.whatsapp ?? "+90 535 761 65 24";
  const sosyal = [["Instagram", s?.instagram], ["Facebook", s?.facebook], ["LinkedIn", s?.linkedin]]
    .map(([a, u]) => ({ a: a as string, u: guvenliUrl(u as string | undefined) })).filter(x => x.u);
  const kol = [
    { b: t.alt.kurumsal, l: [[t.hakkimizdaAd, kurumsalYolu(dil, "hakkimizda")], [t.uretimAd, kurumsalYolu(dil, "uretim-sureci")], [t.sertifikaAd, kurumsalYolu(dil, "sertifikalar")], ["KVKK", kurumsalYolu(dil, "kvkk")]] },
    { b: t.alt.urunler, l: [[t.alt.tum, `${dilYolu(dil)}#urunler`.replace("//", "/")], [t.katalogAd, kurumsalYolu(dil, "katalog")], [t.alt.ozel, `${dilYolu(dil)}#iletisim`.replace("//", "/")]] },
  ];
  return (
    <footer className="bg-[#232323] text-white/85">
      <div className="yt-wrap grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]" style={{ paddingBlock: "clamp(48px,6vw,80px)" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Alya Plastik" className="h-[34px] w-auto mb-5" />
          <p className="max-w-[320px] leading-relaxed">{s?.address ?? "İstanbul Başakşehir OSB"}</p>
          <a href={`tel:${phone.replace(/\D/g, "")}`} className="block mt-4 font-semibold text-white">{phone}</a>
          <p className="mt-1">WhatsApp: {wa}</p>
          <a href={`mailto:${email}`} className="block mt-1 hover:text-white">{email}</a>
        </div>
        {kol.map(c => (
          <div key={c.b}>
            <h3 className="font-bold text-white mb-4">{c.b}</h3>
            <ul className="space-y-3">{c.l.map(([a, h]) => <li key={a}><Link href={h} className="hover:text-white">{a}</Link></li>)}</ul>
          </div>
        ))}
        <div>
          <h3 className="font-bold text-white mb-4">{t.alt.iletisim}</h3>
          <ul className="space-y-3">
            <li><a href={`mailto:${s?.export_email ?? "export@alyaplastik.com"}`} className="hover:text-white">{s?.export_email ?? "export@alyaplastik.com"}</a></li>
            {sosyal.map(x => <li key={x.a}><a href={x.u!} target="_blank" rel="noopener noreferrer" className="hover:text-white">{x.a}</a></li>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/12">
        <div className="yt-wrap py-5 text-[14px] text-white/60 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} Alya Plastik · {t.alt.haklar}</span>
          <span>İstanbul OSB · Made in Türkiye</span>
        </div>
      </div>
    </footer>
  );
}
