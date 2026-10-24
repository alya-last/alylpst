"use client";
import { useEffect, useState } from "react";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";
import { ad } from "@/lib/diller";

// Ürün detay sayfasındaki "Teklif iste" butonuyla açılan popup form. Sayfadan ayrılmadan
// /api/contact'a gönderir; hangi ürün için istendiği "product" alanında iletilir.
export default function TeklifModal({ urun, dil = "tr", className, style, children }: {
  urun: { name: string; code: string; name_i18n?: Partial<Record<Dil, string>> | null };
  dil?: Dil;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const c = M[dil].iletisim;
  const [acik, setAcik] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState("");
  const [error, setError] = useState("");
  const urunAdi = `${ad(urun, dil)} (${urun.code})`;

  useEffect(() => {
    if (!acik) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [acik]);

  function ac() { setSent(false); setError(""); setSub(""); setAcik(true); }

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          company: fd.get("company"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          subject: sub,
          product: urunAdi,
          message: fd.get("message"),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.error) setError(c.hata);
      else setSent(true);
    } catch {
      setError(c.hata);
    }
    setLoading(false);
  }

  return (
    <>
      <button type="button" onClick={ac} className={className} style={style}>{children}</button>

      {acik && (
        <div role="dialog" aria-modal="true" aria-label={c.gonder}
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={() => setAcik(false)} style={{ position: "absolute", inset: 0, background: "rgba(11,14,11,.7)" }} />
          <div style={{ position: "relative", width: "min(520px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "#eae6dd", color: "#0b0e0b", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 0" }}>
              <div>
                <p className="eyebrow text-[#e55f28]" style={{ marginBottom: 6 }}>{urunAdi}</p>
                <h3 className="heading" style={{ fontSize: "clamp(22px,3vw,30px)", lineHeight: 1.05 }}>{c.gonder.replace(" →", "")}</h3>
              </div>
              <button onClick={() => setAcik(false)} aria-label="×" style={{ background: "none", border: "none", color: "#0b0e0b", fontSize: 26, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              {sent ? (
                <div style={{ minHeight: 160, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div className="heading text-[#e55f28]" style={{ fontSize: 56, marginBottom: 8 }}>✓</div>
                  <h4 className="heading" style={{ fontSize: 26, marginBottom: 8 }}>{c.alindi}</h4>
                  <p className="text-[#6b7366]" style={{ fontSize: 14, lineHeight: 1.6 }}>{c.alindiMesaj}</p>
                </div>
              ) : (
                <form onSubmit={gonder} className="flex flex-col gap-5">
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
                    <textarea name="message" required rows={4} defaultValue={""}
                      className="w-full bg-transparent border-b border-[#0b0e0b]/15 py-3 text-sm text-[#0b0e0b] outline-none resize-none focus:border-[#e55f28] transition-colors" />
                  </div>
                  {error && <p className="text-[#e55f28] text-xs">{error}</p>}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button type="submit" disabled={loading}
                      className="inline-flex items-center gap-2 bg-[#e55f28] hover:bg-[#c94f1e] text-white text-[11px] font-semibold tracking-[0.14em] uppercase px-7 py-3.5 transition-colors disabled:opacity-60">
                      {loading ? c.gonderiliyor : c.gonder}
                    </button>
                  </div>
                  <p className="eyebrow text-[#0b0e0b]/35 text-[10px]">{c.kvkk}</p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, name, type, required }: { label: string; name: string; type: string; required?: boolean }) {
  return (
    <div>
      <label className="eyebrow text-[#6b7366] text-[10px] block mb-2.5">{label}</label>
      <input name={name} type={type} required={required}
        className="w-full bg-transparent border-b border-[#0b0e0b]/15 py-3 text-sm text-[#0b0e0b] outline-none focus:border-[#e55f28] transition-colors" />
    </div>
  );
}
