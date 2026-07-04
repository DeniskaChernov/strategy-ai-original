import React, { useEffect, useRef, useState } from "react";

export type CustomSelectOption = { value: string; label: string; dot?: string };

export function CustomSelect({
  value,
  onChange,
  options,
  disabled,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: CustomSelectOption[];
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cur = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        role="combobox"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid var(--input-border)",
          background: "var(--input-bg)",
          color: "var(--text)",
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          minWidth: 0,
          maxWidth: "100%",
          fontFamily: "inherit",
        }}
      >
        {cur?.dot && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: cur.dot, flexShrink: 0 }} />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur?.label}</span>
        <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div
          className="glass-panel"
          role="listbox"
          aria-label="Options"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            zIndex: 300,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg2)",
            boxShadow: "0 16px 48px rgba(0,0,0,.35)",
            maxHeight: 280,
            overflowY: "auto",
            padding: "6px 0",
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px",
                border: "none",
                background: o.value === value ? "var(--accent-soft)" : "transparent",
                color: "var(--text2)",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              {o.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.dot, flexShrink: 0 }} />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
