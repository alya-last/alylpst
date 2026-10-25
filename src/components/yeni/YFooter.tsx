import Link from "next/link";
import { Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { guvenliUrl, type Settings } from "@/lib/supabase";
import { type Dil, kurumsalYolu } from "@/lib/diller";
import { M, dilYolu } from "@/lib/site-metin";
import { Y } from "./metin";

// lucide-react bu sürümde marka ikonları içermiyor: basit satır içi SVG'ler
const Ikon = ({ d, size = 19 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
const Instagram = ({ size }: { size?: number }) => <Ikon size={size} d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />;
const Facebook = ({ size }: { size?: number }) => <Ikon size={size} d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.95.4-1.7 1.8-1.7H17V3.8c-.3 0-1.3-.1-2.4-.1-2.5 0-4.1 1.5-4.1 4.2v2.6H7.7v3.3h2.8V22h3Z" />;
const Linkedin = ({ size }: { size?: number }) => <Ikon size={size} d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.8v1.55h.05c.55-1 1.9-1.9 3.9-1.9 4.1 0 4.75 2.55 4.75 5.85V21h-4v-5.2c0-1.25 0-2.85-1.75-2.85S13.5 14.3 13.5 15.7V21h-4V9.75Z" />;

const EK: Record<Dil, { slogan: string; ctaBaslik: string; ctaAlt: string; wa: string; kategoriler: string; calisma: string; ihracat: string }> = {
  tr: { slogan: "1968'den beri İstanbul'da plastik saksı, sepet ve depolama ürünleri üretiyoruz.", ctaBaslik: "Toptan sipariş ve özel üretim için bize ulaşın", ctaAlt: "Teklifiniz 72 saat içinde hazır.", wa: "WhatsApp'tan yaz", kategoriler: "Ürün Grupları", calisma: "Çalışma saatleri", ihracat: "İhracat" },
  en: { slogan: "Manufacturing plastic pots, baskets and storage products in Istanbul since 1968.", ctaBaslik: "Contact us for wholesale orders and custom production", ctaAlt: "Your quote is ready within 72 hours.", wa: "Message on WhatsApp", kategoriler: "Product Groups", calisma: "Working hours", ihracat: "Export" },
  ru: { slogan: "С 1968 года производим пластиковые горшки, корзины и системы хранения в Стамбуле.", ctaBaslik: "Свяжитесь с нами по вопросам опта и индивидуального производства", ctaAlt: "Предложение будет готово в течение 72 часов.", wa: "Написать в WhatsApp", kategoriler: "Группы товаров", calisma: "Часы работы", ihracat: "Экспорт" },
  zh: { slogan: "自1968年起在伊斯坦布尔生产塑料花盆、篮子和收纳产品。", ctaBaslik: "批发订单和定制生产，欢迎联系我们", ctaAlt: "72小时内提供报价。", wa: "WhatsApp 咨询", kategoriler: "产品分类", calisma: "营业时间", ihracat: "出口" },
};

export default function YFooter({ settings, dil = "tr", kategoriler = [] }: { settings: Settings | null; dil?: Dil; kategoriler?: { k: string; adet: number }[] }) {
  const t = Y[dil], e = EK[dil], s = settings;
  const kat = M[dil].kategori as Record<string, string>;
  const phone = s?.phone ?? "+90 212 671 85 65", email = s?.email ?? "info@alyaplastik.com", exp = s?.export_email ?? "export@alyaplastik.com";
  const waNo = s?.whatsapp ?? "+90 535 761 65 24", wa = `https://wa.me/${waNo.replace(/\D/g, "")}`;
  const sosyal = [
    { a: "Instagram", I: Instagram, u: guvenliUrl(s?.instagram) },
    { a: "Facebook", I: Facebook, u: guvenliUrl(s?.facebook) },
    { a: "LinkedIn", I: Linkedin, u: guvenliUrl(s?.linkedin) },
  ].filter(x => x.u);
  const iletisim = `${dilYolu(dil)}#iletisim`.replace("//", "/");
  const urun = kurumsalYolu(dil, "urunler");

  return (
    <footer className="bg-[#232323] text-white/80">
      {/* Çağrı bandı */}
      <div className="bg-[var(--yt-accent)] text-white">
        <div className="yt-wrap flex flex-wrap items-center justify-between gap-5 py-9">
          <div>
            <h2 className="font-semibold tracking-[-0.01em]" style={{ fontSize: "clamp(22px,2.6vw,34px)" }}>{e.ctaBaslik}</h2>
            <p className="text-white/85 mt-1.5">{e.ctaAlt}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={iletisim} className="inline-flex items-center bg-white text-[#1b1b1b] font-semibold px-6 py-3.5 rounded-[10px] hover:bg-white/90 transition-colors">{t.nav.teklif}</a>
            <a href={wa} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 border border-white/80 font-semibold px-6 py-3.5 rounded-[10px] hover:bg-white/15 transition-colors"><MessageCircle size={18} />{e.wa}</a>
          </div>
        </div>
      </div>

      <div className="yt-wrap grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]" style={{ paddingBlock: "clamp(48px,6vw,80px)" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Alya Plastik" className="h-[38px] w-auto mb-5" />
          <p className="max-w-[340px] leading-relaxed text-white/70">{e.slogan}</p>
          {sosyal.length > 0 && (
            <div className="flex gap-3 mt-6">
              {sosyal.map(x => (
                <a key={x.a} href={x.u!} target="_blank" rel="noopener noreferrer" aria-label={x.a}
                  className="w-11 h-11 rounded-full border border-white/25 flex items-center justify-center hover:bg-[var(--yt-accent)] hover:border-[var(--yt-accent)] hover:text-white transition-colors"><x.I size={19} /></a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-bold text-white mb-5">{t.alt.kurumsal}</h3>
          <ul className="space-y-3">
            {[[t.hakkimizdaAd, kurumsalYolu(dil, "hakkimizda")], [t.uretimAd, kurumsalYolu(dil, "uretim-sureci")], [t.sertifikaAd, kurumsalYolu(dil, "sertifikalar")], [t.katalogAd, kurumsalYolu(dil, "katalog")], ["KVKK", kurumsalYolu(dil, "kvkk")]].map(([a, h]) => (
              <li key={a}><Link href={h} className="hover:text-white transition-colors">{a}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-white mb-5">{e.kategoriler}</h3>
          <ul className="space-y-3">
            {kategoriler.map(c => <li key={c.k}><a href={`${urun}?kategori=${c.k}`} className="hover:text-white transition-colors">{kat[c.k] ?? c.k}</a></li>)}
            <li><a href={iletisim} className="hover:text-white transition-colors">{t.alt.ozel}</a></li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-white mb-5">{t.alt.iletisim}</h3>
          <ul className="space-y-4">
            <li className="flex gap-3"><MapPin size={18} className="shrink-0 mt-1 text-[var(--yt-accent)]" /><span className="leading-relaxed">{s?.address ?? "İkitelli OSB 4B Blok No:26-28 Kat:2, Başakşehir / İstanbul"}</span></li>
            <li className="flex gap-3"><Phone size={18} className="shrink-0 mt-1 text-[var(--yt-accent)]" /><a href={`tel:${phone.replace(/\D/g, "")}`} className="font-semibold text-white">{phone}</a></li>
            <li className="flex gap-3"><MessageCircle size={18} className="shrink-0 mt-1 text-[var(--yt-accent)]" /><a href={wa} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-white">WhatsApp: {waNo}</a></li>
            <li className="flex gap-3"><Mail size={18} className="shrink-0 mt-1 text-[var(--yt-accent)]" /><span><a href={`mailto:${email}`} className="hover:text-white block">{email}</a><a href={`mailto:${exp}`} className="hover:text-white block mt-1">{e.ihracat}: {exp}</a></span></li>
            <li className="flex gap-3"><Clock size={18} className="shrink-0 mt-1 text-[var(--yt-accent)]" /><span>{s?.working_hours ?? "Pzt–Cum 08:30–17:30"}</span></li>
          </ul>
        </div>
      </div>

      {/* Alt çubuk — sağ altta yüzen WhatsApp/sohbet düğmeleri yazıyı kapatmasın diye alt boşluk */}
      <div className="border-t border-white/12">
        <div className="yt-wrap pt-5 pb-24 md:pb-20 text-[14px] text-white/55 flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Alya Plastik · {t.alt.haklar}</span>
          <span>İstanbul OSB · Made in Türkiye 🇹🇷</span>
        </div>
      </div>
    </footer>
  );
}
