import { Link } from 'react-router-dom';

export default function BotsPage() {
  // Página de habilidades / bots disponibles
  const SKILLS = [
    {
      key: 'matematicas',
      name: 'Pensamiento Lógico-Matemático',
      desc: 'Razonamiento cuantitativo, estadística, probabilidad y resolución de problemas',
      icon: '🧮',
      color: 'from-[#0B6E99] to-[#0B6E99]',
      topics: ['PEMDAS', 'Ecuaciones', 'Funciones', 'Estadística', 'Probabilidad'],
    },
    {
      key: 'lectora',
      name: 'Comprensión Lectora',
      desc: 'Lectura crítica, análisis de textos, inferencia y argumentación',
      icon: '📖',
      color: 'from-[#D9730D] to-[#D9730D]',
      topics: ['Idea principal', 'Inferencia', 'Tipos de texto', 'Argumentación', 'Lectura crítica'],
    },
    {
      key: 'ingles',
      name: 'Inglés Comunicativo',
      desc: 'Gramática, vocabulario, comprensión de lectura en inglés',
      icon: '🌎',
      color: 'from-[#0F7B6C] to-[#0F7B6C]',
      topics: ['Present Simple', 'Past Simple', 'Reading', 'Vocabulary', 'Connectors'],
    },
    {
      key: 'ciudadanas',
      name: 'Competencias Ciudadanas',
      desc: 'Constitución, derechos, democracia, convivencia y pensamiento crítico social',
      icon: '🏛️',
      color: 'from-[#6940A5] to-[#6940A5]',
      topics: ['Constitución', 'Derechos', 'Participación', 'Convivencia', 'Pensamiento crítico'],
    },
    {
      key: 'cientifico',
      name: 'Pensamiento Científico',
      desc: 'Método científico, biología, química, física y ecología',
      icon: '🔬',
      color: 'from-cyan-500 to-teal-600',
      topics: ['Método científico', 'Biología', 'Química', 'Física', 'Ecología'],
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="pb-5 mb-6 border-b border-[#E9E9E7]">
        <h1 className="text-xl font-semibold text-[#37352F]">Habilidades Transversales</h1>
        <p className="text-[#787774] text-sm mt-1">
          5 competencias clave para el Saber 11. Selecciona una para empezar a practicar.
        </p>
      </div>

      <div className="space-y-3">
        {SKILLS.map((skill) => (
          <Link
            key={skill.key}
            to={`/chat?skill=${skill.key}`}
            className="flex items-start gap-4 bg-white border border-[#E9E9E7] rounded-md p-5 hover:border-[#9B9A97] transition-colors group"
          >
            <div className="w-12 h-12 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center text-2xl flex-shrink-0">
              {skill.icon}
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
