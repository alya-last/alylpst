"use client";
import { useEffect } from "react";

// Header/Footer/MegaMenu'deki "/#contact" gibi bağlantılar düz <a> ile tam sayfa geçişi yapıyor
// (kasıtlı — bkz. MegaMenu.tsx yorumu), Hakkımızda/Üretim Süreci gibi sayfalardakiler ise Next
// <Link> ile. Her iki durumda da tarayıcının/Next'in hash-scroll'u DOM daha oturmadan
// (GSAP ScrollTrigger'ın h-pin bölümü için hesapladığı yükseklik, görsellerin geç yüklenmesi vb.)
// çalışıyor; sonuç olarak hedef bölüm kayıyor ve kullanıcı "yanlış yere gitti" hissi yaşıyor.
// Bu bileşen hash varsa yükleme/düzen otursun diye birkaç kez gecikmeli olarak doğru konuma
// yeniden kaydırır (ilk anlık zıplamayı kullanıcı görmesin diye kayma sırasında smooth scroll
// geçici olarak kapatılır).
export default function HashDuzelt() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));

    const kokStil = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";

    const git = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: "start" });
    };

    const gecikmeler = [0, 200, 500, 1000, 1800, 2800];
    const zamanlayicilar = gecikmeler.map(ms => window.setTimeout(git, ms));
    const eskiHaline = window.setTimeout(() => { document.documentElement.style.scrollBehavior = kokStil; }, 3000);
    window.addEventListener("load", git);

    return () => {
      zamanlayicilar.forEach(clearTimeout);
      clearTimeout(eskiHaline);
      window.removeEventListener("load", git);
      document.documentElement.style.scrollBehavior = kokStil;
    };
  }, []);

  return null;
}
