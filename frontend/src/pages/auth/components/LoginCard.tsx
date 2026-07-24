/**
 * LoginCard.tsx — Neumorphism premium
 * Estilo: limpio, minimalista, tarjeta flotante sobre fondo neutro.
 * Inspirado en la referencia de la imagen.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

import { useAuth }         from '../../../context/AuthContext';
import { useRobotContext } from '../../../context/RobotContext';

// ── Paleta ───────────────────────────────────────────────────
const C = {
  bg:          '#F4F2EF',    // fondo tarjeta
  bgInput:     '#EDECEA',    // input resting
  bgInputFocus:'#FFFFFF',
  border:      '#E2DFD9',
  borderFocus: '#B8B0A4',
  text:        '#2C2A27',
  textSub:     '#7A766E',
  textMute:    '#A8A49D',
  accent:      '#1a1a1a',    // botón
  accentHover: '#333',
  error:       '#C0392B',
  errorBg:     '#FDF2F2',
  errorBorder: '#EAC4C4',
} as const;

// ── Tipos ─────────────────────────────────────────────────────

interface LoginCardProps { className?: string }

interface CardInputProps {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void; onBlur?: () => void; required?: boolean;
}

interface DemoBtn {
  label: string; role: string;
  dot: string; text: string; bg: string; border: string;
}

const DEMOS: DemoBtn[] = [
  { label: 'Estudiante',     role: 'demo',          dot: '#5AAFD8', text: '#0B6E99', bg: '#EAF4FB', border: '#C8E5F5' },
  { label: 'Profesor',       role: 'profesor',      dot: '#5DC8B4', text: '#0F7B6C', bg: '#EEF7F4', border: '#B3E3DA' },
  { label: 'Admin',          role: 'admin',         dot: '#F2C84B', text: '#D9730D', bg: '#FEF4E8', border: '#F5D9A8' },
  { label: 'Super Profesor', role: 'superprofesor', dot: '#A78BCA', text: '#6940A5', bg: '#F4EFFB', border: '#D9CCE9' },
];
const DEMO_PWD: Record<string, string> = {
  demo: 'demo', profesor: 'profesor', admin: 'admin1234', superprofesor: 'superprofesor',
};

// ── Input neumorphism ─────────────────────────────────────────

function NeuInput({ id, label, type = 'text', placeholder, value, onChange, onFocus, onBlur, required = true }: CardInputProps) {
  const [show, setShow] = useState(false);
  const isPass = type === 'password';
  const resolvedType = isPass ? (show ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <label htmlFor={id} style={{
        fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: C.textMute,
      }}>{label}</label>

      <div style={{ position: 'relative' }}>
        <input
          id={id} type={resolvedType} placeholder={placeholder}
          value={value} onChange={onChange} required={required}
          autoComplete={isPass ? 'current-password' : 'username'}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: isPass ? '11px 40px 11px 14px' : '11px 14px',
            background: C.bgInput,
            border: `1.5px solid ${C.border}`,
            borderRadius: '10px',
            fontSize: '13.5px', color: C.text,
            outline: 'none',
            transition: 'border-color 180ms ease, box-shadow 180ms ease, background 180ms ease',
            /* Neumorphism sutil en reposo */
            boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.06), inset -1px -1px 3px rgba(255,255,255,0.7)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.background  = C.bgInputFocus;
            e.currentTarget.style.borderColor = C.borderFocus;
            e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(0,0,0,0.06)';
            onFocus?.();
          }}
          onBlur={(e) => {
            e.currentTarget.style.background  = C.bgInput;
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.boxShadow   = 'inset 2px 2px 5px rgba(0,0,0,0.06), inset -1px -1px 3px rgba(255,255,255,0.7)';
            onBlur?.();
          }}
        />
        {isPass && (
          <button type="button" tabIndex={-1} onClick={() => setShow(v => !v)}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.textMute, display: 'flex', alignItems: 'center', padding: 0,
            }}>
            {show ? <EyeOff size={14} strokeWidth={1.8}/> : <Eye size={14} strokeWidth={1.8}/>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

export default function LoginCard({ className = '' }: LoginCardProps) {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const { driver } = useRobotContext();

  const [form,    setForm]    = useState({ username: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [hoverBtn, setHoverBtn] = useState(false);

  const loginFn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          ?? 'Error al iniciar sesión';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={className}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      {/* ── Cabecera ───────────────────────────────────── */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '22px', fontWeight: 700, color: C.text,
          letterSpacing: '-0.5px', lineHeight: 1.2, margin: '0 0 6px',
        }}>
          Bienvenido de vuelta
        </h1>
        <p style={{ fontSize: '13px', color: C.textSub, margin: 0, lineHeight: 1.5 }}>
          Accede a tu plataforma de aprendizaje
        </p>
      </div>

      {/* ── Error ─────────────────────────────────────── */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '10px 14px', marginBottom: '18px',
          background: C.errorBg, border: `1px solid ${C.errorBorder}`,
          borderRadius: '10px',
        }}>
          <AlertCircle size={13} color={C.error} style={{ flexShrink: 0 }}/>
          <p style={{ fontSize: '12.5px', color: C.error, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* ── Formulario ────────────────────────────────── */}
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        onSubmit={driver.onSubmit(loginFn)}
      >
        <NeuInput
          id="username" label="Usuario" placeholder="Tu nombre de usuario"
          value={form.username}
          onChange={e => { setForm(f => ({ ...f, username: e.target.value })); driver.onEmailChange(); }}
          onFocus={driver.onEmailFocus}
          onBlur={driver.onEmailBlur}
        />
        <NeuInput
          id="password" label="Contraseña" type="password" placeholder="••••••••"
          value={form.password}
          onChange={e => { setForm(f => ({ ...f, password: e.target.value })); driver.onPasswordChange(); }}
          onFocus={driver.onPasswordFocus}
          onBlur={driver.onPasswordBlur}
        />

        {/* Link olvidé contraseña */}
        <div style={{ textAlign: 'right', marginTop: '-4px' }}>
          <Link to="/forgot-password" style={{
            fontSize: '11.5px', color: C.textMute, textDecoration: 'none',
            transition: 'color 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = C.textSub)}
          onMouseLeave={e => (e.currentTarget.style.color = C.textMute)}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {/* Botón principal neumorphism */}
        <button
          type="submit"
          disabled={loading}
          onMouseEnter={() => setHoverBtn(true)}
          onMouseLeave={() => setHoverBtn(false)}
          style={{
            marginTop: '4px',
            width: '100%', padding: '12px',
            borderRadius: '10px',
            background: hoverBtn && !loading ? C.accentHover : C.accent,
            border: 'none', color: '#FFF',
            fontSize: '13.5px', fontWeight: 600, letterSpacing: '0.01em',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.65 : 1,
            transition: 'background 150ms ease, transform 150ms ease, box-shadow 150ms ease',
            transform: hoverBtn && !loading ? 'translateY(-1px)' : 'translateY(0)',
            boxShadow: hoverBtn && !loading
              ? '0 6px 20px rgba(0,0,0,0.18)'
              : '0 2px 8px rgba(0,0,0,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin"/>Ingresando...</>
            : 'Ingresar'
          }
        </button>
      </form>

      {/* ── Divisor ───────────────────────────────────── */}
      <div style={{
        margin: '24px 0 20px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{ flex: 1, height: '1px', background: C.border }}/>
        <span style={{ fontSize: '10.5px', color: C.textMute, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Demo
        </span>
        <div style={{ flex: 1, height: '1px', background: C.border }}/>
      </div>

      {/* ── Accesos demo — grid 2x2 ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {DEMOS.map(d => (
          <button
            key={d.role}
            type="button"
            onClick={() => setForm({ username: d.role, password: DEMO_PWD[d.role] ?? d.role })}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 11px',
              background: d.bg, border: `1px solid ${d.border}`,
              borderRadius: '9px', cursor: 'pointer',
              transition: 'opacity 140ms, transform 140ms',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.dot, flexShrink: 0 }}/>
            <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: d.text }}>{d.label}</span>
              <span style={{ fontSize: '9.5px', fontFamily: 'monospace', color: d.text, opacity: 0.55 }}>{d.role}</span>
            </span>
          </button>
        ))}
      </div>

      <p style={{ fontSize: '10px', color: C.textMute, textAlign: 'center', marginTop: '10px' }}>
        Tu cuenta es asignada por tu institución educativa
      </p>
    </div>
  );
}
