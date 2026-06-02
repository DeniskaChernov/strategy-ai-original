import { useEffect, useRef, useState } from "react";

// Плавный count-up для числовых метрик (дашборд, инсайты).
// Уважает prefers-reduced-motion — тогда сразу показывает конечное значение.
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const safeTarget = Number.isFinite(target) ? target : 0;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || durationMs <= 0) { setValue(safeTarget); return; }

    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const current = from + (safeTarget - from) * eased;
      setValue(current);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = safeTarget;
        setValue(safeTarget);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [target, durationMs]);

  return value;
}
