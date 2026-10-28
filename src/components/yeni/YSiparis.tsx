import Link from "next/link";
import { type Dil, kurumsalYolu } from "@/lib/diller";

const T: Record<Dil, { baslik: string; adim: [string, string, string]; dugme: string }> = {
  tr: { baslik: "Nasıl sipariş verilir?", adim: ["Modelleri seçin", "Teklif isteyin", "Sevkiyatı bize bırakın"], dugme: "Teklif iste" },
  en: { baslik: "How to order", adim: ["Pick your models", "Request a quote", "We handle shipping"], dugme: "Request a quote" },
  ru: { baslik: "Как заказать", adim: ["Выберите модели", "Запросите предложение", "Отгрузку берём на себя"], dugme: "Запросить цену" },
  zh: { baslik: "如何下单", adim: ["选择型号", "索取报价", "我们负责发货"], dugme: "获取报价" },
};

// Tek satırlık "nasıl sipariş verilir" şeridi (3 adım + teklif butonu); az yer kaplar, toptan müşteriyi iletişime yönlendirir.
export default function YSiparis({ dil = "tr" }: { dil?: Dil }) {
  const t = T[dil] ?? T.tr;
  return (
    <section className="bg-white border-y border-black/10" aria-label={t.baslik}>
      <div className="yt-wrap flex flex-col md:flex-row md:items-center gap-3 md:gap-8 py-4 md:py-5">
        <p className="font-semibold text-[17px] md:text-[18px] shrink-0">{t.baslik}</p>
        <ol className="flex flex-col sm:flex-row gap-2 sm:gap-8 flex-1">
          {t.adim.map((a, i) => (
            <li key={a} className="flex items-center gap-2.5 text-[15px] text-black/70">
              <span className="w-6 h-6 shrink-0 rounded-full bg-black text-white text-[13px] font-semibold flex items-center justify-center">{i + 1}</span>
              {a}
            </li>
          ))}
        </ol>
        <Link href={kurumsalYolu(dil, "iletisim")} className="self-start md:self-auto shrink-0 rounded-full bg-black text-white px-5 py-2.5 text-[15px] font-semibold hover:bg-[var(--yt-accent)] transition-colors">{t.dugme}</Link>
      </div>
    </section>
  );
}
