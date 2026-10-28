import type { Stats, Settings } from "@/lib/supabase";
import type { Dil } from "@/lib/diller";

const ETIKET: Record<Dil, { yil: string; ulke: string; model: string; yerli: string }> = {
  tr: { yil: "kuruluş", ulke: "ihracat ülkesi", model: "model", yerli: "yerli üretim" },
  en: { yil: "founded", ulke: "export countries", model: "models", yerli: "local production" },
  ru: { yil: "основана", ulke: "стран экспорта", model: "моделей", yerli: "местное производство" },
  zh: { yil: "成立", ulke: "出口国家", model: "款型号", yerli: "本地生产" },
};

// Tek satırlık kısa rakam şeridi: kuruluş yılı, ihracat ülkesi, model sayısı, yerli üretim oranı (hepsi panel ayarlarından gelir).
export default function YRakam({ dil = "tr", stats, settings, ulkeSayisi }: { dil?: Dil; stats: Stats | null; settings: Settings | null; ulkeSayisi?: number }) {
  const t = ETIKET[dil] ?? ETIKET.tr;
  const ulke = ulkeSayisi && ulkeSayisi > 0 ? ulkeSayisi : (stats?.countries ?? 20);
  const rak = [
    { n: String(settings?.founded ?? 1968), l: t.yil },
    { n: `${ulke}+`, l: t.ulke },
    { n: `${stats?.models ?? 200}+`, l: t.model },
    { n: `%${stats?.local_production ?? 100}`, l: t.yerli },
  ];
  return (
    <section className="bg-white border-y border-black/10" aria-label="Alya Plastik">
      <div className="yt-wrap grid grid-cols-2 md:grid-cols-4 gap-y-3 py-4 md:py-5">
        {rak.map(r => (
          <div key={r.l} className="flex items-baseline justify-center gap-2.5">
            <span className="font-semibold tracking-[-0.02em] text-[clamp(22px,2.6vw,32px)] leading-none">{r.n}</span>
            <span className="text-[13px] md:text-[14px] text-black/55">{r.l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
