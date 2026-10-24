"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Sonuc = { durum: "ok" | "tekrar" | "hata"; yon?: "giris" | "cikis"; ad_soyad?: string; sicil_no?: string; zaman?: string; mesaj: string; uyari?: string };
type Kayit = { ad: string; yon: string; saat: string };

const ANAHTAR = "alya_kiosk_key";
const saat = (d: Date) => d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

function bip(tip: "ok" | "cikis" | "hata") {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext; const c = new AC(); const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "sine"; g.gain.value = 0.15;
    o.frequency.value = tip === "ok" ? 880 : tip === "cikis" ? 660 : 200; o.start(); o.stop(c.currentTime + (tip === "hata" ? 0.5 : 0.18));
  } catch { /* ses yoksa sessiz */ }
}

// Kapıda duran tablet: kamera ile personel QR kartını okur. Yalnızca yönetici panelinden verilen cihaz bağlantısıyla çalışır.
export default function KioskSayfasi() {
  const [anahtar, setAnahtar] = useState<string | null | undefined>(undefined);
  const [kameraHata, setKameraHata] = useState("");
  const [yuz, setYuz] = useState<"user" | "environment">("user");
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [son, setSon] = useState<Kayit[]>([]);
  const [saatMetni, setSaatMetni] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const tuval = useRef<HTMLCanvasElement>(null);
  const mesgul = useRef(false);
  const sonKod = useRef({ kod: "", t: 0 });
  const kapatZaman = useRef<any>(null);
  const [yapistir, setYapistir] = useState("");
  const [yapistirHata, setYapistirHata] = useState("");

  // Kurulum: bağlantıdaki #k=<anahtar> saklanır ve adres çubuğundan silinir
  useEffect(() => {
    try {
      const m = /[#&]k=([a-f0-9]{64})/.exec(window.location.hash);
      if (m) { localStorage.setItem(ANAHTAR, m[1]); history.replaceState(null, "", window.location.pathname); }
      setAnahtar(localStorage.getItem(ANAHTAR));
    } catch { setAnahtar(null); }
  }, []);

  useEffect(() => { const t = setInterval(() => setSaatMetni(new Date().toLocaleString("tr-TR", { dateStyle: "full", timeStyle: "medium", timeZone: "Europe/Istanbul" })), 1000); return () => clearInterval(t); }, []);

  // Ekran açık kalsın
  useEffect(() => {
    let kilit: any;
    const iste = async () => { try { kilit = await (navigator as any).wakeLock?.request("screen"); } catch { /* desteklenmiyor */ } };
    iste(); const g = () => { if (document.visibilityState === "visible") iste(); };
    document.addEventListener("visibilitychange", g);
    return () => { document.removeEventListener("visibilitychange", g); kilit?.release?.(); };
  }, []);

  const gonder = useCallback(async (kod: string) => {
    if (!anahtar) return;
    mesgul.current = true;
    try {
      const res = await fetch("/api/personel/okut", { method: "POST", headers: { "Content-Type": "application/json", "x-kiosk-key": anahtar }, body: JSON.stringify({ qr: kod }) });
      let j: any = {}; try { j = await res.json(); } catch { /* boş */ }
      let s: Sonuc;
      if (res.status === 401) s = { durum: "hata", mesaj: "Bu cihazın yetkisi iptal edilmiş veya geçersiz." };
      else if (res.status === 429) s = { durum: "hata", mesaj: j.error || "Çok hızlı, biraz bekleyin." };
      else if (!res.ok && !j.durum) s = { durum: "hata", mesaj: "Bir sorun oluştu, tekrar okutun." };
      else s = j;
      setSonuc(s);
      bip(s.durum === "ok" ? (s.yon === "cikis" ? "cikis" : "ok") : "hata");
      if (s.durum === "ok" && s.ad_soyad) setSon(l => [{ ad: s.ad_soyad!, yon: s.yon === "giris" ? "Giriş" : "Çıkış", saat: saat(new Date(s.zaman!)) }, ...l].slice(0, 6));
    } catch { setSonuc({ durum: "hata", mesaj: "Bağlantı yok. Tekrar okutun." }); bip("hata"); }
    clearTimeout(kapatZaman.current); kapatZaman.current = setTimeout(() => { setSonuc(null); mesgul.current = false; }, 2600);
  }, [anahtar]);

  // Kamera ve QR tarama döngüsü
  useEffect(() => {
    if (!anahtar) return;
    let dur = false, akim: MediaStream | null = null, raf = 0, son = 0;
    (async () => {
      try {
        akim = await navigator.mediaDevices.getUserMedia({ video: { facingMode: yuz, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (video.current) { video.current.srcObject = akim; await video.current.play(); }
        setKameraHata("");
      } catch { setKameraHata("Kameraya erişilemedi. Tarayıcı ayarlarından kamera iznini verin."); return; }
      const tara = (t: number) => {
        if (dur) return; raf = requestAnimationFrame(tara);
        if (t - son < 110 || mesgul.current) return; son = t;
        const v = video.current, c = tuval.current; if (!v || !c || v.readyState < 2 || !v.videoWidth) return;
        const oran = Math.min(1, 640 / v.videoWidth); c.width = Math.round(v.videoWidth * oran); c.height = Math.round(v.videoHeight * oran);
        const cx = c.getContext("2d", { willReadFrequently: true })!; cx.drawImage(v, 0, 0, c.width, c.height);
        const img = cx.getImageData(0, 0, c.width, c.height); const q = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (q?.data) { const n = Date.now(); if (q.data !== sonKod.current.kod || n - sonKod.current.t > 5000) { sonKod.current = { kod: q.data, t: n }; gonder(q.data); } }
      };
      raf = requestAnimationFrame(tara);
    })();
    return () => { dur = true; cancelAnimationFrame(raf); akim?.getTracks().forEach(t => t.stop()); };
  }, [anahtar, yuz, gonder]);

  function elleKur() {
    const m = /([a-f0-9]{64})/i.exec(yapistir.trim());
    if (!m) { setYapistirHata("Geçerli bir kurulum bağlantısı veya anahtar bulunamadı. Bağlantıyı eksiksiz kopyaladığınızdan emin olun."); return; }
    try { localStorage.setItem(ANAHTAR, m[1].toLowerCase()); setAnahtar(m[1].toLowerCase()); } catch { setYapistirHata("Tarayıcı kaydetmeye izin vermiyor (gizli sekme olabilir)."); }
  }

  if (anahtar === undefined) return null;
  if (!anahtar) return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 460 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Kiosk yapılandırılmamış</h1>
        <p style={{ color: "#9aa294", lineHeight: 1.6 }}>Bu cihaz henüz personel giriş-çıkış kiosku olarak tanımlanmamış. Yönetici panelinde <b>Personel → Ayarlar → Kiosk cihazları</b> bölümünden bir kurulum bağlantısı oluşturup bu tarayıcıda açın. Bağlantı açılmıyorsa eksiksiz halini aşağıya yapıştırın.</p>
        <textarea value={yapistir} onChange={e => { setYapistir(e.target.value); setYapistirHata(""); }} placeholder="https://…/kiosk#k=…" rows={3} style={{ width: "100%", marginTop: 16, background: "#111", color: "#eae6dd", border: "1px solid #2a2f2a", padding: 10, fontSize: 12 }} />
        {yapistirHata && <p style={{ color: "#d13b3b", fontSize: 13 }}>{yapistirHata}</p>}
        <button onClick={elleKur} style={{ marginTop: 8, background: "#e55f28", color: "#fff", border: 0, padding: "10px 18px", fontWeight: 700 }}>Kur</button>
      </div>
    </main>
  );

  const renk = sonuc?.durum === "ok" ? (sonuc.yon === "giris" ? "#1f9d63" : "#e55f28") : sonuc?.durum === "tekrar" ? "#3b6fd4" : "#d13b3b";
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: ".18em", color: "#e55f28", fontWeight: 700 }}>ALYA PLASTİK · PERSONEL GİRİŞ–ÇIKIŞ</div>
        <div style={{ fontSize: "clamp(20px,4vw,34px)", fontWeight: 700, marginTop: 4 }}>{saatMetni}</div>
      </div>
      <div style={{ position: "relative", width: "min(92vw, 560px)", aspectRatio: "4 / 3", background: "#000", overflow: "hidden", border: "2px solid #2a2f2a" }}>
        <video ref={video} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: yuz === "user" ? "scaleX(-1)" : undefined }} />
        <div style={{ position: "absolute", inset: "18%", border: "3px solid rgba(229,95,40,.85)", borderRadius: 12, pointerEvents: "none" }} />
        {kameraHata && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", background: "rgba(0,0,0,.8)" }}>{kameraHata}</div>}
        {sonuc && (
          <div style={{ position: "absolute", inset: 0, background: renk, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16 }}>
            {sonuc.durum === "ok" && <div style={{ fontSize: "clamp(34px,9vw,60px)", fontWeight: 800 }}>{sonuc.yon === "giris" ? "GİRİŞ" : "ÇIKIŞ"}</div>}
            {sonuc.ad_soyad && <div style={{ fontSize: "clamp(22px,6vw,38px)", fontWeight: 700, marginTop: 6 }}>{sonuc.ad_soyad}</div>}
            <div style={{ fontSize: "clamp(16px,4vw,24px)", marginTop: 8 }}>{sonuc.mesaj}{sonuc.zaman ? ` · ${saat(new Date(sonuc.zaman))}` : ""}</div>
            {sonuc.uyari && <div style={{ fontSize: 15, marginTop: 10, background: "rgba(0,0,0,.25)", padding: "6px 12px" }}>{sonuc.uyari}</div>}
          </div>
        )}
      </div>
      <p style={{ color: "#9aa294", fontSize: 14, margin: 0 }}>Kartınızdaki QR kodu kameraya gösterin</p>
      <canvas ref={tuval} style={{ display: "none" }} />
      <div style={{ width: "min(92vw, 560px)" }}>
        {son.map((k, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 2px", borderBottom: "1px solid #2a2f2a", fontSize: 14, color: i === 0 ? "#eae6dd" : "#9aa294" }}><span>{k.ad}</span><span>{k.yon} · {k.saat}</span></div>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button onClick={() => setYuz(y => (y === "user" ? "environment" : "user"))} style={{ background: "transparent", color: "#9aa294", border: "1px solid #2a2f2a", padding: "8px 14px", fontSize: 12 }}>Kamerayı değiştir</button>
        <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} style={{ background: "transparent", color: "#9aa294", border: "1px solid #2a2f2a", padding: "8px 14px", fontSize: 12 }}>Tam ekran</button>
      </div>
    </main>
  );
}
