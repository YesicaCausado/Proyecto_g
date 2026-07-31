/**
 * ForgotPasswordPage — Recuperación de contraseña
 * Mismo layout que LoginPage: robot izquierda + tarjeta derecha.
 * El robot reacciona al input con lookingEmail / idle / loading / success.
 */
import { useState } from 'react';
import { Link }     from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Mail } from 'lucide-react';

import AuthPageLayout        from './components/AuthPageLayout';
import { useRobotContext }   from '../../context/RobotContext';
import api                   from '../../services/api';

// ── Paleta (idéntica a LoginCard) ─────────────────────────────
const C = {
  bgInput:     '#EDECEA',
  bgInputFocus:'#FFFFFF',
  border:      '#E2DFD9',
  borderFocus: '#B8B0A4',
  text:        '#2C2A27',
  textSub:     '#7A766E',
  textMute:    '#A8A49D',
  accent:      '#1a1a1a',
  accentHover: '#333',
  error:       '#C0392B',
  errorBg:     '#FDF2F2',
  errorBorder: '#EAC4C4',
  success:     '#0F7B6C',
  successBg:   '#EEF7F4',
  successBorder:'#B3E3DA',
} as const;

// ── Tarjeta de recuperación ───────────────────────────────────

function ForgotPasswordCard() {
  const { driver } = useRobotContext();

  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');
  const [hoverBtn, setHoverBtn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError('');
    setLoading(true);
    driver.onEmailBlur();           // robot deja de mirar el campo
    driver.notifySuccess();         // robot va a "loading" (reutilizamos driver)

    try {
      await api.post('/auth/forgot-password', { username: username.trim() });
      setSent(true);
    } catch {
      setError('Error al procesar la solicitud. Intenta de nuevo.');
      driver.notifyError();
    } finally {
      setLoading(false);
    }
  };

  // ── Vista de éxito ────────────────────────────────────────
  if (sent) {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Ícono de éxito */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: C.successBg, border: `1.5px solid ${C.successBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <CheckCircle size={22} color={C.success} strokeWidth={1.8} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.5px', margin: '0 0 8px' }}>
          Revisa tu correo
        </h1>
        <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6, margin: '0 0 24px' }}>
          Si los datos son correctos, recibirás las instrucciones para
          restablecer tu contraseña. El enlace expira en{' '}
          <strong style={{ color: C.text }}>15 minutos</strong>.
        </p>

        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: '#F7F6F3', border: `1px solid ${C.border}`,
          fontSize: 11.5, color: C.textMute, lineHeight: 1.5, marginBottom: 28,
        }}>
          ¿No ves el correo? Revisa tu carpeta de spam o espera unos minutos.
        </div>

        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontSize: 13, color: C.textSub, textDecoration: 'none',
          fontWeight: 500, transition: 'color 150ms',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = C.text)}
          onMouseLeave={e => (e.currentTarget.style.color = C.textSub)}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  // ── Formulario ─────────────────────────────────────────────
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: '#F0EDE9', border: `1.5px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Mail size={17} color={C.textSub} strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '-0.4px', margin: 0, lineHeight: 1.2 }}>
            ¿Olvidaste tu contraseña?
          </h1>
          <p style={{ fontSize: 12.5, color: C.textMute, margin: '4px 0 0' }}>
            Te enviaremos un enlace de recuperación
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 14px', marginBottom: 18,
          background: C.errorBg, border: `1px solid ${C.errorBorder}`,
          borderRadius: 10,
        }}>
          <AlertCircle size={13} color={C.error} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: C.error, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Campo — conectado al robot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label htmlFor="fp-username" style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: C.textMute,
          }}>
            Usuario o correo
          </label>
          <input
            id="fp-username"
            type="text"
            value={username}
            autoFocus
            required
            placeholder="Ej: 1023456789 o tu@correo.com"
            onChange={e => {
              setUsername(e.target.value);
              driver.onEmailChange();
            }}
            onFocus={driver.onEmailFocus}
            onBlur={driver.onEmailBlur}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 14px',
              background: C.bgInput,
              border: `1.5px solid ${C.border}`,
              borderRadius: 10,
              fontSize: 13.5, color: C.text,
              outline: 'none',
              transition: 'border-color 180ms ease, box-shadow 180ms ease, background 180ms ease',
              boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.06), inset -1px -1px 3px rgba(255,255,255,0.7)',
            }}
            onFocusCapture={e => {
              e.currentTarget.style.background  = C.bgInputFocus;
              e.currentTarget.style.borderColor = C.borderFocus;
              e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(0,0,0,0.06)';
            }}
            onBlurCapture={e => {
              e.currentTarget.style.background  = C.bgInput;
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.boxShadow   = 'inset 2px 2px 5px rgba(0,0,0,0.06), inset -1px -1px 3px rgba(255,255,255,0.7)';
            }}
          />
          <p style={{ fontSize: 10.5, color: C.textMute, margin: 0 }}>
            Generalmente es tu número de documento
          </p>
        </div>

        {/* Botón */}
        <button
          type="submit"
          disabled={loading || !username.trim()}
          onMouseEnter={() => setHoverBtn(true)}
          onMouseLeave={() => setHoverBtn(false)}
          style={{
            marginTop: 4,
            width: '100%', padding: '12px',
            borderRadius: 10,
            background: hoverBtn && !loading ? C.accentHover : C.accent,
            border: 'none', color: '#FFF',
            fontSize: 13.5, fontWeight: 600,
            cursor: loading || !username.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !username.trim() ? 0.55 : 1,
            transition: 'background 150ms ease, transform 150ms ease, box-shadow 150ms ease',
            transform: hoverBtn && !loading ? 'translateY(-1px)' : 'translateY(0)',
            boxShadow: hoverBtn && !loading ? '0 6px 20px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin" />Enviando...</>
            : 'Enviar enlace de recuperación'
          }
        </button>
      </form>

      {/* Link volver */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: C.textMute, textDecoration: 'none',
          transition: 'color 150ms',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = C.textSub)}
          onMouseLeave={e => (e.currentTarget.style.color = C.textMute)}
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Volver al inicio de sesión
        </Link>
      </div>

    </div>
  );
}

// ── Página ────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout>
      <ForgotPasswordCard />
    </AuthPageLayout>
  );
}