"use client";
import { useState } from "react";
import Donus360 from "@/components/urun/Donus360";
import Model3D from "@/components/urun/Model3D";

// Ürün detay sayfasındaki ana görsel + küçük resimler (thumbnail) galerisi.
// Önceden thumbnail'ler tıklanabilir değildi (düz <img>, tıklama/seçili durum yoktu) —
// bu yüzden ikinci/üçüncü resme geçmek mümkün değildi. Artık seçili küçük resme göre
// ana kutuda ne gösterileceği (gerçek 3D model / AI 360° galeri / ilgili statik resim) belirleniyor.
export default function UrunGaleri({
  model3dUrl, kareler360, resimler, renkler = [], alt,
}: {
  model3dUrl: string | null;
  kareler360: string[];
  resimler: string[];
  renkler?: { hex: string; ad: string; gorsel: string }[];
  alt: string;
}) {
  const [secili, setSecili] = useState(0);
  // Bir renk seçildiğinde ana görsel o rengin fotoğrafına döner; thumbnail'e tıklamak bunu iptal eder.
  const [renkGorsel, setRenkGorsel] = useState<string | null>(null);
  const digerResimler = resimler.slice(1, 9);
  const kucukResimVarMi = digerResimler.length > 0;

  function thumbSec(idx: number) { setRenkGorsel(null); setSecili(idx); }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="bg-[#e3ddcf] flex items-center justify-center overflow-hidden w-full max-w-full" style={{ aspectRatio: "1 / 1" }}>
        {renkGorsel ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={renkGorsel} alt={alt} className="w-full h-full object-contain" style={{ padding: "clamp(16px,4vw,48px)" }} />
        ) : secili === 0 ? (
          model3dUrl ? (
            <Model3D url={model3dUrl} alt={alt} className="w-full h-full" />
          ) : kareler360.length > 1 ? (
            <Donus360 kareler={kareler360} alt={alt} className="w-full h-full flex items-center justify-center" style={{ padding: "clamp(16px,4vw,48px)" }} />
          ) : (
            resimler[0] &&
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resimler[0]} alt={alt} className="w-full h-full object-contain" style={{ padding: "clamp(16px,4vw,48px)" }} fetchPriority="high" />
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resimler[secili]} alt={alt} className="w-full h-full object-contain" style={{ padding: "clamp(16px,4vw,48px)" }} />
        )}
      </div>

      {renkler.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 mt-4">
          <span className="eyebrow text-[#6b7366] text-[10px]">Renkler:</span>
          {renkler.map(r => (
            <button key={r.hex} type="button" title={r.ad} aria-label={r.ad} aria-current={renkGorsel === r.gorsel}
              onClick={() => setRenkGorsel(r.gorsel)}
              className="w-6 h-6 rounded-full transition-transform hover:scale-110"
              style={{
                background: r.hex,
                outline: renkGorsel === r.gorsel ? "2px solid #e55f28" : "1px solid rgba(11,14,11,0.15)",
                outlineOffset: 2,
              }} />
          ))}
        </div>
      )}

      {kucukResimVarMi && (
        <ul className="grid grid-cols-4 gap-2 mt-2">
          {/* İlk küçük resim: ana gösterimi (3D/360/ilk foto) temsil eder */}
          <li>
            <button type="button" onClick={() => thumbSec(0)} aria-label={`${alt} — 1`} aria-current={secili === 0 && !renkGorsel}
              className="block w-full bg-[#e3ddcf] aspect-square transition-opacity"
              style={{ outline: secili === 0 ? "2px solid #e55f28" : "2px solid transparent", outlineOffset: -2, opacity: secili === 0 ? 1 : 0.75 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resimler[0]} alt="" loading="lazy" className="w-full h-full object-contain p-2" />
            </button>
          </li>
          {digerResimler.map((r, i) => {
            const idx = i + 1;
            return (
              <li key={r}>
                <button type="button" onClick={() => thumbSec(idx)} aria-label={`${alt} — ${idx + 1}`} aria-current={secili === idx && !renkGorsel}
                  className="block w-full bg-[#e3ddcf] aspect-square transition-opacity"
                  style={{ outline: secili === idx ? "2px solid #e55f28" : "2px solid transparent", outlineOffset: -2, opacity: secili === idx ? 1 : 0.75 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r} alt="" loading="lazy" className="w-full h-full object-contain p-2" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
