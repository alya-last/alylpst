"use client";
import { useEffect, useState } from "react";
import type { Settings } from "@/lib/supabase";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";

// Footer gibi her sayfada görünen ama #contact bölümü olmayan yerlerde "İletişim" tıklaması
// artık sayfa içinde var olmayan bir çapaya kaymayı denemek yerine, formu bir popup içinde
// doğrudan açar — hangi sayfada olursa olsun çalışır.
export default function IletisimPopup({ settings, dil = "tr", label, className }: { settings: Settings | null; dil?: Dil; label: string; className?: string }) {
  const c = M[dil].iletisim;
  const [acik, setAcik] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!acik) return;
    const eskiTasma = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escKapat = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    window.addEventListener("keydown", escKapat);
    return () => { document.body.style.overflow = eskiTasma; window.removeEventListener("keydown", escKapat); };
  }, [acik]);

  const wa = settings?.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/\D/g,"")}` : "https://wa.me/905357616524";

  const ac = () => { setAcik(true); setSent(false); setError(""); };

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
    <>
      <button type="button" onClick={ac} className={className}>{label}</button>

      {acik && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={c.etiket}>
          <div className="absolute inset-0 bg-[#0b0e0b]/75 backdrop-blur-sm" onClick={() => setAcik(false)} />

          <div className="relative bg-[#eae6dd] w-full max-w-lg max-h-[88vh] overflow-y-auto p-7 sm:p-10">
            <button type="button" onClick={() => setAcik(false)} aria-label="Kapat"
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full border border-[#0b0e0b]/15 hover:border-[#e55f28] hover:text-[#e55f28] text-[#0b0e0b] transition-colors text-lg leading-none">
              ×
            </button>

            <p className="eyebrow text-[#e55f28] mb-2">{c.etiket}</p>
            <h3 className="heading text-[#0b0e0b] text-3xl mb-6">{c.baslik[0]} {c.baslik[1]}</h3>

            {sent ? (
              <div className="flex flex-col justify-center min-h-[220px]">
                <div className="heading text-[#e55f28] text-[56px] mb-2">✓</div>
                <h4 className="heading text-[#0b0e0b] text-2xl mb-2">{c.alindi}</h4>
                <p className="text-[#6b7366] text-sm leading-relaxed">{c.alindiMesaj}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Alan label={c.ad} name="name" type="text" required />
                  <Alan label={c.firma} name="company" type="text" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Alan label={c.epostaAlan} name="email" type="email" required />
                  <Alan label={c.telAlan} name="phone" type="tel" />
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
                  <textarea name="message" required rows={3}
                    className="w-full bg-transparent border-b border-[#0b0e0b]/15 py-3 text-sm text-[#0b0e0b] outline-none resize-none focus:border-[#e55f28] transition-colors" />
                </div>
                {error && <p className="text-[#e55f28] text-xs">{error}</p>}
                <div className="flex flex-wrap gap-3 pt-1">
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
      )}
    </>
  );
}

function Alan({ label, name, type, required }: { label:string; name:string; type:string; required?:boolean }) {
  return (
    <div>
      <label className="eyebrow text-[#6b7366] text-[10px] block mb-2.5">{label}</label>
      <input name={name} type={type} required={required}
        className="w-full bg-transparent border-b border-[#0b0e0b]/15 py-3 text-sm text-[#0b0e0b] outline-none focus:border-[#e55f28] transition-colors" />
    </div>
  );
}
