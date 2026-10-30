import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpenCheck, ChevronLeft, ChevronRight, GraduationCap, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { User } from '../types';

type Role = User['role'];
type Stage = 'closed' | 'welcome' | 'tour';

interface TourStep {
  target: string;
  title: string;
  description: string;
  destination: string;
}

interface TutorialState {
  completed: boolean;
  role: Role | null;
  step: number;
}

interface GuidedTourContextValue {
  start: () => void;
  restart: () => void;
}

const GuidedTourContext = createContext<GuidedTourContextValue | null>(null);

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  super_profesor: 'Súper Profesor',
  profesor: 'Profesor',
  estudiante: 'Estudiante',
};

const STEPS: Record<Role, TourStep[]> = {
  admin: [
    { target: 'admin-dashboard', title: 'Inicio', description: 'Consulta el resumen general del sistema desde el panel principal.', destination: '/admin' },
    { target: 'admin-instituciones', title: 'Instituciones', description: 'Administra los colegios y las cuentas de Súper Profesor asociadas.', destination: '/admin/instituciones' },
    { target: 'admin-usuarios', title: 'Usuarios', description: 'Busca y gestiona las cuentas de la plataforma.', destination: '/admin/usuarios' },
    { target: 'admin-auditoria', title: 'Auditoría', description: 'Revisa el registro de acciones del sistema.', destination: '/admin/auditoria' },
    { target: 'admin-bots', title: 'Bots', description: 'Modera los bots creados en la plataforma.', destination: '/admin/bots' },
    { target: 'admin-configuracion', title: 'Configuración', description: 'Accede a los ajustes generales del sistema.', destination: '/admin/configuracion' },
  ],
  super_profesor: [
    { target: 'super-dashboard', title: 'Dashboard', description: 'Consulta el resumen ejecutivo de tu institución.', destination: '/super?tab=dashboard' },
    { target: 'super-profesores', title: 'Profesores', description: 'Crea, administra y revisa las cuentas docentes.', destination: '/super?tab=profesores' },
    { target: 'super-estudiantes', title: 'Estudiantes', description: 'Consulta y administra los estudiantes de la institución.', destination: '/super?tab=estudiantes' },
    { target: 'super-grupos', title: 'Grupos', description: 'Organiza y supervisa los grupos y aulas.', destination: '/super?tab=grupos' },
    { target: 'super-neurobots', title: 'NeuroBots', description: 'Consulta los asistentes de aprendizaje de la institución.', destination: '/super?tab=neurobots' },
    { target: 'super-alertas', title: 'NeuroAlertas', description: 'Revisa las alertas académicas disponibles.', destination: '/super?tab=alertas' },
    { target: 'super-reportes', title: 'Reportes', description: 'Analiza los reportes institucionales disponibles.', destination: '/super?tab=reportes' },
    { target: 'super-mensajeria', title: 'Mensajería', description: 'Comunícate con profesores y estudiantes.', destination: '/super?tab=mensajeria' },
    { target: 'super-calendario', title: 'Calendario', description: 'Consulta los eventos y fechas institucionales.', destination: '/super?tab=calendario' },
    { target: 'super-auditoria', title: 'Auditoría', description: 'Revisa el registro de acciones de la institución.', destination: '/super?tab=auditoria' },
    { target: 'super-configuracion', title: 'Configuración', description: 'Administra la configuración institucional.', destination: '/super?tab=configuracion' },
    { target: 'super-seguridad', title: 'Seguridad', description: 'Consulta las herramientas de seguridad institucional.', destination: '/super?tab=seguridad' },
    { target: 'super-perfil', title: 'Mi Perfil', description: 'Actualiza tu información personal y preferencias.', destination: '/super?tab=perfil' },
  ],
  profesor: [
    { target: 'teacher-dashboard', title: 'Dashboard', description: 'Revisa el resumen de actividad y tus grupos.', destination: '/teacher?tab=dashboard' },
    { target: 'teacher-grupos', title: 'Mis Grupos', description: 'Crea grupos, consulta estudiantes y comparte el código de invitación.', destination: '/teacher?tab=grupos' },
    { target: 'teacher-neurobots', title: 'NeuroBots', description: 'Administra y asigna asistentes de aprendizaje.', destination: '/teacher?tab=neurobots' },
    { target: 'teacher-alertas', title: 'NeuroAlertas', description: 'Consulta alertas para acompañar a tus estudiantes.', destination: '/teacher?tab=alertas' },
    { target: 'teacher-tablero', title: 'Tablero', description: 'Publica anuncios y tareas para tus grupos.', destination: '/teacher?tab=tablero' },
    { target: 'teacher-evaluaciones', title: 'Evaluaciones', description: 'Crea y revisa actividades de evaluación.', destination: '/teacher?tab=evaluaciones' },
    { target: 'teacher-materiales', title: 'Materiales', description: 'Organiza archivos y recursos para tus estudiantes.', destination: '/teacher?tab=materiales' },
    { target: 'teacher-mensajes', title: 'Mensajes', description: 'Gestiona tus conversaciones.', destination: '/teacher?tab=mensajes' },
    { target: 'teacher-calendario', title: 'Calendario', description: 'Consulta y organiza actividades programadas.', destination: '/teacher?tab=calendario' },
    { target: 'teacher-analitica', title: 'Analítica', description: 'Explora los datos de progreso y desempeño disponibles.', destination: '/teacher?tab=analitica' },
    { target: 'teacher-ia', title: 'IA Generativa', description: 'Accede a las herramientas de IA disponibles para tu labor docente.', destination: '/teacher?tab=ia' },
    { target: 'teacher-integraciones', title: 'Integraciones', description: 'Consulta las integraciones disponibles.', destination: '/teacher?tab=integraciones' },
    { target: 'teacher-automatizaciones', title: 'Automatizaciones', description: 'Revisa las opciones de automatización del panel.', destination: '/teacher?tab=automatizaciones' },
    { target: 'teacher-configuracion', title: 'Configuración', description: 'Actualiza tu perfil, seguridad y preferencias.', destination: '/teacher?tab=configuracion' },
  ],
  estudiante: [
    { target: 'student-dashboard', title: 'Inicio', description: 'Encuentra tu resumen de progreso y actividad reciente.', destination: '/dashboard' },
    { target: 'student-diagnostico', title: 'Diagnóstico inicial', description: 'Conoce tus competencias mediante las actividades de diagnóstico.', destination: '/diagnostic' },
    { target: 'student-competencias', title: 'Competencias', description: 'Practica las competencias con Neuro-Chat.', destination: '/chat' },
    { target: 'student-desafios', title: 'Desafíos', description: 'Realiza quizzes, revisa tu historial y consulta tu desempeño.', destination: '/quizzes' },
    { target: 'student-mis-neurobots', title: 'Mis NeuroBots', description: 'Explora los asistentes de aprendizaje disponibles para ti.', destination: '/bots' },
    { target: 'student-material', title: 'Material de Apoyo', description: 'Consulta los recursos compartidos contigo.', destination: '/material' },
    { target: 'student-mis-clases', title: 'Mis Clases', description: 'Consulta tus clases y actividades de grupo.', destination: '/my-classes' },
    { target: 'student-evaluaciones', title: 'Evaluaciones', description: 'Encuentra y responde evaluaciones asignadas.', destination: '/evaluations' },
    { target: 'student-tablero', title: 'Tablero', description: 'Revisa anuncios y tareas publicados para ti.', destination: '/tablero' },
    { target: 'student-calendario', title: 'Calendario', description: 'Consulta las fechas y actividades programadas.', destination: '/calendar' },
    { target: 'student-mensajes', title: 'Mensajes', description: 'Comunícate mediante tus conversaciones.', destination: '/messages' },
    { target: 'student-perfil', title: 'Mi Perfil', description: 'Administra tu información, seguridad y preferencias.', destination: '/settings' },
  ],
};

function isRole(value: string | undefined): value is Role {
  return value === 'admin' || value === 'super_profesor' || value === 'profesor' || value === 'estudiante';
}

function canShowWelcome(user: User, pathname: string): boolean {
  if (user.must_change_password || pathname === '/change-password' || pathname === '/privacy-notice') return false;
  return !(
    user.role === 'estudiante' &&
    user.privacy_notice_required_version &&
    user.privacy_notice_acknowledged_version !== user.privacy_notice_required_version
  );
}

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('closed');
  const [state, setState] = useState<TutorialState>({ completed: false, role: null, step: 0 });
  const [index, setIndex] = useState(0);
  const [loadedStateUserId, setLoadedStateUserId] = useState<number | null>(null);
  const [persistenceError, setPersistenceError] = useState('');
  const loadedUserId = useRef<number | null>(null);
  const stageRef = useRef(stage);
  const pendingCompletion = useRef(false);
  const stateLoaded = Boolean(user && loadedStateUserId === user.id);

  useEffect(() => { stageRef.current = stage; }, [stage]);

  useEffect(() => {
    if (loading || !isAuthenticated || !user || !isRole(user.role)) return;
    if (loadedUserId.current === user.id) return;

    loadedUserId.current = user.id;
    const userId = user.id;
    api.get('/tutorial/state', { params: { _t: Date.now() } })
      .then(({ data }) => {
        if (loadedUserId.current !== userId) return;
        const saved: TutorialState = {
          completed: Boolean(data.completed),
          role: isRole(data.role) ? data.role : null,
          step: Number.isInteger(data.step) && data.step >= 0 ? data.step : 0,
        };
        setState(saved);
        setStage(!saved.completed && canShowWelcome(user, location.pathname)
          ? 'welcome'
          : 'closed');
        setPersistenceError('');
        setLoadedStateUserId(userId);
      })
      .catch(() => {
        if (loadedUserId.current !== userId) return;
        setPersistenceError('No se pudo consultar el progreso del tutorial. Puedes iniciar el recorrido; vuelve a intentarlo para guardar los cambios.');
        setStage(canShowWelcome(user, location.pathname) ? 'welcome' : 'closed');
        setLoadedStateUserId(userId);
      })
  }, [loading, isAuthenticated, user, location.pathname]);

  useEffect(() => {
    if (!user) {
      loadedUserId.current = null;
    }
  }, [user]);

  const saveState = useCallback(async (step: number, completed?: boolean) => {
    if (!user || !isRole(user.role)) return;
    try {
      const payload: { role: Role; step: number; completed?: boolean } = { role: user.role, step };
      if (completed !== undefined) payload.completed = completed;
      const { data } = await api.put('/tutorial/state', payload);
      setState({
        completed: Boolean(data.completed),
        role: isRole(data.role) ? data.role : user.role,
        step: Number.isInteger(data.step) ? data.step : step,
      });
      if (completed) pendingCompletion.current = false;
      setPersistenceError('');
    } catch {
      setPersistenceError('No se pudo guardar el progreso del tutorial. Comprueba tu conexión e inténtalo de nuevo.');
    }
  }, [user]);

  const steps = user && isRole(user.role) ? STEPS[user.role] : [];

  const openStep = useCallback((stepIndex: number) => {
    if (!user || !isRole(user.role)) return;
    const step = STEPS[user.role][stepIndex];
    if (!step) return;
    setIndex(stepIndex);
    setStage('tour');
    if (step.destination !== `${location.pathname}${location.search}`) navigate(step.destination);
    void saveState(stepIndex);
  }, [user, location.pathname, location.search, navigate, saveState]);

  const start = useCallback(() => {
    if (!user || !isRole(user.role) || !stateLoaded) return;
    const savedIndex = state.role === user.role && state.step < STEPS[user.role].length ? state.step : 0;
    openStep(savedIndex);
  }, [user, stateLoaded, state.role, state.step, openStep]);

  const restart = useCallback(() => {
    if (!user || !isRole(user.role) || !stateLoaded) return;
    openStep(0);
  }, [user, stateLoaded, openStep]);

  const finish = useCallback(() => {
    setStage('closed');
    pendingCompletion.current = true;
    void saveState(0, true);
  }, [saveState]);

  const skipWelcome = useCallback(() => {
    setStage('closed');
    pendingCompletion.current = true;
    void saveState(0, true);
  }, [saveState]);

  const advance = useCallback((offset: number) => {
    const next = index + offset;
    if (next < 0) return;
    if (next >= steps.length) {
      finish();
      return;
    }
    openStep(next);
  }, [index, steps.length, finish, openStep]);

  const retryPersistence = useCallback(() => {
    if (stageRef.current === 'tour') void saveState(index);
    else if (stageRef.current === 'welcome') void saveState(state.step);
    else if (pendingCompletion.current) void saveState(0, true);
    else void api.get('/tutorial/state', { params: { _t: Date.now() } })
      .then(({ data }) => {
        const saved: TutorialState = {
          completed: Boolean(data.completed),
          role: isRole(data.role) ? data.role : null,
          step: Number.isInteger(data.step) && data.step >= 0 ? data.step : 0,
        };
        setState(saved);
        setPersistenceError('');
        if (!saved.completed && user && canShowWelcome(user, location.pathname)) {
          setStage('welcome');
        }
      })
      .catch(() => setPersistenceError('No se pudo conectar para consultar el progreso del tutorial.'));
  }, [index, saveState, state.step, user, location.pathname]);

  const value = useMemo(() => ({ start, restart }), [start, restart]);

  return (
    <GuidedTourContext.Provider value={value}>
      {children}
      {user && isRole(user.role) && stateLoaded && (
        <GuidedTourOverlay
          role={user.role}
          stage={stage}
          steps={steps}
          index={index}
          state={state}
          persistenceError={persistenceError}
          onStart={start}
          onSkipWelcome={skipWelcome}
          onAdvance={advance}
          onFinish={finish}
          onRetryPersistence={retryPersistence}
          locationKey={`${location.pathname}${location.search}`}
        />
      )}
      {persistenceError && stage === 'closed' && (
        <div role="alert" className="fixed bottom-4 right-4 z-[100] flex max-w-sm items-center gap-3 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-[#9F2525] shadow-lg">
          <span>{persistenceError}</span>
          <button onClick={retryPersistence} className="shrink-0 rounded px-2 py-1 font-semibold text-[#2E6FDB] hover:bg-[#EEF3FD]">Reintentar</button>
        </div>
      )}
    </GuidedTourContext.Provider>
  );
}

export function TutorialMenuButton({ className = '' }: { className?: string }) {
  const tutorial = useContext(GuidedTourContext);
  if (!tutorial) return null;
  return (
    <button
      type="button"
      onClick={tutorial.restart}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-[#2E6FDB] transition-colors hover:bg-[#EEF3FD] ${className}`}
      aria-label="Volver a ver el tutorial guiado"
    >
      <BookOpenCheck className="h-4 w-4 shrink-0" />
      <span>Tutorial guiado</span>
    </button>
  );
}

function GuidedTourOverlay({
  role,
  stage,
  steps,
  index,
  state,
  persistenceError,
  onStart,
  onSkipWelcome,
  onAdvance,
  onFinish,
  onRetryPersistence,
  locationKey,
}: {
  role: Role;
  stage: Stage;
  steps: TourStep[];
  index: number;
  state: TutorialState;
  persistenceError: string;
  onStart: () => void;
  onSkipWelcome: () => void;
  onAdvance: (offset: number) => void;
  onFinish: () => void;
  onRetryPersistence: () => void;
  locationKey: string;
}) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetKey, setTargetKey] = useState('');
  const [position, setPosition] = useState({ top: 96, left: 16 });
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];

  useEffect(() => {
    if (stage !== 'tour' || !step) return;

    let active = true;
    let menuOpened = false;
    const deadline = Date.now() + 4000;

    const locate = () => {
      if (!active) return;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`));
      const target = candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (target) {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        window.setTimeout(() => {
          if (!active) return;
          setTargetRect(target.getBoundingClientRect());
          setTargetKey(step.target);
        }, 180);
        return;
      }

      if (!menuOpened) {
        const openMenu = document.querySelector<HTMLButtonElement>('button[aria-label="Abrir menú"]');
        if (openMenu) {
          menuOpened = true;
          openMenu.click();
        }
      }

      if (Date.now() >= deadline) {
        if (active) onAdvance(1);
        return;
      }
      window.setTimeout(locate, 120);
    };

    const initialTimer = window.setTimeout(locate, 80);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
    };
  }, [stage, step, locationKey, onAdvance]);

  useEffect(() => {
    if (stage !== 'tour') return;
    const updateRect = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step?.target ?? ''}"]`));
      const target = candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (target) {
        setTargetRect(target.getBoundingClientRect());
        setTargetKey(step?.target ?? '');
      }
    };
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [stage, step]);

  useEffect(() => {
    if (stage !== 'tour' || !targetRect || !cardRef.current) return;
    const card = cardRef.current.getBoundingClientRect();
    const margin = 12;
    const maxLeft = window.innerWidth - card.width - margin;
    const left = Math.max(margin, Math.min(targetRect.left, maxLeft));
    const below = targetRect.bottom + 14;
    const top = below + card.height <= window.innerHeight - margin
      ? below
      : Math.max(margin, targetRect.top - card.height - 14);
    setPosition({ top, left });
  }, [stage, targetRect, index]);

  useEffect(() => {
    if (stage !== 'tour') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFinish();
      if (event.key === 'ArrowRight') onAdvance(1);
      if (event.key === 'ArrowLeft') onAdvance(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, onAdvance, onFinish]);

  if (stage === 'closed') return null;

  const isResuming = !state.completed && state.role === role && state.step > 0 && state.step < steps.length;

  if (stage === 'welcome') {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="guided-tour-welcome-title"
          className="w-full max-w-md rounded-2xl border border-[#E9E9E7] bg-white p-6 shadow-2xl sm:p-8"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF3FD] text-[#2E6FDB]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#2E6FDB]">NeuroLearn IA · {ROLE_LABELS[role]}</p>
          <h2 id="guided-tour-welcome-title" className="text-xl font-bold text-[#191919]">¡Te damos la bienvenida!</h2>
          <p className="mt-2 text-sm leading-6 text-[#787774]">
            Conoce los módulos de tu panel y aprende dónde encontrar sus funciones principales. Puedes repetir este recorrido desde el menú cuando lo necesites.
          </p>
          {persistenceError && (
            <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{persistenceError}</p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button onClick={onSkipWelcome} className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#787774] hover:bg-[#F7F6F3]">Omitir</button>
            <button onClick={onStart} className="rounded-lg bg-[#2E6FDB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#255DC0]">
              {isResuming ? 'Continuar recorrido' : 'Comenzar recorrido'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!step) return null;

  const rect = targetKey === step.target ? targetRect : null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" aria-live="polite">
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-lg border-2 border-white transition-all duration-200"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(17, 24, 39, 0.62), 0 0 0 5px rgba(46, 111, 219, 0.5)',
          }}
        />
      )}
      <section
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="guided-tour-step-title"
        className="pointer-events-auto fixed z-[82] max-h-[calc(100dvh-24px)] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-[#E9E9E7] bg-white p-4 shadow-2xl sm:p-5"
        style={{ top: position.top, left: position.left }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2E6FDB]">Recorrido · {index + 1} de {steps.length}</p>
            <h2 id="guided-tour-step-title" className="mt-1 text-base font-bold text-[#191919]">{step.title}</h2>
          </div>
          <button onClick={onFinish} aria-label="Omitir y finalizar el tutorial" className="rounded-md p-1 text-[#9B9A97] hover:bg-[#F7F6F3] hover:text-[#37352F]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#F1F1EF]">
          <div className="h-full rounded-full bg-[#2E6FDB] transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <p className="text-sm leading-5 text-[#787774]">{step.description}</p>
        {persistenceError && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="flex-1">{persistenceError}</span>
            <button onClick={onRetryPersistence} className="shrink-0 font-semibold text-[#2E6FDB]">Reintentar</button>
          </div>
        )}
        {!rect && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[#787774]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Abriendo el módulo…</p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={() => onAdvance(-1)} disabled={index === 0} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-[#787774] hover:bg-[#F7F6F3] disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Atrás
          </button>
          <button onClick={onFinish} className="rounded-lg px-2 py-2 text-sm font-medium text-[#787774] hover:bg-[#F7F6F3]">Omitir recorrido</button>
          <button onClick={() => onAdvance(1)} className="inline-flex items-center gap-1 rounded-lg bg-[#2E6FDB] px-3 py-2 text-sm font-semibold text-white hover:bg-[#255DC0]">
            {index === steps.length - 1 ? 'Finalizar' : 'Siguiente'} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
