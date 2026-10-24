"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, Globe, Check } from "lucide-react";
import type { Settings } from "@/lib/supabase";
import { DILLER, DIL_AD, HREFLANG, type Dil } from "@/lib/diller";
import { M, dilYolu, bolumYolu } from "@/lib/site-metin";
import MegaMenu from "@/components/layout/MegaMenu";

// Dil koduna karşılık bayrak emojisi (İngilizce için nötr/uluslararası bir seçim olarak İngiltere bayrağı kullanılmıyor,
// dünya genelinde "İngilizce" için en yaygın kabul gören seçenek olduğundan GB bayrağı tercih edildi).
const BAYRAK: Record<Dil, string> = { tr: "🇹🇷", en: "🇬🇧", ru: "🇷🇺", zh: "🇨🇳" };

// Modül seviyesinde tanımlı: render içinde tanımlanırsa Header her state değişikliğinde
// (scroll, menü aç/kapa) bu bileşeni yeniden yaratır ve React onu gereksiz yere unmount/remount eder.
// Bayraklı, açılır panel şeklinde "premium" dil seçici — önceki hali düz metin linkleriydi.
function DilSecici({ dil, ariaLabel, dark, altDiller }: { dil: Dil; ariaLabel: string; dark?: boolean; altDiller?: Partial<Record<Dil, string>> }) {
  const [acik, setAcik] = useState(false);
  const kutuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!acik) return;
    const disaTikla = (e: MouseEvent) => { if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) setAcik(false); };
    const escTusu = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    document.addEventListener("mousedown", disaTikla);
    document.addEventListener("keydown", escTusu);
    return () => { document.removeEventListener("mousedown", disaTikla); document.removeEventListener("keydown", escTusu); };
  }, [acik]);

  return (
    <div ref={kutuRef} className="relative" aria-label={ariaLabel}>
      <button type="button" onClick={() => setAcik(p => !p)} aria-expanded={acik} aria-haspopup="listbox"
        className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 border rounded-full transition-colors duration-200 ${
          dark ? "border-white/15 hover:border-white/35 text-white" : "border-white/15 hover:border-white/35 text-white"
        }`}>
        <Globe size={13} strokeWidth={1.75} className="opacity-70" />
        <span className="text-[15px] leading-none">{BAYRAK[dil]}</span>
        <span className="eyebrow text-[10px]">{dil.toUpperCase()}</span>
        <ChevronDown size={12} strokeWidth={2} className={`opacity-60 transition-transform duration-200 ${acik ? "rotate-180" : ""}`} />
      </button>

      <ul role="listbox" aria-label={ariaLabel}
        className={`absolute end-0 min-w-[168px] py-1.5 bg-[#0b0e0b] border border-white/12 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.45)] transition-all duration-150 z-10 ${
          dark ? "bottom-[calc(100%+8px)] origin-bottom-right" : "top-[calc(100%+8px)] origin-top-right"
        }`}
        style={{ opacity: acik ? 1 : 0, transform: acik ? "scale(1)" : "scale(0.96)", pointerEvents: acik ? "auto" : "none" }}>
        {DILLER.map(d => (
          <li key={d} role="option" aria-selected={d === dil}>
            {d === dil ? (
              <span className="flex items-center gap-2.5 px-3.5 py-2 text-white">
                <span className="text-[16px] leading-none">{BAYRAK[d]}</span>
                <span className="eyebrow text-[11px] flex-1">{DIL_AD[d]}</span>
                <Check size={14} strokeWidth={2.5} className="text-[#e55f28]" />
              </span>
            ) : (
              <Link href={altDiller?.[d] ?? dilYolu(d)} hrefLang={HREFLANG[d]} lang={HREFLANG[d]} onClick={() => setAcik(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-[#9aa294] hover:text-white hover:bg-white/5 transition-colors">
                <span className="text-[16px] leading-none">{BAYRAK[d]}</span>
                <span className="eyebrow text-[11px]">{DIL_AD[d]}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// altDiller: geçerli sayfanın diğer dillerdeki karşılığı (ör. ürün sayfasında aynı ürünün çevirisi).
// Verilmezse (ör. katalog, hakkımızda gibi yalnızca Türkçe var olan sayfalarda) dil değiştirici o dilin
// ana sayfasına yönlendirir — bu sayfaların başka dilde karşılığı yoktur.
export default function Header({ settings, dil = "tr", altDiller }: { settings: Settings | null; dil?: Dil; altDiller?: Partial<Record<Dil, string>> }) {
  const m = M[dil];
  // "Ürünler" mega menü olarak ayrı render ediliyor (bkz. aşağı); geri kalanı düz link.
  const NAV = [
    { href: bolumYolu(dil, "collection"), label: m.nav.koleksiyon },
    { href: bolumYolu(dil, "why"),        label: m.nav.neden },
    { href: bolumYolu(dil, "contact"),    label: m.nav.iletisim },
  ];
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const wa = settings?.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/\D/g,"")}` : "https://wa.me/905357616524";

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    fn(); window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-80 flex items-center h-[84px] transition-all duration-500"
        style={{ paddingInline: "clamp(20px,5vw,80px)", paddingTop: 14, paddingBottom: 14 }}>

        <div className={`relative w-full h-full flex items-center justify-between rounded-full backdrop-blur-xl transition-all duration-500 border ${
          scrolled || open ? "bg-[#0b0e0b]/92 border-white/10 shadow-[0_10px_34px_rgba(0,0,0,0.32)]" : "bg-[#0b0e0b]/85 border-white/10"
        }`} style={{ paddingInline: "clamp(16px,3vw,28px)" }}>

          <Link href={dilYolu(dil)} className="flex items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="Alya Plastik" className="h-[20px] md:h-[24px] w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
            <MegaMenu dil={dil} kategoriAd={m.kategori} label={m.nav.urunler} />
            {NAV.map(l => (
              <a key={l.href} href={l.href} className="eyebrow text-white/80 hover:text-white transition-colors duration-200" style={{ fontSize: 12.5 }}>
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:block ms-auto me-5">
            <DilSecici dil={dil} ariaLabel={m.dil} altDiller={altDiller} />
          </div>
          <a href={wa} target="_blank" rel="noopener noreferrer nofollow"
            className="hidden md:inline-flex items-center gap-2 bg-[#e55f28] hover:bg-[#c94f1e] text-white text-[10px] font-semibold tracking-[0.14em] uppercase px-5 py-2.5 rounded-full transition-colors shrink-0">
            {m.nav.teklif}
          </a>

          <button onClick={() => setOpen(p => !p)} aria-label={m.nav.menu}
            className="md:hidden flex flex-col items-end justify-center gap-1.5 w-10 h-10 shrink-0">
            {[0,1,2].map(i => (
              <span key={i} className="block h-[1.5px] bg-[#eae6dd] rounded-sm transition-all duration-300"
                style={{ width: i===1?(open?0:18):26, opacity:i===1&&open?0:1,
                  transform: i===0&&open?"rotate(45deg) translate(5px,5px)":i===2&&open?"rotate(-45deg) translate(5px,-5px)":"none" }} />
            ))}
          </button>
        </div>
      </header>

      <div className={`fixed inset-0 z-79 md:hidden flex flex-col justify-between transition-opacity duration-350 ${open?"opacity-100 pointer-events-auto":"opacity-0 pointer-events-none"}`}
        style={{ paddingTop:84, paddingInline:"clamp(20px,5vw,80px)", paddingBottom:32, background:"rgba(11,14,11,0.97)", backdropFilter:"blur(20px)" }}>
        <nav className="pt-6">
          {NAV.map((l, i) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="heading block border-b border-white/8 py-4 text-[#6b7366] hover:text-white transition-colors"
              style={{ fontSize:"clamp(36px,9vw,52px)", opacity:open?1:0, transform:open?"none":"translateY(10px)",
                transition:`color .2s, opacity .35s ${i*.06}s, transform .35s ${i*.06}s` }}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex flex-col gap-3">
          <div className="flex justify-center pb-2">
            <DilSecici dil={dil} ariaLabel={m.dil} dark altDiller={altDiller} />
          </div>
          <a href={wa} target="_blank" rel="noopener noreferrer nofollow"
            className="flex items-center justify-center gap-2 bg-[#e55f28] text-white text-[10px] font-semibold tracking-[0.14em] uppercase py-4">
            {m.nav.waTeklif}
          </a>
          <a href={`tel:${settings?.phone?.replace(/\D/g,"") ?? "902126718565"}`}
            className="flex items-center justify-center border border-white/20 text-[#eae6dd] text-[10px] font-semibold tracking-[0.14em] uppercase py-4">
            {settings?.phone ?? "+90 212 671 85 65"}
          </a>
        </div>
      </div>
    </>
  );
}
