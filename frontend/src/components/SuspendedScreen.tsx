/**
 * SuspendedScreen — NeuroLearn AI
 * ================================
 * Pantalla de bloqueo total cuando la licencia está suspendida.
 * Se muestra en lugar del panel completo.
 */
import { ShieldOff, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SuspendedScreenProps {
  role: 'profesor' | 'estudiante';
}

export default function SuspendedScreen({ role }: SuspendedScreenProps) {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  if (role === 'profesor') {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-[#E9E9E7] rounded-xl p-10 text-center shadow-sm">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldOff className="w-7 h-7 text-[#E03E3E]" />
          </div>
          <h1 className="text-xl font-bold text-[#191919] mb-2">Licencia suspendida</h1>
          <p className="text-sm text-[#787774] leading-relaxed mb-6">
            La licencia de tu institución ha sido suspendida. El acceso a NeuroLearn
            está temporalmente restringido.{' '}
            <strong className="text-[#37352F]">
              Contacta al Super Profesor (Rector) para más información.
            </strong>
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Estudiante
  return (
    <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-[#E9E9E7] rounded-xl p-10 text-center shadow-sm">
        <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <GraduationCap className="w-7 h-7 text-[#D9730D]" />
        </div>
        <h1 className="text-xl font-bold text-[#191919] mb-2">
          Acceso temporalmente no disponible
        </h1>
        <p className="text-sm text-[#787774] leading-relaxed mb-6">
          La licencia de tu institución se encuentra suspendida. Comunícate con tu
          institución para obtener información sobre la reactivación del servicio.
        </p>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
