// Schema.org yapılandırılmış veri — JSON-LD (Google'ın tercih ettiği format)
// seo-schema skill kuralı: server-rendered HTML içinde, JS ile inject ETMEYİN

import { guvenliUrl, type Settings, type Stats } from "@/lib/supabase";
import { HREFLANG, type Dil } from "@/lib/diller";
import { M, dilYolu, bolumYolu } from "@/lib/site-metin";
import { UI } from "@/lib/urun-sayfasi";

const SITE_URL = "https://alyatest-alyis.vercel.app";

export default function SchemaOrg({
  settings,
  stats,
  dil,
}: {
  settings: Settings | null;
  stats: Stats | null;
  dil: Dil;
}) {
  const anaSayfaUrl = `${SITE_URL}${dilYolu(dil)}`;
  const m = M[dil], t = UI[dil];
  const phone   = settings?.phone   ?? "+90 212 671 85 65";
  const email   = settings?.email   ?? "info@alyaplastik.com";
  const address = settings?.address ?? "İkitelli OSB 4B Blok No:26-28 Kat:2, Başakşehir, İstanbul";
  const founded = settings?.founded ?? 1968;
  const years   = stats?.years      ?? 55;
  const models  = stats?.models     ?? 200;
  const countries = stats?.countries ?? 20;

  // ── Organization + LocalBusiness ──────────────────────
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${SITE_URL}/#organization`,
    name: "Alya Plastik San. Tic. Ltd. Şti.",
    alternateName: "Alya Plastik",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/apple-touch-icon.png`,
      width: 180,
      height: 180,
    },
    image: `${SITE_URL}/og-image.jpg`,
    description: `${founded}'den bu yana plastik ürün üretiminde lider. Saksı, sepet, sandık ve ev ürünleri. ${models}+ model, ${countries}+ ülke ihracatı.`,
    foundingDate: String(founded),
    numberOfEmployees: { "@type": "QuantitativeValue", value: 50 },
    telephone: phone,
    email: email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "İkitelli OSB 4B Blok No:26-28 Kat:2",
      addressLocality: "Başakşehir",
      addressRegion: "İstanbul",
      addressCountry: "TR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 41.0628,
      longitude: 28.7828,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"],
        opens: "08:30",
        closes: "17:30",
      },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: phone,
        contactType: "customer service",
        availableLanguage: ["Turkish", "English"],
        areaServed: "TR",
      },
      {
        "@type": "ContactPoint",
        telephone: settings?.export_phone ?? "+90 532 399 70 31",
        contactType: "sales",
        availableLanguage: ["Turkish", "English"],
        areaServed: "Worldwide",
      },
    ],
    sameAs: [
      "https://wa.me/905357616524",
      ...[settings?.linkedin, settings?.instagram, settings?.facebook].map(u => guvenliUrl(u)).filter((u): u is string => !!u),
    ],
    areaServed: {
      "@type": "Place",
      name: "Worldwide",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Plastik Ürün Kataloğu",
      numberOfItems: models,
    },
  };

  // ── WebSite ─────────────────────────────────────────────
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${anaSayfaUrl}#website`,
    url: anaSayfaUrl,
    name: "Alya Plastik",
    description: m.meta.aciklama,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: HREFLANG[dil],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}${bolumYolu(dil, "collection")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  // ── Product (Manufacturer) ──────────────────────────────
  const manufacturerSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Plastik Saksı Koleksiyonu",
    description: `${models}+ farklı plastik saksı modeli. Venüs, UFO, 3D, Kristal ve daha fazlası. Toptan B2B satış ve ihracat.`,
    brand: {
      "@type": "Brand",
      name: "Alya Plastik",
    },
    manufacturer: { "@id": `${SITE_URL}/#organization` },
    audience: {
      "@type": "BusinessAudience",
      audienceType: "B2B",
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "TRY",
      availability: "https://schema.org/InStock",
      seller: { "@id": `${SITE_URL}/#organization` },
    },
  };

  // ── BreadcrumbList ──────────────────────────────────────
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.anasayfa,     item: anaSayfaUrl },
      { "@type": "ListItem", position: 2, name: m.nav.urunler,   item: `${SITE_URL}${bolumYolu(dil, "products")}` },
      { "@type": "ListItem", position: 3, name: m.nav.koleksiyon, item: `${SITE_URL}${bolumYolu(dil, "collection")}` },
      { "@type": "ListItem", position: 4, name: m.nav.iletisim,  item: `${SITE_URL}${bolumYolu(dil, "contact")}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(manufacturerSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
