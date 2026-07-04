import React, { useState } from "react";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useNotifications } from "../hooks/use-notifications";
import { NotifBell } from "./notif-bell";
import { NotificationsCenterModal } from "../strategy-modals/notifications-ai-hub-modals";

type NotificationsHostProps = {
  userEmail?: string;
  /** Render prop: получает unread count и opener для модалки. */
  children?: (props: { notifUnread: number; openNotifs: () => void }) => React.ReactNode;
  /** Если true — рендерит NotifBell inline (для mobile topbars). */
  showBell?: boolean;
  bellClassName?: string;
};

/** Единая точка: useNotifications + NotifBell + NotificationsCenterModal. */
export function NotificationsHost({
  userEmail,
  children,
  showBell = false,
  bellClassName = "btn-ic",
}: NotificationsHostProps) {
  const { t, lang } = useLang();
  const isMobile = useIsMobile();
  const [showNotifs, setShowNotifs] = useState(false);
  const { notifs, setNotifs, notifUnread, setNotifUnread, notifLoading, loadNotifications } = useNotifications(
    showNotifs,
    userEmail
  );

  const openNotifs = () => setShowNotifs(true);

  return (
    <>
      {children ? children({ notifUnread, openNotifs }) : null}
      {showBell && userEmail ? (
        <NotifBell unread={notifUnread} onClick={openNotifs} className={bellClassName} />
      ) : null}
      {showNotifs && (
        <NotificationsCenterModal
          open={showNotifs}
          onClose={() => setShowNotifs(false)}
          isMobile={isMobile}
          notifs={notifs}
          setNotifs={setNotifs}
          notifUnread={notifUnread}
          setNotifUnread={setNotifUnread}
          notifLoading={notifLoading}
          lang={lang}
          t={t}
          loadNotifications={loadNotifications}
        />
      )}
    </>
  );
}
