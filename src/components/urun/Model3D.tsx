"use client";
import { useEffect, useRef, useState } from "react";

// Gerçek 3D model görüntüleyici — admin panelinden yüklenen dosyayı (glb/gltf/obj/stl/fbx)
// uzantısına göre doğru three.js loader'ıyla açar, sürükleyerek döndürmeyi/yakınlaştırmayı
// OrbitControls ile sağlar. AI ile üretilen "360° döner galeri" (Donus360) gerçek bir 3D model
// DEĞİLDİR; bu bileşen ise gerçek bir mesh render eder.
export default function Model3D({ url, alt, className, style }: { url: string; alt?: string; className?: string; style?: React.CSSProperties }) {
  const kutuRef = useRef<HTMLDivElement>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let iptal = false;
    let temizle: (() => void) | undefined;
    // setState çağrıları effect gövdesinden mikrotaska ertelenir (senkron cascading render uyarısını önlemek için).
    queueMicrotask(() => { if (!iptal) { setHata(null); setYukleniyor(true); } });

    (async () => {
      const kutu = kutuRef.current;
      if (!kutu) return;
      const uzanti = (url.split("?")[0].split(".").pop() || "").toLowerCase();

      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

        const genislik = kutu.clientWidth || 300, yukseklik = kutu.clientHeight || 300;
        const sahne = new THREE.Scene();
        const kamera = new THREE.PerspectiveCamera(40, genislik / yukseklik, 0.01, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(genislik, yukseklik, false);
        kutu.innerHTML = "";
        renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
        kutu.appendChild(renderer.domElement);

        sahne.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
        const yon = new THREE.DirectionalLight(0xffffff, 1.4);
        yon.position.set(2, 4, 3);
        sahne.add(yon);

        let nesne: import("three").Object3D;
        if (uzanti === "glb" || uzanti === "gltf") {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          const gltf = await new GLTFLoader().loadAsync(url);
          nesne = gltf.scene;
        } else if (uzanti === "obj") {
          const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
          nesne = await new OBJLoader().loadAsync(url);
        } else if (uzanti === "stl") {
          const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
          const geometry = await new STLLoader().loadAsync(url);
          const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.1, roughness: 0.7 });
          nesne = new THREE.Mesh(geometry, material);
        } else if (uzanti === "fbx") {
          const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
          nesne = await new FBXLoader().loadAsync(url);
        } else {
          throw new Error(`Desteklenmeyen 3D dosya türü: .${uzanti || "?"}`);
        }
        if (iptal) return;

        // Modeli sahnenin ortasına al ve kameraya sığacak şekilde ölçekle (farklı formatlar çok farklı birim/boyutta gelebilir).
        const kutu3 = new THREE.Box3().setFromObject(nesne);
        const merkez = kutu3.getCenter(new THREE.Vector3());
        const boyut = kutu3.getSize(new THREE.Vector3());
        const enBuyuk = Math.max(boyut.x, boyut.y, boyut.z) || 1;
        nesne.position.sub(merkez);
        const olcek = 1.6 / enBuyuk;
        nesne.scale.setScalar(olcek);
        sahne.add(nesne);

        kamera.position.set(0, 0.4, 2.4);
        const controls = new OrbitControls(kamera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 2.2;
        controls.minDistance = 1; controls.maxDistance = 6;

        let raf = 0;
        const dongu = () => { controls.update(); renderer.render(sahne, kamera); raf = requestAnimationFrame(dongu); };
        dongu();
        setYukleniyor(false);

        const boyutlandir = () => {
          const g = kutu.clientWidth || 300, h = kutu.clientHeight || 300;
          kamera.aspect = g / h; kamera.updateProjectionMatrix(); renderer.setSize(g, h, false);
        };
        window.addEventListener("resize", boyutlandir);
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(boyutlandir) : null;
        ro?.observe(kutu);

        temizle = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", boyutlandir);
          ro?.disconnect();
          controls.dispose();
          renderer.dispose();
          kutu.innerHTML = "";
        };
      } catch (e) {
        if (!iptal) { setHata(e instanceof Error ? e.message : "3D model yüklenemedi."); setYukleniyor(false); }
      }
    })();

    return () => { iptal = true; temizle?.(); };
  }, [url]);

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", minWidth: 0, maxWidth: "100%", ...style }} role="img" aria-label={alt || "3D model önizleme"}>
      <div ref={kutuRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />
      {yukleniyor && !hata && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#6b7366" }}>Model yükleniyor…</div>
      )}
      {hata && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#e55f28", textAlign: "center", padding: 12 }}>{hata}</div>
      )}
    </div>
  );
}
