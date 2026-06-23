import React, { useState, useEffect } from 'react';
import { Lightbulb, Loader2, AlertCircle, CheckCircle, XCircle, History } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';

// Formato Gemini
interface QuizQuestionGemini {
  id: number;
  question: string;
  options: string[];  // Array simple de strings
  answer: string;     // La opción correcta
  explanation: string;
}

interface QuizResponseGemini {
  quiz_title: string;
  difficulty: string;  // Fácil/Medio/Difícil
  questions: QuizQuestionGemini[];
}

interface QuizRequest {
  topic: string;
  num_questions?: number;
  difficulty?: string;
}

interface QuizHistoryEntry {
  date: string;
  title: string;
  questions_count: number;
  user_score: string | null;
  difficulty: string;
}

const QuizzesPage: React.FC = () => {
  const [quiz, setQuiz] = useState<QuizResponseGemini | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [topic, setTopic] = useState('');
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>([]);

  useEffect(() => {
    const fetchTrainedBots = async () => {
      try {
        const response = await api.get('/expert-bot/trained-bots');
        const topics = response.data.map((bot: any) => bot.replace('.json', '').replace(/_/g, ' '));
        setAvailableTopics(topics);
        if (topics.length > 0) {
          setTopic(topics[0]);
        }
      } catch (err) {
        console.error("Failed to fetch trained bots", err);
        toast.error("No se pudieron cargar los temas disponibles.");
      }
    };
    fetchTrainedBots();
    loadQuizHistory();
  }, []);

  const loadQuizHistory = async () => {
    try {
      const response = await api.get('/chat/quiz-history');
      setQuizHistory(response.data.history || []);
    } catch (err) {
      console.error("Error cargando historial:", err);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!topic) {
      toast.error("Por favor, selecciona un tema para el desafío.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setQuiz(null);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setScore(0);

    try {
      const request: QuizRequest = { topic, num_questions: 5 };
      const response = await api.post<QuizResponseGemini>('/chat/generate-quiz', request);
      if (response.data.questions && response.data.questions.length > 0) {
        setQuiz(response.data);
      } else {
        setError('No se pudieron generar preguntas. Intenta de nuevo.');
        toast.error('El quiz generado estaba vacío. Por favor, intenta de nuevo.');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Error al generar el desafío. Intenta de nuevo más tarde.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, optionText: string) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: optionText,
    });
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedAnswers).length !== quiz?.questions.length) {
      toast.warning("Por favor, responde todas las preguntas antes de enviar.");
      return;
    }

    // Calcular puntaje localmente
    let currentScore = 0;
    quiz?.questions.forEach((q) => {
      const correctAnswer = q.answer;
      if (selectedAnswers[q.id] === correctAnswer) {
        currentScore++;
      }
    });
    
    setScore(currentScore);
    setIsSubmitted(true);
    
    // Enviar al backend para actualizar historial
    try {
      const submission = {
        quiz_title: quiz!.quiz_title,
        user_answers: selectedAnswers
      };
      await api.post('/chat/submit-quiz', submission);
      toast.success(`¡Desafío completado! Tu puntaje: ${currentScore} de ${quiz?.questions.length}`);
      
      // Recargar historial después de completar
      loadQuizHistory();
    } catch (err) {
      console.error('Error guardando quiz:', err);
      toast.success(`¡Desafío completado! Tu puntaje: ${currentScore} de ${quiz?.questions.length}`);
    }
  };

  const handleRetryQuiz = () => {
    setQuiz(null);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setScore(0);
    setError(null);
  };

  const getResultIcon = (questionIndex: number) => {
    if (!isSubmitted) return null;
    const question = quiz?.questions.find(q => q.id === questionIndex);
    const correctAnswer = question?.answer;
    const selectedAnswer = selectedAnswers[questionIndex];

    if (selectedAnswer === correctAnswer) {
      return <CheckCircle className="text-green-500" />;
    } else {
      return <XCircle className="text-red-500" />;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Desafíos Adaptativos</h1>
          <p className="text-gray-600 mt-1">Pon a prueba tus conocimientos con quices generados por IA.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Generar Nuevo Desafío</h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isLoading || availableTopics.length === 0}
            >
              {availableTopics.length > 0 ? (
                availableTopics.map(t => <option key={t} value={t}>{t}</option>)
              ) : (
                <option>Cargando temas...</option>
              )}
            </select>
            <button 
              onClick={handleGenerateQuiz} 
              disabled={isLoading || !topic}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                'Iniciar Desafío'
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {!quiz && !isLoading && !error && (
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-center mb-8 flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <Lightbulb className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-blue-800 mb-2">¡Listo para el reto!</h3>
          <p className="text-blue-700 max-w-lg mx-auto">
            Selecciona un tema y haz clic en "Iniciar Desafío" para comenzar. La IA analizará tu nivel de dominio para crear preguntas personalizadas.
          </p>
        </div>
      )}

      {quiz && (
        <div>
          {quiz.questions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Pregunta {q.id}</h3>
                {isSubmitted && getResultIcon(q.id)}
              </div>
              <div className="p-6">
                <p className="text-gray-800 text-lg mb-6">{q.question}</p>
                <div className="space-y-3">
                  {q.options.map((opt, oIndex) => {
                    const isSelected = selectedAnswers[q.id] === opt;
                    const isCorrect = opt === q.answer;
                    
                    let buttonClass = 'w-full text-left p-4 rounded-lg border transition-all ';
                    
                    if (isSubmitted) {
                      if (isCorrect) {
                        buttonClass += 'bg-green-50 border-green-500 text-green-800 font-medium';
                      } else if (isSelected && !isCorrect) {
                        buttonClass += 'bg-red-50 border-red-500 text-red-800';
                      } else {
                        buttonClass += 'bg-white border-gray-200 text-gray-600 opacity-60';
                      }
                    } else {
                      buttonClass += isSelected 
                        ? 'bg-primary-50 border-primary-500 text-primary-800 font-medium' 
                        : 'bg-white border-gray-200 text-gray-700 hover:border-primary-400 hover:bg-gray-50';
                    }
                    
                    return (
                      <button
                        key={oIndex}
                        className={buttonClass}
                        onClick={() => !isSubmitted && handleAnswerSelect(q.id, opt)}
                        disabled={isSubmitted}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {isSubmitted && (
                  <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>Explicación:</strong> {q.explanation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!isSubmitted ? (
            <div className="flex justify-end mt-8">
              <button 
                onClick={handleSubmit} 
                className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-sm"
              >
                Enviar Respuestas
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 mt-8 overflow-hidden text-center">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <h3 className="text-xl font-bold text-gray-800">Resultados del Desafío</h3>
              </div>
              <div className="p-10">
                <div className="flex justify-center mb-6">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center border-8 ${score / quiz.questions.length >= 0.6 ? 'border-green-500 text-green-600' : 'border-orange-500 text-orange-600'}`}>
                    <span className="text-4xl font-bold">{score}/{quiz.questions.length}</span>
                  </div>
                </div>
                <p className="text-gray-600 mb-8">
                  {score / quiz.questions.length >= 0.8 ? '¡Excelente trabajo! Tienes un gran dominio del tema.' :
                   score / quiz.questions.length >= 0.6 ? '¡Buen trabajo! Vas por buen camino.' :
                   'Sigue practicando, usa el Tutor IA para repasar los conceptos.'}
                </p>
                <div className="flex gap-4 justify-center">
                  <button 
                    onClick={handleRetryQuiz} 
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Elegir Otro Tema
                  </button>
                  <button 
                    onClick={handleGenerateQuiz} 
                    className="bg-primary-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Generando...' : 'Repetir Mismo Tema'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historial de Quizzes */}
      {quizHistory.length > 0 && (
        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Historial de Desafíos</h2>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
            >
              {showHistory ? 'Ocultar' : 'Mostrar'} Historial
              <svg className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showHistory && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tema</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Dificultad</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Preguntas</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Puntaje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {quizHistory.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{entry.date}</td>
                        <td className="px-6 py-4 text-sm text-gray-800 font-medium">{entry.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            entry.difficulty === 'Fácil' ? 'bg-green-100 text-green-800' :
                            entry.difficulty === 'Medio' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {entry.difficulty}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{entry.questions_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {entry.user_score ? (
                            <span className="text-sm font-semibold text-gray-800">{entry.user_score}</span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">No completado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizzesPage;
