import YCerceve from "./YCerceve";
import YIletisim from "./YIletisim";
import { getSettings } from "@/lib/supabase";
import { DILLER, kurumsalYolu, type Dil } from "@/lib/diller";

// Ayrı "İletişim" sayfası (tüm diller): teklif/iletişim formu ve iletişim bilgileri.
export default async function IletisimSayfasi({ dil }: { dil: Dil }) {
  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  try { settings = await getSettings(); } catch (e) { console.error("Supabase fetch error:", e); }
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "iletisim")]));
  return (
    <YCerceve settings={settings} dil={dil} altDiller={altDiller}>
      <main><YIletisim settings={settings} dil={dil} /></main>
    </YCerceve>
  );
}
