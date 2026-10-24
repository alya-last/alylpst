"use client";
import { useState } from "react";
import type { Settings } from "@/lib/supabase";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";

export default function Contact({ settings, dil = "tr" }: { settings: Settings | null; dil?: Dil }) {
  const c = M[dil].iletisim;
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState("");
  const [error, setError] = useState("");

  const s = settings;
  const wa = s?.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g,"")}` : "https://wa.me/905357616524";

  const CONTACTS = [
    { l:c.eposta,  v: s?.email ?? "info@alyaplastik.com",          h:`mailto:${s?.email ?? "info@alyaplastik.com"}` },
    { l:c.ihracat,  v: s?.export_email ?? "export@alyaplastik.com",  h:`mailto:${s?.export_email ?? "export@alyaplastik.com"}` },
    { l:c.telefon,  v: s?.phone ?? "+90 212 671 85 65",              h:`tel:${s?.phone?.replace(/\D/g,"") ?? "902126718565"}` },
    { l:c.whatsapp, v: s?.whatsapp ?? "+90 535 761 65 24",           h: wa },
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:    fd.get("name"),
        company: fd.get("company"),
        email:   fd.get("email"),
        phone:   fd.get("phone"),
        subject: sub,
        message: fd.get("message"),
      }),
    });
    const { error: err } = await res.json();
    setLoading(false);
    if (err) { setError(c.hata); }
    else { setSent(true); }
  };

  return (
    <section id="contact" className="bg-[#eae6dd]" data-bg="#eae6dd" style={{ paddingBlock:"clamp(72px,9vw,130px)" }}>
      <div style={{ paddingInline:"clamp(20px,5vw,80px)" }}>

        <div className="mb-12">
          <p className="anim-eyebrow eyebrow text-[#e55f28] mb-3">{c.etiket}</p>
          <h2 className="anim-split-heading heading text-[#0b0e0b]" style={{ fontSize:"clamp(44px,7vw,96px)" }}>
            {c.baslik[0]}<br />{c.baslik[1]}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
          {/* Sol */}
          <div>
            <p className="anim-up font-light leading-loose text-[#6b7366] text-sm max-w-[360px] mb-10">
              {c.aciklama}
            </p>
            {CONTACTS.map((c, i) => (
              <a key={c.l} href={c.h}
                target={c.h.startsWith("http") ? "_blank" : undefined}
                rel={c.h.startsWith("http") ? "noopener noreferrer nofollow" : undefined}
                className="flex items-center justify-between py-4 border-b border-[#0b0e0b]/10 hover:opacity-60 transition-opacity"
                style={{ transitionDelay:`${i*40}ms` }}>
                <span className="eyebrow text-[#6b7366] text-[10px]">{c.l}</span>
                <span className="text-[#0b0e0b] text-sm">{c.v} →</span>
              </a>
            ))}
            <address className="not-italic mt-8 text-[#6b7366] text-sm leading-loose">
              {s?.address ?? "İkitelli OSB 4B Blok No:26-28 Kat:2, Başakşehir / İstanbul"}<br />
              <span className="text-[#0b0e0b]/40">{s?.working_hours ?? "Pzt–Cum 08:30–17:30"}</span>
            </address>
          </div>

          {/* Sağ — form */}
          <div>
            {sent ? (
              <div className="flex flex-col justify-center min-h-[300px]">
                <div className="heading text-[#e55f28] text-[72px] mb-3">✓</div>
                <h3 className="heading text-[#0b0e0b] text-4xl mb-3">{c.alindi}</h3>
                <p className="text-[#6b7366] text-[15px] leading-relaxed">{c.alindiMesaj}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label={c.ad} name="name" type="text" required />
                  <Field label={c.firma} name="company" type="text" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label={c.epostaAlan} name="email" type="email" required />
                  <Field label={c.telAlan} name="phone" type="tel" />
                </div>
                <div>
                  <label className="eyebrow text-[#6b7366] text-[10px] block mb-2.5">{c.konu}</label>
                  <select value={sub} onChange={e => setSub(e.target.value)}
                    className="w-full bg-transparent border-b border-[#0b0e0b]/15 py-3 text-sm outline-none appearance-none"
                    style={{ color: sub ? "#0b0e0b" : "#6b7366" }}>
                    <option value="" disabled>{c.sec}</option>
                    {c.konular.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="eyebrow text-[#6b7366] text-[10px] block mb-2.5">{c.mesaj}</label>
                  <textarea name="message" required rows={4}
                    className="w-full bg-transparent border-b border-[#0b0e0b]/15 py-3 text-sm text-[#0b0e0b] outline-none resize-none focus:border-[#e55f28] transition-colors" />
                </div>
                {error && <p className="text-[#e55f28] text-xs">{error}</p>}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button type="submit" disabled={loading}
                    className="inline-flex items-center gap-2 bg-[#e55f28] hover:bg-[#c94f1e] text-white text-[11px] font-semibold tracking-[0.14em] uppercase px-7 py-3.5 transition-colors disabled:opacity-60">
                    {loading ? c.gonderiliyor : c.gonder}
                  </button>
                  <a href={wa} target="_blank" rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-2 border border-[#0b0e0b]/20 hover:border-[#0b0e0b]/50 text-[#0b0e0b] text-[11px] font-semibold tracking-[0.14em] uppercase px-7 py-3.5 transition-colors">
                    WhatsApp
                  </a>
                </div>
                <p className="eyebrow text-[#0b0e0b]/35 text-[10px]">{c.kvkk}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, name, type, required }: { label:string; name:string; type:string; required?:boolean }) {
  return (
    <div>
      <label className="eyebrow text-[#6b7366] text-[10px] block mb-2.5">{label}</label>
      <input name={name} type={type} required={required}
        className="w-full bg-transparent border-b border-[#0b0e0b]/15 py-3 text-sm text-[#0b0e0b] outline-none focus:border-[#e55f28] transition-colors" />
    </div>
  );
}
