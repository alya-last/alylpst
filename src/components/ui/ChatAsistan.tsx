"use client";
import { useEffect, useRef, useState } from "react";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";

type Msg = { role: "user" | "assistant"; content: string };

// Site sohbet asistanı — sunucu tarafında API anahtarı tanımlı değilse hiç görünmez.
export default function ChatAsistan({ dil = "tr" }: { dil?: Dil }) {
  const t = M[dil].asistan;
  const [aktif, setAktif] = useState(false);
  const [acik, setAcik] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: t.selam }]);
  const [girdi, setGirdi] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const alt = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat").then(r => r.json()).then(j => setAktif(!!j.aktif)).catch(() => {});
  }, []);
  useEffect(() => { alt.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, acik]);
  useEffect(() => {
    if (!acik) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [acik]);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    const metin = girdi.trim();
    if (!metin || yukleniyor) return;
    const yeni = [...msgs, { role: "user", content: metin } as Msg];
    setMsgs(yeni); setGirdi(""); setYukleniyor(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mesajlar: yeni.slice(1) }), // ilk karşılama mesajı gönderilmez
      });
      const j = await res.json().catch(() => ({}));
      setMsgs(m => [...m, { role: "assistant", content: j.yanit || j.error || t.hata }]);
    } catch {
      setMsgs(m => [...m, { role: "assistant", content: t.baglanti }]);
    }
    setYukleniyor(false);
  }

  if (!aktif) return null;

  return (
    <>
      {acik && (
        <div role="dialog" aria-label={t.aria}
          style={{ position: "fixed", zIndex: 95, right: "clamp(12px,3vw,40px)", bottom: 68, width: "min(360px, calc(100vw - 24px))", height: "min(480px, calc(100vh - 120px))", display: "flex", flexDirection: "column", background: "#0b0e0b", color: "#eae6dd", border: "1px solid rgba(234,230,221,.15)", boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid rgba(234,230,221,.12)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".04em" }}>{t.baslik}</div>
              <div style={{ fontSize: 10.5, color: "#9aa294" }}>{t.alt}</div>
            </div>
            <button onClick={() => setAcik(false)} aria-label={t.kapat} style={{ background: "none", border: "none", color: "#eae6dd", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%", padding: "9px 12px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", background: m.role === "user" ? "#e55f28" : "rgba(234,230,221,.08)", color: m.role === "user" ? "#fff" : "#eae6dd" }}>{m.content}</div>
            ))}
            {yukleniyor && <div style={{ alignSelf: "flex-start", fontSize: 12, color: "#9aa294" }}>{t.yaziyor}</div>}
            <div ref={alt} />
          </div>
          <form onSubmit={gonder} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid rgba(234,230,221,.12)" }}>
            <input value={girdi} onChange={e => setGirdi(e.target.value)} maxLength={500} placeholder={t.yer} aria-label={t.mesajAria}
              style={{ flex: 1, minWidth: 0, background: "rgba(234,230,221,.06)", border: "1px solid rgba(234,230,221,.15)", color: "#eae6dd", padding: "9px 11px", fontSize: 13.5, outline: "none" }} />
            <button type="submit" disabled={yukleniyor || !girdi.trim()} style={{ background: "#e55f28", color: "#fff", border: "none", padding: "0 14px", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", cursor: "pointer", opacity: yukleniyor || !girdi.trim() ? 0.5 : 1 }}>{t.gonder}</button>
          </form>
        </div>
      )}
      <button onClick={() => setAcik(o => !o)} aria-label={acik ? t.kapat : t.ac}
        style={{ position: "fixed", zIndex: 95, right: "clamp(12px,3vw,40px)", bottom: 16, background: "#0b0e0b", color: "#eae6dd", border: "1px solid #e55f28", padding: "10px 14px", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
        {acik ? t.kapat : t.ac}
      </button>
    </>
  );
}
