import React from "react";
import { useIsMobile } from "../hooks/use-is-mobile";
import { TrialBanner, EmailVerifyBanner } from "./trial-email-banners";
import { ProfileModal } from "../strategy-modals/profile-modal";

type AuthenticatedAppShellProps = {
  user: any;
  theme: string;
  palette: string;
  showProfile: boolean;
  onShowProfile: (open: boolean) => void;
  onUpgrade: () => void;
  onUpdateUser: (u: any) => void;
  onChangeTier: (tier: string) => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onToggleTheme: () => void;
  onPaletteChange: (p: string) => void;
  children: React.ReactNode;
};

/** Общая оболочка authenticated-экранов: баннеры trial/email + ProfileModal. */
export function AuthenticatedAppShell({
  user,
  theme,
  palette,
  showProfile,
  onShowProfile,
  onUpgrade,
  onUpdateUser,
  onChangeTier,
  onLogout,
  onToggleTheme,
  onPaletteChange,
  children,
}: AuthenticatedAppShellProps) {
  const isMobile = useIsMobile();
  const settingsShell = !isMobile;
  return (
    <div className="screen-enter" style={{ height: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
      <TrialBanner user={user} onUpgrade={onUpgrade} />
      <EmailVerifyBanner user={user} />
      {children}
      {showProfile && (
        <ProfileModal
          user={user}
          theme={theme}
          palette={palette}
          onPaletteChange={onPaletteChange}
          onClose={() => onShowProfile(false)}
          onUpdate={onUpdateUser}
          onChangeTier={onChangeTier}
          onLogout={onLogout}
          onToggleTheme={onToggleTheme}
          settingsShell={settingsShell}
        />
      )}
    </div>
  );
}
