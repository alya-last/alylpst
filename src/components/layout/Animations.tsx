"use client";
import { useEffect } from "react";

export default function Animations() {
  useEffect(() => {
    let rafId: number;
    let killed = false;

    const init = async () => {
      const gsapMod  = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      const { SplitText }     = await import("gsap/SplitText");

      const gsap = gsapMod.gsap;
      gsap.registerPlugin(ScrollTrigger, SplitText);

      if (killed) return;

      // ScrollTrigger config — body'yi overflow hidden yapmasın
      ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" });
      ScrollTrigger.refresh();

      // ── 2. SCROLL PROGRESS ─────────────────────────────────
      const bar = document.querySelector<HTMLElement>(".scroll-progress");
      if (bar) {
        ScrollTrigger.create({
          trigger: document.body,
          start: "top top",
          end: "bottom bottom",
          scrub: 0,
          onUpdate: (self) => { bar.style.height = self.progress * 100 + "%"; },
        });
      }

      // ── 3. PROGRESS DOTS ────────────────────────────────────
      const sects = document.querySelectorAll<HTMLElement>("section[id]");
      const dots  = document.querySelectorAll<HTMLElement>(".progress-dot");
      sects.forEach((sec, i) => {
        ScrollTrigger.create({
          trigger: sec, start: "top 55%", end: "bottom 45%",
          onEnter:     () => dots.forEach((d,j) => d.classList.toggle("active", j===i)),
          onEnterBack: () => dots.forEach((d,j) => d.classList.toggle("active", j===i)),
        });
      });

      // ── 4. HERO LINES ───────────────────────────────────────
      const heroLines = gsap.utils.toArray<HTMLElement>(".anim-hero-line");
      if (heroLines.length) {
        gsap.fromTo(heroLines,
          { yPercent: 115, skewY: 4 },
          { yPercent: 0, skewY: 0, duration: 1.15, ease: "expo.out", stagger: 0.11, delay: 0.15, clearProps: "transform" }
        );
      }
      const heroSubs = gsap.utils.toArray<HTMLElement>(".anim-hero-sub");
      if (heroSubs.length) {
        gsap.fromTo(heroSubs,
          { opacity: 0, y: 26 },
          { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.08, delay: 0.85, clearProps: "transform,opacity" }
        );
      }

      // ── 5. SLOT MACHINE ────────────────────────────────────
      await new Promise(r => setTimeout(r, 120));
      gsap.utils.toArray<HTMLElement>(".slot-ticker").forEach((ticker) => {
        const target = parseInt(ticker.dataset.target || "0");
        const suffix = ticker.dataset.suffix || "";
        const inner  = ticker.querySelector<HTMLElement>(".slot-ticker-inner");
        if (!inner || target === 0) return;
        // items
        const items: string[] = [];
        for (let i = 0; i <= target; i++) items.push(`${i}${suffix}`);
        inner.innerHTML = items.map(d => `<span style="display:block;line-height:1">${d}</span>`).join("");
        // measure one item height
        const firstSpan = inner.querySelector("span");
        const itemH = firstSpan ? firstSpan.getBoundingClientRect().height || 60 : 60;
        inner.style.transform = "translateY(0)";
        ScrollTrigger.create({
          trigger: ticker, start: "top 85%", once: true,
          onEnter: () => {
            gsap.to(inner, { y: -(itemH * (items.length - 1)), duration: 1.8, ease: "expo.out" });
          },
        });
      });

      // ── 6. TEXT SCRAMBLE ────────────────────────────────────
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%";
      gsap.utils.toArray<HTMLElement>(".scramble").forEach((el) => {
        const original = el.textContent || "";
        ScrollTrigger.create({
          trigger: el, start: "top 88%", once: true,
          onEnter: () => {
            let frame = 0;
            const total = 18;
            const id = setInterval(() => {
              el.textContent = original.split("").map((ch, i) =>
                ch === " " || i < Math.floor((frame / total) * original.length)
                  ? ch : chars[Math.floor(Math.random() * chars.length)]
              ).join("");
              if (++frame > total) { el.textContent = original; clearInterval(id); }
            }, 38);
          },
        });
      });

      // ── 7. SPLIT TEXT ───────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".anim-split-heading").forEach((el) => {
        const split = new SplitText(el, { type: "chars,words" });
        gsap.fromTo(split.chars,
          { yPercent: 110, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.02,
            scrollTrigger: { trigger: el, start: "top 88%", once: true } }
        );
      });

      // ── 8. CLIP REVEAL ──────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".anim-clip").forEach((el) => {
        gsap.fromTo(el, { clipPath: "inset(0 0 100% 0)" },
          { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "expo.inOut",
            scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      });

      // ── 9. FADE UP ──────────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".anim-up").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 42 },
          { opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
            delay: parseFloat(el.dataset.delay || "0"),
            scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });

      // ── 10. STAGGER ─────────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".anim-stagger-parent").forEach((p) => {
        const kids = p.querySelectorAll<HTMLElement>(".anim-stagger-child");
        gsap.fromTo(kids, { opacity: 0, y: 38, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.72, ease: "power3.out", stagger: 0.07,
            scrollTrigger: { trigger: p, start: "top 85%", once: true } });
      });

      // ── 11. LIST ────────────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".anim-list").forEach((list) => {
        const items = list.querySelectorAll<HTMLElement>(".anim-list-item");
        gsap.fromTo(items, { opacity: 0, x: -26 },
          { opacity: 1, x: 0, duration: 0.62, ease: "power2.out", stagger: 0.06,
            scrollTrigger: { trigger: list, start: "top 85%", once: true } });
      });

      // ── 12. IMG REVEAL ──────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".anim-img-reveal").forEach((wrap) => {
        const img = wrap.querySelector("img");
        gsap.fromTo(wrap, { clipPath: "inset(0 0 100% 0)" },
          { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "expo.inOut",
            scrollTrigger: { trigger: wrap, start: "top 85%", once: true } });
        if (img) gsap.fromTo(img, { scale: 1.18 },
          { scale: 1, duration: 1.2, ease: "expo.inOut",
            scrollTrigger: { trigger: wrap, start: "top 85%", once: true } });
      });

      // ── 13. HERO PARALLAX ───────────────────────────────────
      const bg  = document.querySelector<HTMLElement>(".js-hero-bg");
      const prd = document.querySelector<HTMLElement>(".js-hero-product");
      const heroEl = document.querySelector<HTMLElement>("#hero");
      if (bg || prd) {
        ScrollTrigger.create({
          trigger: "#hero", start: "top top", end: "bottom top", scrub: 1.2,
          onUpdate: (self) => {
            if (bg)  gsap.set(bg,  { scale: 1.06 + self.progress * 0.05, y: self.progress * 80 });
            if (prd) gsap.set(prd, { y: self.progress * 120 });
          },
        });
      }
      if (heroEl && (bg || prd)) {
        heroEl.addEventListener("mousemove", (e) => {
          const ev = e as MouseEvent;
          const x = (ev.clientX / window.innerWidth  - 0.5) * 18;
          const y = (ev.clientY / window.innerHeight - 0.5) * 10;
          if (bg)  gsap.to(bg,  { x: x * 0.2,  y: y * 0.15, duration: 1,   ease: "power2.out", overwrite: "auto" });
          if (prd) gsap.to(prd, { x: x * 0.45, y: y * 0.35, duration: 0.8, ease: "power2.out", overwrite: "auto" });
        });
      }

      // ── 14. HORIZONTAL PIN ──────────────────────────────────
      const hSec   = document.querySelector<HTMLElement>("#h-pin");
      const hTrack = document.querySelector<HTMLElement>(".h-pin-track");
      if (hSec && hTrack) {
        const getX = () => -(hTrack.scrollWidth - window.innerWidth + 60);
        ScrollTrigger.create({
          trigger: hSec,
          start: "top top",
          end: () => `+=${Math.max(hTrack.scrollWidth - window.innerWidth, 100)}`,
          pin: true,
          pinType: "transform",
          pinSpacing: true,
          scrub: 1.2,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => { gsap.set(hTrack, { x: self.progress * getX() }); },
        });
      }

      // ── 15–17. MOUSE EFFECTS (desktop only) ─────────────────
      const isFine = window.matchMedia("(pointer: fine)").matches;
      if (isFine) {
        // Tilt
        gsap.utils.toArray<HTMLElement>(".tilt-card").forEach((card) => {
          card.addEventListener("mousemove", (e) => {
            const r  = card.getBoundingClientRect();
            const dx = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
            const dy = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
            gsap.to(card, { rotateY: dx * 14, rotateX: -dy * 14, duration: 0.35, ease: "power2.out", transformPerspective: 700 });
          });
          card.addEventListener("mouseleave", () => {
            gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.65, ease: "elastic.out(1,0.45)" });
          });
        });

        // Magnetic
        gsap.utils.toArray<HTMLElement>(".anim-magnetic").forEach((btn) => {
          btn.addEventListener("mousemove", (e) => {
            const r = btn.getBoundingClientRect();
            gsap.to(btn, { x: (e.clientX - r.left - r.width/2) * 0.36, y: (e.clientY - r.top - r.height/2) * 0.36, duration: 0.38, ease: "power2.out" });
          });
          btn.addEventListener("mouseleave", () => {
            gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,0.42)" });
          });
        });

        // 360 spin
        gsap.utils.toArray<HTMLElement>(".product-spin").forEach((el) => {
          let deg = 0;
          el.addEventListener("mouseenter", () => {
            deg += 360;
            gsap.to(el, { rotation: deg, duration: 1.2, ease: "power3.inOut" });
          });
        });
      }

      // ── 18. LINE EXPAND ─────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".anim-line-expand").forEach((line) => {
        gsap.fromTo(line, { scaleX: 0, transformOrigin: "left center" },
          { scaleX: 1, duration: 1.1, ease: "expo.out",
            scrollTrigger: { trigger: line, start: "top 90%", once: true } });
      });

      // ── 19. EYEBROW ─────────────────────────────────────────
      gsap.utils.toArray<HTMLElement>(".anim-eyebrow").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, letterSpacing: "0.45em" },
          { opacity: 1, letterSpacing: "0.2em", duration: 0.85, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });

      // ── 20. BG MORPH ────────────────────────────────────────
      gsap.utils.toArray<HTMLElement>("[data-bg]").forEach((sec) => {
        ScrollTrigger.create({
          trigger: sec as HTMLElement, start: "top 55%", end: "bottom 45%",
          onEnter:     () => gsap.to("body", { backgroundColor: (sec as HTMLElement).dataset.bg!, duration: 0.65, ease: "power2.inOut" }),
          onEnterBack: () => gsap.to("body", { backgroundColor: (sec as HTMLElement).dataset.bg!, duration: 0.65, ease: "power2.inOut" }),
        });
      });

      // ── CURSOR ──────────────────────────────────────────────
      // html.cursor-live eklenmeden gerçek imleç gizlenmiyor (bkz. globals.css) —
      // bu yüzden JS her nedenle çalışmazsa/gecikirse kullanıcı asla imleçsiz kalmaz.
      const dot  = document.querySelector<HTMLElement>(".cursor-dot");
      const ring = document.querySelector<HTMLElement>(".cursor-ring");
      let removeCursorListeners: (() => void) | undefined;
      if (isFine && dot && ring) {
        let rx = -999, ry = -999, mx = -999, my = -999;
        const mv = (e: MouseEvent) => {
          mx = e.clientX; my = e.clientY;
          dot.style.left = mx + "px"; dot.style.top = my + "px";
          dot.style.opacity = "1"; ring.style.opacity = "1";
        };
        const animRing = () => {
          if (killed) return;
          rx += (mx - rx) * 0.11; ry += (my - ry) * 0.11;
          ring.style.left = rx + "px"; ring.style.top = ry + "px";
          rafId = requestAnimationFrame(animRing);
        };
        rafId = requestAnimationFrame(animRing);
        document.addEventListener("mousemove", mv);

        // querySelectorAll("a,button") bir kerelik tarama yapıyordu: menü/ürün
        // kartları gibi sonradan DOM'a eklenen elementler hover efektini hiç
        // almıyordu. Bunun yerine document üzerinde delegation kullanılıyor —
        // hangi element sonradan eklenirse eklensin çalışır.
        const onOver = (e: Event) => {
          if ((e.target as HTMLElement)?.closest?.("a,button")) ring.classList.add("hovered");
        };
        const onOut = (e: Event) => {
          if ((e.target as HTMLElement)?.closest?.("a,button")) ring.classList.remove("hovered");
        };
        document.addEventListener("mouseover", onOver);
        document.addEventListener("mouseout", onOut);

        // Gerçek imleç ancak artık bunun yerini alacak özel imleç fiilen
        // hareket etmeye başladıktan sonra CSS ile gizlenir.
        document.documentElement.classList.add("cursor-live");

        removeCursorListeners = () => {
          document.removeEventListener("mousemove", mv);
          document.removeEventListener("mouseover", onOver);
          document.removeEventListener("mouseout", onOut);
          document.documentElement.classList.remove("cursor-live");
        };
      }

      return () => {
        killed = true;
        ScrollTrigger.killAll();
        cancelAnimationFrame(rafId);
        removeCursorListeners?.();
      };
    };

    let cleanup: (() => void) | undefined;
    init().then(fn => { cleanup = fn; });

    return () => {
      killed = true;
      cleanup?.();
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" />
      <div className="cursor-dot" style={{ opacity: 0 }} />
      <div className="cursor-ring" style={{ opacity: 0 }} />
    </>
  );
}
