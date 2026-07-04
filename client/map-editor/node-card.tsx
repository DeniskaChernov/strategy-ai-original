import React from "react";

type NodeCardProps = {
  node: any;
  selected: boolean;
  focused?: boolean;
  connecting?: boolean;
  connectSource?: any;
  onClick: (node: any, ev?: { shiftKey?: boolean }) => void;
  onMouseDown: (e: React.PointerEvent, node: any) => void;
  onContextMenu: (x: number, y: number, node: any) => void;
  theme?: string;
  statusMap?: Record<string, { c?: string; label?: string }>;
};

export function NodeCard({
  node,
  selected,
  focused = false,
  onClick,
  onMouseDown,
  onContextMenu,
  statusMap = {},
}: NodeCardProps) {
  const statusCfg = statusMap[node?.status] || statusMap.planning || { c: "#6836f5" };
  const statusColor = statusCfg.c || "#6836f5";
  const title = String(node?.title || "Шаг");
  const progress = Math.max(0, Math.min(100, Number(node?.progress) || 0));
  const showTitle = title.length > 28 ? `${title.slice(0, 28)}…` : title;
  const barW = Math.round((180 * progress) / 100);

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onPointerDown={(e) => onMouseDown(e, node)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node, { shiftKey: (e as unknown as React.MouseEvent).shiftKey });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e.clientX, e.clientY, node);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick(node, { shiftKey: e.shiftKey });
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={title}
      style={{ cursor: "pointer" }}
    >
      {focused ? (
        <rect
          x={-4}
          y={-4}
          width={248}
          height={136}
          rx={16}
          fill="none"
          stroke={statusColor}
          strokeWidth={2}
          opacity={0.45}
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      <rect
        x={0}
        y={0}
        width={240}
        height={128}
        rx={14}
        fill="var(--card)"
        stroke={selected ? statusColor : "var(--border)"}
        strokeWidth={selected ? 2.2 : 1}
      />
      <rect x={0} y={0} width={240} height={4} rx={2} fill={statusColor} opacity={0.95} />
      <text
        x={14}
        y={24}
        fontSize={9}
        fontWeight={700}
        fill={statusColor}
        style={{ letterSpacing: 1, textTransform: "uppercase", pointerEvents: "none" }}
      >
        {String(node?.status || "").slice(0, 18)}
      </text>
      <text
        x={14}
        y={48}
        fontSize={13}
        fontWeight={700}
        fill="var(--text)"
        style={{ pointerEvents: "none" }}
      >
        {showTitle}
      </text>
      <rect x={14} y={58} width={180} height={4} rx={2} fill="var(--border)" opacity={0.55} />
      <rect x={14} y={58} width={barW} height={4} rx={2} fill={statusColor} />
      <text x={194} y={83} textAnchor="end" fontSize={11} fontWeight={700} fill="var(--text4)">
        {progress}%
      </text>
    </g>
  );
}
