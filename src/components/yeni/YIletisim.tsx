"use client";
import { useState } from "react";
import { Mail, Phone, MessageCircle, MapPin, ArrowUpRight } from "lucide-react";
import type { Settings } from "@/lib/supabase";
import type { Dil } from "@/lib/diller";
import { M } from "@/lib/site-metin";

const GIRDI = "w-full bg-[#f5f5f2] border border-transparent focus:border-[var(--yt-accent)] focus:bg-white rounded-xl px-4 py-3.5 text-[16px] outline-none transition-colors";

export default function YIletisim({ settings, dil = "tr" }: { settings: Settings | null; dil?: Dil }) {
  const c = M[dil].iletisim;
  const s = settings;
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState("");
  const [error, setError] = useState("");
  const wa = s?.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g, "")}` : "https://wa.me/905357616524";
  const baslik = c.baslik.join(" ").toLocaleLowerCase(dil === "tr" ? "tr-TR" : dil).replace(/^./u, x => x.toLocaleUpperCase(dil === "tr" ? "tr-TR" : dil));

  const satirlar = [
    { i: Mail, l: c.eposta, v: s?.email ?? "info@alyaplastik.com", h: `mailto:${s?.email ?? "info@alyaplastik.com"}` },
    { i: Mail, l: c.ihracat, v: s?.export_email ?? "export@alyaplastik.com", h: `mailto:${s?.export_email ?? "export@alyaplastik.com"}` },
    { i: Phone, l: c.telefon, v: s?.phone ?? "+90 212 671 85 65", h: `tel:${s?.phone?.replace(/\D/g, "") ?? "902126718565"}` },
    { i: MessageCircle, l: c.whatsapp, v: s?.whatsapp ?? "+90 535 761 65 24", h: wa },
  ];

  const gonder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fd.get("name"), company: fd.get("company"), email: fd.get("email"), phone: fd.get("phone"), subject: sub, message: fd.get("message") }),
      });
      const { error: err } = await res.json();
      if (err) setError(c.hata); else setSent(true);
    } catch { setError(c.hata); }
    setLoading(false);
  };

  return (
    <section id="iletisim" className="bg-[#f5f5f2]" style={{ paddingBlock: "clamp(56px,7vw,100px)" }}>
      <span id="contact" />
      <div className="yt-wrap">
        <div className="mb-10">
          <p className="text-[13px] tracking-[0.2em] text-black/45 mb-3">{c.etiket.replace("—", "").trim().toUpperCase()}</p>
          <h2 className="font-semibold tracking-[-0.02em]" style={{ fontSize: "clamp(32px,4.4vw,56px)" }}>{baslik}</h2>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="bg-[#262626] text-white rounded-3xl" style={{ padding: "clamp(28px,4vw,52px)" }}>
            <p className="text-white/75 text-[17px] leading-relaxed max-w-[420px]">{c.aciklama}</p>
            <div className="mt-8 divide-y divide-white/12">
              {satirlar.map(r => (
                <a key={r.l} href={r.h} target={r.h.startsWith("http") ? "_blank" : undefined} rel={r.h.startsWith("http") ? "noopener noreferrer nofollow" : undefined}
                  className="flex items-center gap-4 py-4 group">
                  <span className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--yt-accent)] transition-colors"><r.i size={19} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-white/50">{r.l}</span>
                    <span className="block text-[17px] truncate">{r.v}</span>
                  </span>
                  <ArrowUpRight size={18} className="text-white/40 group-hover:text-white" />
                </a>
              ))}
            </div>
            <div className="mt-6 flex gap-3 text-white/65">
              <MapPin size={19} className="shrink-0 mt-0.5" />
              <address className="not-italic leading-relaxed">{s?.address ?? "İkitelli OSB 4B Blok No:26-28 Kat:2, Başakşehir / İstanbul"}<br /><span className="text-white/45">{s?.working_hours ?? "Pzt–Cum 08:30–17:30"}</span></address>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-black/6" style={{ padding: "clamp(28px,4vw,52px)" }}>
            {sent ? (
              <div className="flex flex-col justify-center items-start min-h-[320px]">
                <div className="w-16 h-16 rounded-full bg-[var(--yt-accent)] text-white flex items-center justify-center text-[30px] mb-5">✓</div>
                <h3 className="text-[32px] font-semibold mb-2">{c.alindi.replace(".", "")}</h3>
                <p className="text-black/60 text-[17px]">{c.alindiMesaj}</p>
              </div>
            ) : (
              <form onSubmit={gonder} className="flex flex-col gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="block text-[14px] font-medium mb-2">{c.ad}</span><input name="name" type="text" required className={GIRDI} /></label>
                  <label className="block"><span className="block text-[14px] font-medium mb-2">{c.firma}</span><input name="company" type="text" className={GIRDI} /></label>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="block text-[14px] font-medium mb-2">{c.epostaAlan}</span><input name="email" type="email" required className={GIRDI} /></label>
                  <label className="block"><span className="block text-[14px] font-medium mb-2">{c.telAlan}</span><input name="phone" type="tel" className={GIRDI} /></label>
                </div>
                <label className="block"><span className="block text-[14px] font-medium mb-2">{c.konu}</span>
                  <select value={sub} onChange={e => setSub(e.target.value)} className={GIRDI} style={{ color: sub ? "#1b1b1b" : "rgba(0,0,0,.45)" }}>
                    <option value="" disabled>{c.sec}</option>
                    {c.konular.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
                  </select>
                </label>
                <label className="block"><span className="block text-[14px] font-medium mb-2">{c.mesaj}</span><textarea name="message" required rows={4} className={`${GIRDI} resize-none`} /></label>
                {error && <p className="text-[var(--yt-accent)] text-[14px]">{error}</p>}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="submit" disabled={loading} className="yt-btn disabled:opacity-60">{loading ? c.gonderiliyor : c.gonder}</button>
                  <a href={wa} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center border border-black/25 hover:border-black rounded-[10px] px-6 py-3.5 font-semibold transition-colors">WhatsApp</a>
                </div>
                <p className="text-[13px] text-black/45">{c.kvkk}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
