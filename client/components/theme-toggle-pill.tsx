import React from "react";

type ThemeTogglePillProps = {
  theme: string;
  onToggle: () => void;
  ariaLabel?: string;
  className?: string;
};

/** Accessible theme toggle (tpill pattern from content-plan / workspace-top-bar). */
export function ThemeTogglePill({ theme, onToggle, ariaLabel, className = "tpill" }: ThemeTogglePillProps) {
  const isDark = theme === "dark";
  return (
    <div
      className={className}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel || (isDark ? "Светлая тема" : "Тёмная тема")}
    >
      <div className={"tpi" + (isDark ? " on" : "")}>☽</div>
      <div className={"tpi" + (!isDark ? " on" : "")}>☀</div>
    </div>
  );
}
