import { Link } from 'react-router-dom';
import NeuronAvatar from '../../components/NeuronAvatar';
import { COMPETENCIES } from '../../data/competencies';

export default function BotsPage() {
  // Página de habilidades / bots disponibles (usa la misma base de competencias
  // que el menú y el Neuro-Chat para mantener coherencia).
  const SKILLS = COMPETENCIES;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="pb-5 mb-6 border-b border-[#E9E9E7]">
        {/* Neuron intro card */}
        <div className="flex items-center gap-4 bg-[#1a1a1a] rounded-md p-5 mb-6 text-white">
          <NeuronAvatar size={52} online variant="gradient" />
          <div>
            <p className="text-[#9B9A97] text-[10px] uppercase tracking-widest font-semibold mb-0.5">
              Tu asistente inteligente
            </p>
            <h2 className="text-base font-bold text-white leading-tight">
              Neuron <span className="text-[#60C8FF] font-normal text-sm">· NeuroLearn AI</span>
            </h2>
            <p className="text-[#787774] text-xs mt-1">
              Selecciona una habilidad y empieza a practicar con Neuron
            </p>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[#37352F]">Competencias Generales</h1>
        <p className="text-[#787774] text-sm mt-1">
          5 competencias clave para el Saber 11. Selecciona una para practicar con Neuron.
        </p>
      </div>

      <div className="space-y-3">
        {SKILLS.map((skill) => (
          <Link
            key={skill.key}
            to={`/chat/${skill.slug}`}
            className="flex items-start gap-4 bg-white border border-[#E9E9E7] rounded-md p-5 hover:border-[#9B9A97] transition-colors group"
          >
            <div className={`w-12 h-12 ${skill.bg} border border-[#E9E9E7] rounded-md flex items-center justify-center text-2xl flex-shrink-0`}>
              {skill.iconEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[#37352F] text-[15px] group-hover:text-[#37352F] transition-colors">
                {skill.name}
              </h3>
              <p className="text-sm text-[#787774] mt-0.5">{skill.desc}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {skill.topics.map((topic) => (
                  <span
                    key={topic}
                    className="text-xs bg-[#F7F6F3] text-[#787774] px-2.5 py-1 rounded-md border border-[#E9E9E7]"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden sm:flex items-center text-[#9B9A97] opacity-0 group-hover:opacity-100 transition-opacity text-sm">
              Practicar →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
