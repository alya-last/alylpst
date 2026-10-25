"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Menu, X, Phone } from "lucide-react";
import type { Settings, Product } from "@/lib/supabase";
import { DILLER, type Dil, kurumsalYolu, urunLinki, ad } from "@/lib/diller";
import { dilYolu } from "@/lib/site-metin";
import { Y } from "./metin";

const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/g, " ").trim();

export default function YHeader({ settings, dil = "tr", urunler, altDiller }: { settings: Settings | null; dil?: Dil; urunler: Product[]; altDiller?: Partial<Record<Dil, string>> }) {
  const t = Y[dil];
  const [q, setQ] = useState("");
  const [acik, setAcik] = useState(false);
  const phone = settings?.phone ?? "+90 212 671 85 65";
  const sonuc = useMemo(() => {
    const n = norm(q);
    if (n.length < 2) return [];
    return urunler.filter(p => norm(`${ad(p, dil)} ${p.code}`).includes(n)).slice(0, 6);
  }, [q, urunler, dil]);
  const bolum = (k: string) => `${dilYolu(dil)}#${k}`.replace("//", "/");
  const nav = [
    { href: dilYolu(dil), label: t.nav.anasayfa },
    { href: kurumsalYolu(dil, "hakkimizda"), label: t.nav.kurumsal },
    { href: kurumsalYolu(dil, "urunler"), label: t.nav.urunler },
    { href: kurumsalYolu(dil, "katalog"), label: t.nav.katalog },
    { href: bolum("iletisim"), label: t.nav.iletisim },
  ];

  return (
    <header className="sticky top-0 z-[80] bg-white">
      <div className="bg-[#232323] text-white/85 text-[13px]">
        <div className="yt-wrap flex items-center justify-between h-10">
          <nav className="hidden md:flex items-center gap-7">
            <Link href={kurumsalYolu(dil, "hakkimizda")} className="hover:text-white">{t.ustLink.hakkimizda}</Link>
            <Link href={kurumsalYolu(dil, "uretim-sureci")} className="hover:text-white">{t.ustLink.uretim}</Link>
            <Link href={kurumsalYolu(dil, "sertifikalar")} className="hover:text-white">{t.ustLink.sertifika}</Link>
            <Link href={kurumsalYolu(dil, "katalog")} className="hover:text-white">{t.ustLink.katalog}</Link>
          </nav>
          <div className="flex items-center gap-5 ms-auto">
            <a href={`tel:${phone.replace(/\D/g, "")}`} className="hidden sm:inline-flex items-center gap-1.5 hover:text-white"><Phone size={13} />{phone}</a>
            <div className="flex items-center gap-2.5 font-medium">
              {DILLER.map(d => d === dil
                ? <span key={d} className="text-[var(--yt-accent)] font-bold">{d.toUpperCase()}</span>
                : <Link key={d} href={altDiller?.[d] ?? dilYolu(d)} className="hover:text-white">{d.toUpperCase()}</Link>)}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-black/8">
        <div className="yt-wrap flex items-center gap-6 h-[84px]">
          <Link href={dilYolu(dil)} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Alya Plastik" className="h-[34px] md:h-[42px] w-auto" />
          </Link>

          <div className="relative hidden lg:block flex-1 max-w-[420px]">
            <div className="flex items-center gap-2 border-b border-black/70 h-10">
              <Search size={17} className="text-black/50" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.nav.ara} aria-label={t.nav.ara}
                className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-black/40" />
            </div>
            {q.trim().length >= 2 && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-black/10 rounded-xl shadow-xl overflow-hidden">
                {sonuc.length ? sonuc.map(p => (
                  <li key={p.id}>
                    <Link href={urunLinki(p, dil)} onClick={() => setQ("")} className="flex items-center gap-3 px-3 py-2 hover:bg-black/[0.04]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image_url} alt="" className="w-10 h-10 object-contain rounded bg-[#f4f4f2]" />
                      <span className="text-[14px] font-medium">{ad(p, dil)}</span>
                      <span className="ms-auto text-[12px] text-black/45">{p.code}</span>
                    </Link>
                  </li>
                )) : <li className="px-4 py-3 text-[14px] text-black/50">{t.nav.sonucYok}</li>}
              </ul>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-7 ms-auto">
            {nav.map(l => <a key={l.label} href={l.href} className="text-[16px] font-semibold text-[#1b1b1b] hover:text-[var(--yt-accent)] transition-colors">{l.label}</a>)}
          </nav>
          <a href={bolum("iletisim")} className="hidden md:inline-flex yt-btn">{t.nav.teklif}</a>

          <button onClick={() => setAcik(p => !p)} aria-label={t.nav.menu} className="md:hidden ms-auto w-10 h-10 flex items-center justify-center">
            {acik ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {acik && (
        <div className="md:hidden absolute inset-x-0 top-full bg-white border-b border-black/10 shadow-lg">
          <div className="yt-wrap py-4 flex flex-col">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.nav.ara} className="border-b border-black/30 h-11 mb-2 bg-transparent outline-none" />
            {sonuc.map(p => <Link key={p.id} href={urunLinki(p, dil)} className="py-2 text-[15px]">{ad(p, dil)} <span className="text-black/40 text-[12px]">{p.code}</span></Link>)}
            {nav.map(l => <a key={l.label} href={l.href} onClick={() => setAcik(false)} className="py-3 text-[18px] font-semibold border-b border-black/6">{l.label}</a>)}
            <a href={bolum("iletisim")} onClick={() => setAcik(false)} className="yt-btn mt-4 justify-center">{t.nav.teklif}</a>
          </div>
        </div>
      )}
    </header>
  );
}
