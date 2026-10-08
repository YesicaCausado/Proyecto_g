// Las notificaciones viven en un solo proveedor para toda la app
// (context/NotificationsContext.tsx): contador real, lista persistente y
// marcado como leídas en el servidor.
export { useNotifications, type AppNotification } from '../context/NotificationsContext';
