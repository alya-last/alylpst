import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#eae6dd",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 0,
      padding: 24,
      fontFamily: "inherit",
    }}>
      {/* Büyük 404 */}
      <p style={{
        fontSize: "clamp(120px, 20vw, 220px)",
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: "-0.04em",
        color: "transparent",
        WebkitTextStroke: "1px rgba(11,14,11,0.12)",
        userSelect: "none",
        marginBottom: 0,
      }}>
        404
      </p>

      {/* Turuncu çizgi */}
      <div style={{ width: 48, height: 2, background: "#e55f28", marginBottom: 28 }}/>

      <h1 style={{
        fontSize: "clamp(22px, 4vw, 36px)",
        fontWeight: 700,
        color: "#0b0e0b",
        letterSpacing: "-0.03em",
        marginBottom: 12,
        textAlign: "center",
      }}>
        Sayfa Bulunamadı
      </h1>

      <p style={{
        fontSize: 15,
        color: "#6b7366",
        maxWidth: 360,
        textAlign: "center",
        lineHeight: 1.7,
        marginBottom: 40,
      }}>
        Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#e55f28",
          color: "#fff",
          borderRadius: 10,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          letterSpacing: "-0.01em",
        }}>
          ← Ana Sayfaya Dön
        </Link>
        <Link href="/#contact" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          color: "#0b0e0b",
          border: "1px solid rgba(11,14,11,0.15)",
          borderRadius: 10,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 500,
          textDecoration: "none",
        }}>
          İletişime Geç
        </Link>
      </div>

      {/* Alt küçük metin */}
      <p style={{ marginTop: 60, fontSize: 12, color: "#6b7366" }}>
        Alya Plastik San. Tic. Ltd. Şti. · 1968
      </p>
    </div>
  );
}
