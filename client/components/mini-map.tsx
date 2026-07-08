import React from "react";
import { getSTATUS } from "../lib/strategy-labels";
import { useLang } from "../lang-context";

export function MiniMap({
  nodes,
  edges,
  viewX,
  viewY,
  zoom,
  canvasW,
  canvasH,
  onJump,
  theme: _theme,
  statusMap,
  shellDock,
}: {
  nodes: Array<{ id: string; x: number; y: number; status?: string }>;
  edges: Array<{ id: string; source: string; target: string }>;
  viewX: number;
  viewY: number;
  zoom: number;
  canvasW: number;
  canvasH: number;
  onJump: (x: number, y: number) => void;
  theme?: string;
  statusMap?: Record<string, { c: string; label?: string }>;
  /** Canvas-first map: dock above corner controls / prompt */
  shellDock?: boolean;
}) {
  const { t } = useLang();
  const STATUS = statusMap || getSTATUS(t);
  const W = 180;
  const H = 110;
  if (!nodes.length) return null;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - 20;
  const maxX = Math.max(...xs) + 260;
  const minY = Math.min(...ys) - 20;
  const maxY = Math.max(...ys) + 148;
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const sx = W / bw;
  const sy = H / bh;
  const s = Math.min(sx, sy) * 0.9;
  const ox = (W - bw * s) / 2;
  const oy = (H - bh * s) / 2;
  const tx = (n: (typeof nodes)[0]) => (n.x - minX) * s + ox;
  const ty = (n: (typeof nodes)[0]) => (n.y - minY) * s + oy;
  const vpW = (canvasW / zoom) * s;
  const vpH = (canvasH / zoom) * s;
  const vpX = (-viewX / zoom - minX) * s + ox;
  const vpY = (-viewY / zoom - minY) * s + oy;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / W;
    const cy = (e.clientY - rect.top) / H;
    const wx = minX + cx * bw;
    const wy = minY + cy * bh;
    onJump(-(wx - canvasW / zoom / 2) * zoom, -(wy - canvasH / zoom / 2) * zoom);
  }

  return (
    <div
      onClick={handleClick}
      className="sa-mini-map-wrap"
      aria-label={t("minimap_hint", "Миникарта")}
      title={t("minimap_hint", "Миникарта")}
      style={{
        position: "absolute",
        bottom: shellDock ? 132 : 28,
        right: shellDock ? 14 : 28,
        width: W,
        height: H,
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--bg2)",
        border: ".5px solid var(--b1)",
        boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        cursor: "crosshair",
        zIndex: 50,
      }}
    >
      <svg width={W} height={H}>
        {edges.map((e) => {
          const s2 = nodes.find((n) => n.id === e.source);
          const t2 = nodes.find((n) => n.id === e.target);
          if (!s2 || !t2) return null;
          return <line key={e.id} x1={tx(s2) + 12} y1={ty(s2) + 7} x2={tx(t2) + 12} y2={ty(t2) + 7} stroke="var(--accent-1)" strokeWidth={1} opacity={0.35} />;
        })}
        {nodes.map((n) => {
          const st = STATUS[n.status || "planning"];
          return (
            <rect
              key={n.id}
              x={tx(n)}
              y={ty(n)}
              width={24}
              height={14}
              rx={3}
              fill={st ? st.c + "33" : "var(--accent-soft)"}
              stroke={st ? st.c : "var(--accent-1)"}
              strokeWidth={0.8}
            />
          );
        })}
        <rect
          className="sa-mini-map-vp"
          x={Math.max(0, vpX)}
          y={Math.max(0, vpY)}
          width={Math.min(vpW, W)}
          height={Math.min(vpH, H)}
          fill="rgba(104,54,245,.18)"
          stroke="var(--accent-1)"
          strokeWidth={1.2}
          strokeDasharray="4,3"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}
