/**
 * ForgotPasswordPage — Solicitar recuperación de contraseña
 * El usuario ingresa su usuario o email y recibe un correo con el enlace.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react';
import api from '../../services/api';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { username: username.trim() });
      // Siempre mostramos éxito — el backend no revela si el usuario existe
      setSent(true);
    } catch {
      // Solo mostramos error si hay falla de red o servidor (500)
      setError('Error al procesar la solicitud. Intenta de nuevo en unos momentos.');
    } finally {
      setLoading(false);
    }
  };

  // ── Pantalla de éxito ─────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-400/10 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-md border border-[#E9E9E7] p-8 text-center">
            <div className="w-14 h-14 bg-[#EEF7F4] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-[#0F7B6C]" />
            </div>
            <h2 className="text-xl font-bold text-[#191919] mb-2">
              Revisa tu correo
            </h2>
            <p className="text-sm text-[#787774] leading-relaxed mb-6">
              Si los datos ingresados son correctos, recibirás un correo
              con las instrucciones para restablecer tu contraseña.
              <br /><br />
              El enlace expira en <strong className="text-[#37352F]">15 minutos</strong>.
            </p>
            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-3 mb-6 text-xs text-[#787774]">
              ¿No ves el correo? Revisa tu carpeta de spam o solicita
              un nuevo enlace en unos minutos.
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-[#37352F] font-medium hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-400/10 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-600 rounded-md flex items-center justify-center mx-auto mb-4">
            <Brain className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#191919]">NeuroLearn IA</h1>
          <p className="text-[#787774] mt-1">Recuperación de contraseña</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-md border border-[#E9E9E7] p-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-full flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-[#37352F]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#191919]">
                ¿Olvidaste tu contraseña?
              </h2>
              <p className="text-xs text-[#787774]">
                Ingresa tu usuario o correo y te enviaremos un enlace
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-[#FDEEEE] border border-[#F4BDBD] text-[#E03E3E] text-sm rounded-md px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#787774] mb-1">
                Usuario o correo electrónico
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: 1023456789 o usuario@colegio.edu.co"
                required
                autoFocus
                className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none transition-colors text-sm text-[#37352F]"
              />
              <p className="text-xs text-[#9B9A97] mt-1">
                Generalmente es tu número de documento
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full bg-[#37352F] text-white py-2.5 rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar enlace de recuperación'
              )}
            </button>
          </form>

          <div className="flex justify-center mt-5">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-[#787774] hover:text-[#37352F] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}