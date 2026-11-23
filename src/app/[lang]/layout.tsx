import { isDil, HREFLANG, dilYonu } from "@/lib/diller";

// Yabancı dil sayfalarında içerik dilini ve yazı yönünü (Arapça için sağdan sola) belirler.
// <html> etiketi kök düzende sabit kaldığı için dil/yön bu sarmalayıcıya yazılır; "display: contents" sayfa düzenini etkilemez.
export default async function DilDuzeni({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const gecerli = isDil(lang);
  return (
    <div lang={gecerli ? HREFLANG[lang] : undefined} dir={gecerli ? dilYonu(lang) : undefined} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
