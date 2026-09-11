/**
 * NeuronWelcome.tsx
 * ─────────────────────────────────────────────────────────────
 * Hero banner de bienvenida con Neuron (robot 3D del login).
 * Gradient suave · texto izquierda · robot derecha · burbuja.
 * Reutilizable en Student, Teacher y SuperProfesor dashboards.
 * ─────────────────────────────────────────────────────────────
 */
import { Flame } from 'lucide-react';
import RobotCanvas from '../pages/auth/components/robot/RobotCanvas';
import { useLicense } from '../context/LicenseContext';
import { planColor } from '../styles/plan';

interface NeuronWelcomeProps {
  name: string;
  subtitle?: string;
  streakDays?: number;
}

export default function NeuronWelcome({ name, subtitle, streakDays }: NeuronWelcomeProps) {
  const firstName = name?.split(' ')[0] || name;
  const { licenseType } = useLicense();
  const plan = planColor(licenseType);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden mb-6"
      style={{
        height: 'clamp(180px, 22vw, 240px)',
        background: plan.welcome,
      }}
    >
      {/* Decoración de fondo — círculos difusos */}
      <div
        className="absolute -top-10 -right-10 w-64 h-64 rounded-full opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${plan.welcomeAccentSoft} 0%, transparent 70%)` }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${plan.welcomeAccentSoft} 0%, transparent 70%)` }}
      />

      {/* ── Texto izquierda ─────────────────────────────────── */}
      <div className="relative z-10 flex flex-col justify-center h-full pl-6 sm:pl-10 pr-[42%] sm:pr-[44%]">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1 sm:mb-2"
           style={{ color: plan.welcomeAccentSoft }}>
          Neuron · NeuroLearn AI
        </p>

        <h2 className="text-[18px] sm:text-[26px] md:text-[30px] font-bold leading-tight tracking-tight"
            style={{ color: plan.welcomeAccent }}>
          ¡Bienvenido,{' '}
          <span style={{ color: plan.welcomeAccentSoft }}>{firstName}</span>! 👋
        </h2>

        {subtitle && (
          <p className="text-[11px] sm:text-[13px] mt-1 sm:mt-2 leading-snug opacity-80"
             style={{ color: plan.welcomeAccentSoft }}>
            {subtitle}
          </p>
        )}

        {streakDays !== undefined && (
          <div className="flex items-center gap-1.5 mt-3 sm:mt-4">
            <Flame className="w-4 h-4 text-[#f97316]" />
            <span className="text-[12px] sm:text-[13px] font-semibold"
                  style={{ color: plan.welcomeAccent }}>
              Racha actual
            </span>
            <span className="text-[12px] sm:text-[13px] font-medium"
                  style={{ color: plan.welcomeAccentSoft }}>
              {streakDays} días
            </span>
          </div>
        )}
      </div>

      {/* ── Robot 3D original del login — derecha ───────────── */}
      <div className="absolute right-0 top-0 bottom-0 w-[44%] sm:w-[42%]">
        <RobotCanvas robotState="idle" transparent className="w-full h-full" />
      </div>

      {/* ── Burbuja de Neuron ────────────────────────────────── */}
      <div
        className="absolute right-[40%] sm:right-[38%] top-4 sm:top-5 z-20 bg-white rounded-xl shadow-md px-3 py-2 max-w-[130px] sm:max-w-[150px] hidden sm:block"
        style={{ boxShadow: `0 4px 20px ${plan.welcomeAccentSoft}26` }}
      >
        <p className="text-[10px] font-semibold leading-none mb-0.5" style={{ color: plan.welcomeAccentSoft }}>
          ¡Hola! Soy{' '}
          <span style={{ color: plan.welcomeAccent }}>Neuron</span>
        </p>
        <p className="text-[9px] text-[#6b7280] leading-tight">
          Tu asistente inteligente para el Saber 11
        </p>
        {/* Cola de burbuja */}
        <div
          className="absolute -right-2 top-3 w-0 h-0"
          style={{
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderLeft: '8px solid white',
          }}
        />
      </div>
    </div>
  );
}
