import { Link } from 'react-router-dom';

export default function BotsPage() {
  // Página de habilidades / bots disponibles
  const SKILLS = [
    {
      key: 'matematicas',
      name: 'Pensamiento Lógico-Matemático',
      desc: 'Razonamiento cuantitativo, estadística, probabilidad y resolución de problemas',
      icon: '🧮',
      color: 'from-blue-500 to-blue-600',
      topics: ['PEMDAS', 'Ecuaciones', 'Funciones', 'Estadística', 'Probabilidad'],
    },
    {
      key: 'lectora',
      name: 'Comprensión Lectora',
      desc: 'Lectura crítica, análisis de textos, inferencia y argumentación',
      icon: '📖',
      color: 'from-amber-500 to-orange-500',
      topics: ['Idea principal', 'Inferencia', 'Tipos de texto', 'Argumentación', 'Lectura crítica'],
    },
    {
      key: 'ingles',
      name: 'Inglés Comunicativo',
      desc: 'Gramática, vocabulario, comprensión de lectura en inglés',
      icon: '🌎',
      color: 'from-green-500 to-emerald-600',
      topics: ['Present Simple', 'Past Simple', 'Reading', 'Vocabulary', 'Connectors'],
    },
    {
      key: 'ciudadanas',
      name: 'Competencias Ciudadanas',
      desc: 'Constitución, derechos, democracia, convivencia y pensamiento crítico social',
      icon: '🏛️',
      color: 'from-purple-500 to-violet-600',
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
      <div className="pb-5 mb-6 border-b border-[#E0E0E0]">
        <h1 className="text-xl font-semibold text-[#2F3437]">Habilidades Transversales</h1>
        <p className="text-[#707070] text-sm mt-1">
          5 competencias clave para el Saber 11. Selecciona una para empezar a practicar.
        </p>
      </div>

      <div className="space-y-3">
        {SKILLS.map((skill) => (
          <Link
            key={skill.key}
            to={`/chat?skill=${skill.key}`}
            className="flex items-start gap-4 bg-white border border-[#E0E0E0] rounded-md p-5 hover:border-[#9B9B9B] transition-colors group"
          >
            <div className="w-12 h-12 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center text-2xl flex-shrink-0">
              {skill.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[#2F3437] text-[15px] group-hover:text-[#2F3437] transition-colors">
                {skill.name}
              </h3>
              <p className="text-sm text-[#707070] mt-0.5">{skill.desc}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {skill.topics.map((topic) => (
                  <span
                    key={topic}
                    className="text-xs bg-[#F7F6F3] text-[#707070] px-2.5 py-1 rounded-md border border-[#E0E0E0]"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden sm:flex items-center text-[#9B9B9B] opacity-0 group-hover:opacity-100 transition-opacity text-sm">
              Practicar →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
