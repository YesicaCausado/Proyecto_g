REQUISITOS FUNCIONALES Y NO FUNCIONALES
NeuroLearn IA
Autores: Yesica Causado y Matias Ramirez

1. REQUISITOS FUNCIONALES
Los requisitos funcionales describen las acciones y los servicios que debe proporcionar NeuroLearn IA según las responsabilidades y los permisos de cada actor.

1.1. Actor: Súper Profesor
RF-01. El Súper Profesor debe poder iniciar y cerrar sesión mediante sus credenciales institucionales.

RF-02. El Súper Profesor debe gestionar a los docentes de su institución, incluyendo su creación, consulta, edición y activación o desactivación.

RF-03. El Súper Profesor debe gestionar a los estudiantes y administrar los cupos institucionales.

RF-04. El Súper Profesor debe realizar la carga masiva de usuarios mediante archivos CSV o Excel.

RF-05. El Súper Profesor debe consultar un dashboard institucional con métricas académicas y administrativas.

RF-06. El Súper Profesor debe acceder únicamente a los módulos y funcionalidades autorizados para su rol.

RF-07. El Súper Profesor debe enviar comunicados a todos los usuarios de su institución.

RF-08. El Súper Profesor debe supervisar los NeuroBots de su institución, incluyendo su activación, desactivación, eliminación y seguimiento del progreso.

RF-09. El Súper Profesor debe recibir notificaciones sobre la creación de grupos y NeuroBots, así como sobre estudiantes en riesgo académico.

RF-10. El Súper Profesor debe crear, consultar, editar, transferir y activar o desactivar grupos académicos.

RF-11. El Súper Profesor debe crear y administrar clases, gestionar sus integrantes y consultar su información.

RF-12. El Súper Profesor debe conectar sus cuentas de Google Drive y Google Calendar, cuando corresponda, y configurar automatizaciones autorizadas.

RF-13. El Súper Profesor debe utilizar herramientas de inteligencia artificial generativa para crear planes de clase, preguntas, guías y rúbricas.

RF-14. El Súper Profesor debe consultar estadísticas institucionales y el estado general de la plataforma dentro de su ámbito de autorización.

RF-15. El Súper Profesor debe moderar los NeuroBots públicos conforme a los permisos establecidos.

RF-16. El Súper Profesor debe restablecer las contraseñas de los usuarios de su institución cuando esté autorizado.

RF-17. El Súper Profesor debe consultar exclusivamente la información correspondiente a su institución.

1.2. Actor: Profesor
RF-18. El profesor debe iniciar y cerrar sesión de forma segura.

RF-19. El profesor debe cambiar su contraseña temporal durante el primer acceso, cuando corresponda.

RF-20. El profesor debe crear, consultar, editar y gestionar sus aulas o grupos académicos.

RF-21. El profesor debe generar códigos de invitación para las clases que administre.

RF-22. El profesor debe crear NeuroBots especializados para la tutoría educativa.

RF-23. El profesor debe cargar documentos y fuentes de conocimiento para configurar sus NeuroBots.

RF-24. El profesor debe configurar sus NeuroBots como públicos o privados, según los permisos disponibles.

RF-25. El profesor debe asignar NeuroBots a grupos o clases específicas.

RF-26. El profesor debe consultar la lista de estudiantes inscritos en sus grupos.

RF-27. El profesor debe consultar las neuroalertas relacionadas con posibles estados de fatiga, frustración o riesgo académico de sus estudiantes.

RF-28. El profesor debe consultar estadísticas y reportes académicos de los grupos que tiene asignados.

RF-29. El profesor debe exportar los reportes académicos autorizados en formatos PDF y CSV.

RF-30. El profesor debe compartir NeuroBots educativos con sus grupos o estudiantes autorizados.

RF-31. El profesor debe utilizar herramientas de inteligencia artificial generativa para crear planes de clase, preguntas, guías y rúbricas.

RF-32. El profesor debe conectar sus cuentas de Google Drive y Google Calendar, cuando corresponda, y configurar las automatizaciones autorizadas.

RF-33. El profesor debe consultar los módulos y funcionalidades correspondientes a su rol.

RF-34. El profesor debe acceder únicamente a los grupos, estudiantes, recursos y funcionalidades que tenga autorizados.

1.3. Actor: Estudiante
RF-35. El estudiante debe iniciar sesión con las credenciales asignadas por la institución.

RF-36. El estudiante debe cambiar su contraseña temporal durante el primer acceso, cuando corresponda.

RF-37. El estudiante debe recuperar su contraseña mediante el procedimiento de verificación por correo electrónico establecido por la plataforma.

RF-38. El estudiante debe consultar y editar la información básica de su perfil, según los permisos disponibles.

RF-39. El estudiante debe unirse a clases mediante códigos de invitación válidos.

RF-40. El estudiante debe consultar las competencias académicas disponibles en la plataforma.

RF-41. El estudiante debe seleccionar las competencias que desea fortalecer para iniciar su proceso de aprendizaje.

RF-42. El estudiante debe consultar los NeuroBots que le hayan sido asignados individualmente o mediante sus grupos.

RF-43. El estudiante debe iniciar sesiones de aprendizaje con el tutor de inteligencia artificial.

RF-44. El estudiante debe realizar diagnósticos iniciales para identificar su nivel académico.

RF-45. El estudiante debe interactuar con el tutor de inteligencia artificial mediante un chat.

RF-46. El estudiante debe recibir explicaciones adaptadas a su nivel de conocimiento y necesidades de aprendizaje.

RF-47. El estudiante debe realizar las evaluaciones automáticas disponibles durante su proceso de aprendizaje.

RF-48. El estudiante debe recibir retroalimentación sobre sus respuestas y resultados.

RF-49. El estudiante debe realizar actividades de refuerzo sobre los temas en los que presente dificultades.

RF-50. El estudiante debe solicitar ejemplos, evaluaciones y resúmenes relacionados con los contenidos de aprendizaje.

RF-51. El estudiante debe consultar la información sobre su estado cognitivo cuando esta funcionalidad esté habilitada y cuente con las autorizaciones correspondientes.

RF-52. El estudiante debe consultar dashboards con su progreso académico.

RF-53. El estudiante debe consultar el historial de sus sesiones de aprendizaje y conversaciones con el tutor de inteligencia artificial.

RF-54. El estudiante debe identificar sus fortalezas y las áreas que necesita mejorar.

RF-55. El estudiante debe consultar su racha de aprendizaje y los días de actividad registrados.

RF-56. El estudiante debe acceder únicamente a los módulos y funcionalidades autorizados para su rol.

RF-57. El estudiante debe consultar exclusivamente su información personal y académica, así como los recursos compartidos con él.

1.4. Actor: Sistema de Inteligencia Artificial
RF-58. El Sistema de Inteligencia Artificial debe capturar métricas de dinámica de teclado cuando exista autorización para hacerlo.

RF-59. El Sistema de Inteligencia Artificial debe analizar señales visuales y sonoras cuando se cuente con los permisos y autorizaciones correspondientes.

RF-60. El Sistema de Inteligencia Artificial debe combinar las métricas conductuales disponibles para realizar análisis multimodales.

RF-61. El Sistema de Inteligencia Artificial debe estimar posibles estados cognitivos a partir de las señales disponibles, sin presentarlos como diagnósticos médicos.

RF-62. El Sistema de Inteligencia Artificial debe ajustar la dificultad de las actividades según el desempeño y las necesidades de aprendizaje del estudiante.

RF-63. El Sistema de Inteligencia Artificial debe identificar posibles errores o dificultades durante el aprendizaje.

RF-64. El Sistema de Inteligencia Artificial debe seleccionar estrategias pedagógicas de acuerdo con el desempeño del estudiante.

RF-65. El Sistema de Inteligencia Artificial debe organizar secuencias de enseñanza adaptativa según el progreso del estudiante.

RF-66. El Sistema de Inteligencia Artificial debe generar evaluaciones posteriores a las actividades de enseñanza cuando corresponda.

RF-67. El Sistema de Inteligencia Artificial debe reforzar los conceptos que el estudiante no haya comprendido satisfactoriamente.

RF-68. El Sistema de Inteligencia Artificial debe identificar posibles señales de fatiga o frustración a partir de las métricas disponibles y autorizadas.

RF-69. El Sistema de Inteligencia Artificial debe adaptar sus respuestas al nivel de conocimiento y al contexto de aprendizaje del estudiante.

RF-70. El Sistema de Inteligencia Artificial debe utilizar servicios externos de inteligencia artificial mediante APIs y mecanismos alternativos de disponibilidad (fallback).

RF-71. El Sistema de Inteligencia Artificial debe registrar los eventos cognitivos estimados y las interacciones relevantes para el aprendizaje, respetando las políticas de privacidad.

RF-72. El Sistema de Inteligencia Artificial debe actualizar el perfil de aprendizaje del estudiante con base en sus resultados e interacciones.

RF-73. El Sistema de Inteligencia Artificial debe generar recomendaciones pedagógicas para los profesores a partir de la información académica disponible.

RF-74. El Sistema de Inteligencia Artificial debe actualizar los parámetros y configuraciones de aprendizaje cuando exista autorización para hacerlo.

1.5. Actor: Administrador
RF-75. El Administrador debe gestionar los usuarios registrados en la plataforma, incluyendo su creación, consulta, edición y activación o desactivación.

RF-76. El Administrador debe activar o desactivar las cuentas de usuario según las políticas de la plataforma.

RF-77. El Administrador debe asignar y modificar los roles de los usuarios autorizados.

RF-78. El Administrador debe moderar los NeuroBots públicos de acuerdo con las políticas de uso.

RF-79. El Administrador debe gestionar los NeuroBots preentrenados disponibles en la plataforma.

RF-80. El Administrador debe consultar estadísticas globales de la plataforma.

RF-81. El Administrador debe monitorear el estado general y la disponibilidad de la plataforma.

RF-82. El Administrador debe consultar los registros generales de auditoría.

RF-83. El Administrador debe consultar y gestionar la configuración general de la plataforma según sus permisos.

RF-85. El Administrador debe consultar información global de la plataforma sin pertenecer a una institución específica, respetando los controles de acceso y la protección de los datos personales.

RF-86. El Administrador debe bloquear o impedir el acceso de los usuarios cuando la institución correspondiente se encuentre desactivada, según las reglas de acceso definidas.

2. REQUISITOS NO FUNCIONALES
Los requisitos no funcionales establecen las condiciones de calidad, seguridad, rendimiento, compatibilidad y tecnología que debe cumplir NeuroLearn IA.

2.1. Seguridad y privacidad
RNF-01. El sistema debe proteger los datos personales conforme a la Ley 1581 de 2012 y las demás normas colombianas aplicables sobre protección de datos personales.

RNF-02. El sistema no debe almacenar videos, audios ni imágenes faciales en bruto de menores de edad.

RNF-03. El sistema debe procesar localmente en el dispositivo los datos biométricos visuales y sonoros, cuando corresponda.

RNF-04. El sistema debe almacenar las contraseñas mediante funciones criptográficas de hash seguras y adecuadas para contraseñas.

RNF-05. El sistema debe garantizar la seguridad, integridad y confidencialidad de la información.

RNF-06. El sistema debe implementar mecanismos seguros para el cierre de sesiones y la revocación de tokens de acceso.

RNF-07. El sistema debe registrar los intentos de inicio de sesión exitosos y fallidos.

RNF-08. El sistema debe solicitar y verificar las autorizaciones correspondientes del acudiente cuando sean legalmente necesarias para el uso de cámara y micrófono por parte de menores de edad.

RNF-09. El sistema debe impedir el acceso a módulos y funcionalidades no autorizados según el rol del usuario, mediante controles de autorización en el backend y respuestas HTTP 403 cuando corresponda.

RNF-10. El sistema debe generar registros de auditoría para las acciones críticas realizadas en la plataforma.

RNF-11. El sistema debe implementar controles de acceso para proteger los datos personales y evitar que los usuarios consulten información ajena a sus permisos.

2.2. Rendimiento y disponibilidad
RNF-12. El sistema debe responder en menos de 2,5 segundos en condiciones normales de operación para las solicitudes ordinarias, con criterios de medición definidos.

RNF-13. El sistema debe garantizar la disponibilidad del servicio y contar con mecanismos de recuperación ante fallos.

RNF-14. El sistema debe generar notificaciones oportunas para los eventos relevantes de la plataforma.

RNF-15. El sistema debe mantener la persistencia y trazabilidad de los datos académicos y de las interacciones registradas.

RNF-34. El sistema de Inteligencia Artificial debe responder en un máximo de 20-30 segundos para solicitudes de IA.

2.3. Compatibilidad y accesibilidad
RNF-16. El sistema debe funcionar como una aplicación web progresiva (PWA).

RNF-17. El sistema debe contar con un diseño responsive compatible con teléfonos móviles, tabletas y computadores.

RNF-18. El sistema debe cumplir con los criterios de accesibilidad web WCAG 2.1 nivel AA.

2.4. Arquitectura y tecnologías
RNF-20. El backend debe desarrollarse utilizando FastAPI y Python.

RNF-21. El frontend debe desarrollarse utilizando React, TypeScript y Vite.

RNF-22. El sistema debe implementar una arquitectura multiinstitucional (multi-tenant) que garantice el aislamiento de los datos entre instituciones.

RNF-23. El sistema debe utilizar Supabase PostgreSQL como base de datos.

RNF-24. El sistema debe desplegarse en Vercel para el frontend y los servicios de backend compatibles con su entorno de ejecución.

RNF-25. El sistema debe integrarse con servicios externos de inteligencia artificial mediante APIs.

RNF-26. El sistema debe contar con mecanismos de compatibilidad y migración para mantener la integridad de los datos cuando cambie el esquema de la base de datos.


