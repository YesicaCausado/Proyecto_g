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
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">📚 Habilidades Transversales</h1>
        <p className="text-gray-500 mt-1">
          5 competencias clave para el Saber 11. Selecciona una para empezar a practicar.
        </p>
      </div>

      <div className="space-y-4">
        {SKILLS.map((skill) => (
          <Link
            key={skill.key}
            to={`/chat?skill=${skill.key}`}
            className="block bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-primary-300 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 bg-gradient-to-br ${skill.color} rounded-xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0`}>
                {skill.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-lg group-hover:text-primary-700 transition-colors">
                  {skill.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{skill.desc}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {skill.topics.map((topic) => (
                    <span
                      key={topic}
                      className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              <div className="hidden sm:flex items-center text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-sm font-medium mr-1">Practicar</span>
                →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
