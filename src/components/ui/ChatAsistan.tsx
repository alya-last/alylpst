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
          style={{ position: "fixed", zIndex: 96, right: "clamp(12px,3vw,40px)", bottom: 84, width: "min(380px, calc(100vw - 24px))", height: "min(520px, calc(100vh - 120px))", display: "flex", flexDirection: "column", background: "#fff", color: "#1b1b1b", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.28)", border: "1px solid rgba(0,0,0,.08)", fontFamily: "inherit" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#262626", color: "#fff" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t.baslik}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>{t.alt}</div>
            </div>
            <button onClick={() => setAcik(false)} aria-label={t.kapat} style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#f7f7f5" }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%", padding: "10px 14px", fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "#e55f28" : "#fff", color: m.role === "user" ? "#fff" : "#1b1b1b", border: m.role === "user" ? "none" : "1px solid rgba(0,0,0,.07)" }}>{m.content}</div>
            ))}
            {yukleniyor && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#777" }}>{t.yaziyor}</div>}
            <div ref={alt} />
          </div>
          <form onSubmit={gonder} style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid rgba(0,0,0,.08)", background: "#fff" }}>
            <input value={girdi} onChange={e => setGirdi(e.target.value)} maxLength={500} placeholder={t.yer} aria-label={t.mesajAria}
              style={{ flex: 1, minWidth: 0, background: "#f2f2f0", border: "1px solid transparent", color: "#1b1b1b", padding: "11px 14px", fontSize: 15, outline: "none", borderRadius: 12 }} />
            <button type="submit" disabled={yukleniyor || !girdi.trim()} style={{ background: "#e55f28", color: "#fff", border: "none", padding: "0 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", borderRadius: 12, opacity: yukleniyor || !girdi.trim() ? 0.5 : 1 }}>{t.gonder}</button>
          </form>
        </div>
      )}
      <button onClick={() => setAcik(o => !o)} aria-label={acik ? t.kapat : t.ac}
        style={{ position: "fixed", zIndex: 96, right: "clamp(12px,3vw,40px)", bottom: 20, background: "#262626", color: "#fff", border: "none", padding: "13px 20px", fontSize: 14, fontWeight: 600, borderRadius: 999, cursor: "pointer", boxShadow: "0 10px 30px rgba(0,0,0,.3)", fontFamily: "inherit" }}>
        {acik ? t.kapat : t.ac}
      </button>
    </>
  );
}
