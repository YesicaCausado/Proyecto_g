/**
 * LicenseBanner — NeuroLearn AI
 * ================================
 * Banner superior que aparece cuando la licencia está próxima a vencer o vencida.
 * Amarillo: 30-16 días | Naranja: 15-8 días | Rojo: 7 días o menos / vencida
 */
import { AlertTriangle, X, Phone } from 'lucide-react';
import { useState } from 'react';
import { useLicense } from '../context/LicenseContext';
import { useAuth } from '../context/AuthContext';

interface LicenseBannerProps {
  showContactButton?: boolean; // true = profesor, false = estudiante
}

export default function LicenseBanner({ showContactButton = false }: LicenseBannerProps) {
  const { licenseStatus, daysLeft } = useLicense();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Solo mostrar si la licencia está próxima a vencer o vencida
  if (dismissed) return null;
  if (licenseStatus === 'active' || licenseStatus === 'suspended') return null;

  // ── Colores según urgencia ─────────────────────────────────────────────────
  let bg      = 'bg-yellow-50 border-yellow-300';
  let text    = 'text-yellow-800';
  let icon    = 'text-yellow-500';
  let message = '';

  if (licenseStatus === 'expired') {
    bg      = 'bg-red-50 border-red-300';
    text    = 'text-red-800';
    icon    = 'text-red-500';
    message = 'La licencia de tu institución ha expirado. Algunas funciones están deshabilitadas hasta que se renueve.';
  } else if (daysLeft !== null) {
    if (daysLeft <= 7) {
      bg      = 'bg-red-50 border-red-300';
      text    = 'text-red-800';
      icon    = 'text-red-500';
      message = `La licencia de tu institución vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}. Algunas funciones podrían dejar de estar disponibles si no se renueva a tiempo.`;
    } else if (daysLeft <= 15) {
      bg      = 'bg-orange-50 border-orange-300';
      text    = 'text-orange-800';
      icon    = 'text-orange-500';
      message = `La licencia de tu institución vence en ${daysLeft} días. Algunas funciones podrían dejar de estar disponibles si no se renueva a tiempo.`;
    } else {
      message = `La licencia de tu institución vence en ${daysLeft} días. Algunas funciones podrían dejar de estar disponibles si no se renueva a tiempo.`;
    }
  }

  if (!message) return null;

  return (
    <div className={`${bg} border-b ${text} px-4 py-2.5 flex items-center gap-3 text-sm flex-shrink-0`}>
      <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${icon}`} />
      <span className="flex-1">{message}</span>

      {/* Botón para profesor */}
      {showContactButton && user?.role === 'profesor' && (
        <button className={`flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2 flex-shrink-0 hover:opacity-80`}>
          <Phone className="w-3.5 h-3.5" />
          Contactar al Rector
        </button>
      )}

      {/* Solo cerrable si no está vencida */}
      {licenseStatus !== 'expired' && (
        <button
          onClick={() => setDismissed(true)}
          className={`p-0.5 rounded hover:opacity-60 flex-shrink-0 ${icon}`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
