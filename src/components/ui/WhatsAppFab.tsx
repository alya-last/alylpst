"use client";
import { useEffect, useState } from "react";
import type { Settings } from "@/lib/supabase";
import type { Dil } from "@/lib/urun-sayfasi";
import { M } from "@/lib/site-metin";

export default function WhatsAppFab({ settings, dil = "tr" }: { settings: Settings | null; dil?: Dil }) {
  const w = M[dil].wa;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fn = () => setVisible(window.scrollY > window.innerHeight * 0.7);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const num = settings?.whatsapp ? settings.whatsapp.replace(/\D/g,"") : "905357616524";
  const wa = `https://wa.me/${num}?text=${encodeURIComponent(w.metin)}`;

  return (
    <a href={wa} target="_blank" rel="noopener noreferrer nofollow"
      className="fixed z-85 flex items-center gap-2 shadow-2xl hover:-translate-y-0.5 transition-all duration-300"
      style={{
        bottom:24, left:"clamp(20px,5vw,80px)", background:"#22c55e", color:"#fff", padding:"12px 20px 12px 14px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        pointerEvents: visible ? "auto" : "none",
      }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.554 4.1 1.524 5.822L0 24l6.337-1.498A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.64-.497-5.155-1.367l-.37-.218-3.764.89.947-3.671-.237-.393A9.962 9.962 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
      </svg>
      <span className="eyebrow text-white text-[10px]">{w.buton}</span>
    </a>
  );
}
