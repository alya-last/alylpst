"use client";
import { useEffect } from "react";
import { M } from "@/lib/site-metin";
import type { Dil } from "@/lib/diller";

// Kök layout tek olduğundan (ve statik/ISR sayfaları dinamiğe çevirmeden düzeltmek mümkün
// olmadığından — bkz. next/root-params, tüm route'ların app/[lang] altına taşınmasını
// gerektiriyor) <html lang> istemcide sayfanın diline ayarlanır (ekran okuyucu/çeviri araçları
// ve JS çalıştıran arama motoru botları için). Tüm dil sayfalarında (ana sayfa + ürün sayfası)
// kullanılmalı; yalnızca TR'ye özel statik sayfalarda (hakkımızda vb.) gerek yok.
export default function HtmlLang({ dil }: { dil: Dil }) {
  useEffect(() => {
    const onceki = document.documentElement.lang;
    document.documentElement.lang = M[dil].htmlLang;
    return () => { document.documentElement.lang = onceki; };
  }, [dil]);
  return null;
}
