import { CreditCard, ShieldCheck, Users, GraduationCap, HardDrive, Cpu, ExternalLink, AlertTriangle, CheckCircle, TrendingUp, Calendar } from 'lucide-react';

function UsageBar({ label, current, max, color, icon: Icon }: { label: string; current: number; max: number; color: string; icon: any }) {
  const pct = max > 90000 ? 30 : Math.round((current / max) * 100);
  const isNearLimit = pct >= 80;
  const isOverLimit = pct >= 100;

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-[#37352F] flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-[#787774]" /> {label}
        </span>
        <span className={`text-xs font-semibold ${isOverLimit ? 'text-[#E03E3E]' : isNearLimit ? 'text-[#D9730D]' : 'text-[#787774]'}`}>
          {current} / {max > 90000 ? 'Ilimitado' : max}
        </span>
      </div>
      <div className="h-2.5 bg-[#F7F6F3] rounded-full overflow-hidden border border-[#E9E9E7]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[10px] text-[#AEADAB] mt-0.5 text-right">{max > 90000 ? '—' : `${pct}% utilizado`}</p>
    </div>
  );
}

export default function LicenciaTab({ license }: { license: any }) {
  // Calcula días restantes desde la fecha real si el backend la provee
  const expiryDate = license?.expiry_date ? new Date(license.expiry_date) : null;
  const today      = new Date();
  const daysLeft   = expiryDate ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isExpiring = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
  const isExpired  = daysLeft !== null && daysLeft <= 0;
  const licType    = license?.license_type || 'Premium';

  const PLAN_FEATURES: Record<string, string[]> = {
    Básica:   ['Hasta 20 profesores', 'Hasta 300 estudiantes', 'Dashboard básico', 'NeuroAlertas básicas', '1 NeuroBot por profesor', 'Exportación CSV'],
    Premium:  ['Hasta 60 profesores', 'Hasta 1.500 estudiantes', 'Dashboard avanzado', 'NeuroAlertas inteligentes', 'Analítica institucional', 'Reportes PDF y Excel', 'Hasta 10 NeuroBots por profesor', 'Predicción de riesgo académico', 'Comparativos históricos'],
    Pro:      ['Profesores ilimitados', 'Estudiantes ilimitados', 'NeuroBots ilimitados', 'IA institucional completa', 'Analítica predictiva avanzada', 'Reportes personalizados', 'Integraciones (Google Workspace, Microsoft 365)', 'API de integración', 'Almacenamiento ampliado', 'Acceso anticipado a nuevas funciones'],
  };

  const features = PLAN_FEATURES[licType] ?? PLAN_FEATURES['Premium'];

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Alerta de vencimiento */}
      {isExpired && (
        <div className="bg-[#FDEEEE] border border-[#F4BDBD] rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#E03E3E] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#E03E3E]">Licencia vencida</p>
            <p className="text-sm text-[#E03E3E]/80 mt-0.5">Tu licencia ha expirado. Algunas funciones están limitadas. Renueva para recuperar el acceso completo.</p>
          </div>
        </div>
      )}
      {!isExpired && isExpiring && (
        <div className="bg-[#FCF6E5] border border-[#EDD88A] rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D9730D] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#D9730D]">Licencia próxima a vencer</p>
            <p className="text-sm text-[#D9730D]/80 mt-0.5">Tu licencia vence en {daysLeft} días. Renueva pronto para evitar interrupciones del servicio.</p>
          </div>
        </div>
      )}

      {/* Tarjeta principal */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#6940A5] to-[#5A358F] text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-6 h-6 opacity-80" />
                <span className="text-sm font-medium opacity-80">Plan actual</span>
              </div>
              <h2 className="text-2xl font-bold">Licencia {licType}</h2>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-medium opacity-90">Activa</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-70">Vence en</p>
              <p className="text-3xl font-bold">{daysLeft}</p>
              <p className="text-sm opacity-70">días</p>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 gap-6">
          <div className="flex items-center gap-3 p-3 bg-[#F7F6F3] rounded-md">
            <Calendar className="w-5 h-5 text-[#787774]" />
            <div>
              <p className="text-xs text-[#787774]">Fecha de inicio</p>
              <p className="text-sm font-semibold text-[#37352F]">1 Enero 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#F7F6F3] rounded-md">
            <Calendar className="w-5 h-5 text-[#D9730D]" />
            <div>
              <p className="text-xs text-[#787774]">Fecha de vencimiento</p>
              <p className="text-sm font-semibold text-[#37352F]">{expiryDate ? expiryDate.toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' }) : 'Sin fecha límite'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Uso de recursos */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <h3 className="font-semibold text-[#191919] mb-5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#787774]" /> Uso de Recursos
        </h3>
        <div className="space-y-5">
          <UsageBar
            label="Docentes"
            current={license?.current_teachers ?? 18}
            max={license?.max_teachers ?? 60}
            color="#0B6E99"
            icon={Users}
          />
          <UsageBar
            label="Estudiantes"
            current={license?.current_students ?? 745}
            max={license?.max_students ?? 1500}
            color="#0F7B6C"
            icon={GraduationCap}
          />
          <UsageBar
            label="Almacenamiento"
            current={12}
            max={50}
            color="#6940A5"
            icon={HardDrive}
          />
          <UsageBar
            label="Consumo de IA (este mes)"
            current={8240}
            max={20000}
            color="#D9730D"
            icon={Cpu}
          />
        </div>
      </div>

      {/* Características del plan */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <h3 className="font-semibold text-[#191919] mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#787774]" /> Incluido en tu plan {licType}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {features.map((feat, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#0F7B6C] mt-0.5 flex-shrink-0" />
              <span className="text-sm text-[#37352F]">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actualizar licencia */}
      <div className="bg-gradient-to-r from-[#F7F6F3] to-white border border-[#E9E9E7] rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-[#191919] mb-1">¿Necesitas más capacidad?</h3>
            <p className="text-sm text-[#787774]">Actualiza tu plan para acceder a más profesores, estudiantes, NeuroBots y analítica avanzada.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#6940A5] text-white text-sm font-medium rounded-md hover:bg-[#5A358F] transition-colors shadow-sm flex-shrink-0 ml-4">
            <CreditCard className="w-4 h-4" />
            Solicitar actualización
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
