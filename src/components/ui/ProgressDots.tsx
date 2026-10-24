"use client";

const SECTIONS = ["hero","products","h-pin","collection","why","contact"];

export default function ProgressDots() {
  return (
    <nav className="progress-dots hidden lg:flex" aria-label="Sayfa navigasyonu">
      {SECTIONS.map((_, i) => (
        <button
          key={i}
          className="progress-dot"
          aria-label={`Section ${i + 1}`}
          onClick={() => {
            document.getElementById(SECTIONS[i])?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      ))}
    </nav>
  );
}
