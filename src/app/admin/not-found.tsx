import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--adm-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 0,
      padding: 24,
      fontFamily: "inherit",
    }}>
      <p style={{
        fontSize: "clamp(100px, 18vw, 180px)",
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: "-0.04em",
        color: "transparent",
        WebkitTextStroke: "1px rgba(20,20,30,0.10)",
        userSelect: "none",
      }}>
        404
      </p>

      <div style={{ width: 40, height: 2, background: "var(--adm-ac)", marginBottom: 24 }}/>

      <h1 style={{
        fontSize: 24,
        fontWeight: 700,
        color: "var(--adm-tx)",
        letterSpacing: "-0.03em",
        marginBottom: 10,
        textAlign: "center",
      }}>
        Sayfa Bulunamadı
      </h1>

      <p style={{
        fontSize: 13.5,
        color: "var(--adm-tx3)",
        textAlign: "center",
        lineHeight: 1.7,
        marginBottom: 32,
      }}>
        Bu sayfa mevcut değil ya da taşınmış.
      </p>

      <Link href="/admin/dashboard" style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "var(--adm-ac)",
        color: "#fff",
        borderRadius: 9,
        padding: "10px 22px",
        fontSize: 13,
        fontWeight: 600,
        textDecoration: "none",
      }}>
        ← Dashboard'a Dön
      </Link>
    </div>
  );
}
