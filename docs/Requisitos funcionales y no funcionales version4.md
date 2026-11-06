1. Requisitos funcionales
1.1. Autenticación, cuenta y comunicación
RF-01. Inicio de sesión. El sistema debe permitir que los usuarios inicien sesión con las credenciales asignadas por la institución. También debe bloquear temporalmente el acceso después de los intentos fallidos establecidos y rechazar el acceso a cuentas o instituciones inactivas.

RF-02. Cambio de contraseña inicial. El sistema debe exigir al usuario cambiar la contraseña temporal durante su primer inicio de sesión.

RF-03. Recuperación de contraseña. El sistema debe permitir recuperar la contraseña mediante un enlace enviado al correo registrado, con una vigencia de 15 minutos y un solo uso.

RF-04. Cierre de sesión. El sistema debe permitir que los usuarios cierren su sesión de forma segura.

RF-05. Notificaciones. El sistema debe permitir que los usuarios consulten sus notificaciones y las marquen como leídas.

RF-06. Edición del perfil. El sistema debe permitir que los estudiantes, profesores y Súper Profesores actualicen su nombre, correo electrónico, contraseña y preferencias de notificación.

RF-07. Mensajería directa. El sistema debe permitir que los estudiantes, profesores y Súper Profesores envíen mensajes directos a otros usuarios de su institución y adjunten archivos cuando corresponda.
1.2. Funcionalidades del estudiante
RF-08. Calendario del estudiante. El sistema debe permitir que el estudiante consulte el calendario de su institución y de los grupos a los que pertenece.

RF-09. Ingreso a grupos. El sistema debe permitir que el estudiante se una a un grupo mediante un código de invitación válido.

RF-10. Consulta de clases. El sistema debe permitir que el estudiante consulte sus clases, incluyendo la asignatura, el profesor, el progreso, los NeuroBots asignados y las evaluaciones correspondientes.

RF-11. Competencias académicas. El sistema debe ofrecer al estudiante las cinco competencias de NeuroLearn IA: Pensamiento Lógico-Matemático, Lectura Crítica, Inglés Comunicativo, Competencias Ciudadanas y Sociales, y Pensamiento Científico.

RF-12. Inicio de tutoría con IA. El sistema debe permitir que el estudiante inicie una sesión con el tutor de inteligencia artificial seleccionando una competencia o un NeuroBot que tenga asignado.

RF-13. Diagnóstico inicial. El sistema debe permitir que el tutor de inteligencia artificial realice un diagnóstico inicial mediante preguntas, evalúe las respuestas del estudiante y guarde los resultados como diagnóstico.

RF-14. Interacción con el tutor. El sistema debe permitir que el estudiante converse con el tutor de inteligencia artificial mediante texto y dictado por voz.

RF-15. Recursos de aprendizaje. El sistema debe permitir que el estudiante solicite ejemplos, resúmenes y cuestionarios durante las sesiones con el tutor de inteligencia artificial.

RF-16. Estimación del estado cognitivo. El sistema debe mostrar una estimación del estado cognitivo del estudiante durante la sesión, utilizando únicamente señales disponibles y datos válidos, sin presentar valores ficticios cuando no haya información suficiente.

RF-17. Respuestas por voz. El sistema debe permitir que el estudiante escuche mediante voz las respuestas del tutor de inteligencia artificial.

RF-18. Consentimiento para cámara y micrófono. El sistema debe permitir que el estudiante otorgue y revoque por separado el consentimiento para utilizar la cámara y el micrófono.

RF-19. Consulta de NeuroBots asignados. El sistema debe permitir que el estudiante consulte sus NeuroBots asignados, incluyendo el objetivo de cada uno, su estado y el progreso alcanzado.

RF-20. Cuestionarios adaptativos. El sistema debe permitir que el estudiante realice cuestionarios adaptativos y reciba retroalimentación inmediata, puntaje, explicación por pregunta, identificación de conceptos débiles y recomendación de dificultad.

RF-21. Refuerzo de conceptos débiles. El sistema debe identificar los conceptos débiles detectados en cuestionarios anteriores y ofrecer actividades de refuerzo relacionadas con ellos.

RF-22. Consulta del desempeño académico. El sistema debe permitir que el estudiante consulte su desempeño por competencia, progreso, fortalezas, debilidades, rachas de actividad y logros obtenidos.

RF-23. Historial de conversaciones. El sistema debe permitir que el estudiante consulte, retome y elimine sus conversaciones guardadas con el tutor de inteligencia artificial y los NeuroBots.

RF-24. Presentación de evaluaciones. El sistema debe permitir que el estudiante responda las evaluaciones publicadas en sus grupos, respetando los límites de tiempo e intentos, y consulte su calificación y corrección cuando estén disponibles.

RF-25. Materiales de apoyo. El sistema debe permitir que el estudiante consulte y descargue los materiales de apoyo que sus profesores hayan compartido con sus grupos.

RF-26. Publicaciones de grupo. El sistema debe permitir que los profesores y estudiantes consulten las publicaciones del tablero de grupo y que los usuarios autorizados reaccionen y comenten en ellas.
1.3. Inteligencia artificial y patrones neurodigitales
RF-27. Captura de dinámica de teclado e interacción. El sistema debe registrar las dinámicas de teclado e interacción digital relevantes para el aprendizaje, incluyendo ritmo, pausas, correcciones y decisiones, dentro de los permisos y condiciones de privacidad establecidos.

RF-28. Análisis facial y de voz. El sistema debe analizar microexpresiones faciales y prosodia de voz únicamente cuando exista consentimiento vigente. El procesamiento de estas señales debe realizarse en el dispositivo y al servidor solo deben enviarse indicadores numéricos, sin almacenar imágenes, audio ni video originales.

RF-29. Integración de señales neurodigitales. El sistema debe combinar las señales disponibles de los patrones neurodigitales para estimar posibles estados relacionados con fatiga, frustración, sobrecarga o duda, sin emitir estimaciones cuando no exista información suficiente.

RF-30. Cálculo del riesgo de error. El sistema debe calcular el riesgo de error del estudiante a partir de información verificable y disponible, sin inventar datos ni presentar estimaciones sin fundamento.

RF-31. Adaptación del aprendizaje. El sistema debe adaptar la dificultad, el nivel de orientación, la extensión de las respuestas, los ejemplos, los ejercicios y las pistas al nivel y progreso del estudiante.

RF-32. Generación de cuestionarios. El sistema debe generar cuestionarios después de las actividades de enseñanza, considerando el tema trabajado y los conceptos débiles identificados.

RF-33. Respaldo de proveedores de IA. El sistema debe intentar utilizar Groq como proveedor principal de inteligencia artificial, recurrir a Gemini cuando Groq falle y ofrecer una respuesta local de respaldo cuando ambos proveedores no estén disponibles.

RF-34. Registro de sesiones. El sistema debe registrar los mensajes, eventos cognitivos, cuestionarios e interacciones asociados a cada sesión, respetando las restricciones de privacidad y conservación de datos.

RF-35. Actualización del modelo del estudiante. El sistema debe actualizar el modelo de aprendizaje del estudiante con información válida sobre dominio de habilidades, estado de aprendizaje, memoria y siguiente acción recomendada para el tutor.

RF-36. Consulta de documentos de conocimiento. El sistema debe permitir que los NeuroBots consulten sus documentos de conocimiento para fundamentar las respuestas que proporcionan.

RF-37. Seguimiento de objetivos de NeuroBots. El sistema debe realizar seguimiento al progreso del estudiante con cada NeuroBot asignado y notificar al profesor cuando se alcance el objetivo establecido.

RF-38. Actualización del riesgo académico. El sistema debe recalcular el riesgo académico después de los cuestionarios y notificar a los responsables autorizados cuando un estudiante entre en una condición de riesgo alto.
1.4. Funcionalidades del profesor
RF-39. Administración de grupos por el profesor. El sistema debe permitir que el profesor cree, consulte y desactive sus grupos. También debe generar un código de invitación para cada grupo.

RF-40. Administración de estudiantes del grupo. El sistema debe permitir que el profesor consulte los estudiantes inscritos en sus grupos y retire a un estudiante cuando esté autorizado para hacerlo.

RF-41. Seguimiento académico de grupos. El sistema debe permitir que el profesor supervise el progreso académico de sus grupos mediante un tablero de control y un centro de analítica.

RF-42. Exportación de informes académicos. El sistema debe permitir que el profesor exporte informes académicos en PDF y CSV, incluyendo resúmenes, cuestionarios y evaluaciones, con filtros por grupo y fechas.

RF-43. Consulta de alertas neuroacadémicas. El sistema debe permitir que los profesores y Súper Profesores consulten NeuroAlertas relacionadas con inactividad, falta de inicio de actividades, bajo rendimiento y riesgo académico.

RF-44. Creación y administración de NeuroBots. El sistema debe permitir que el profesor cree, configure, pruebe, active, desactive y elimine NeuroBots, así como definir su visibilidad como públicos o privados.

RF-45. Administración de documentos de NeuroBots. El sistema debe permitir que el profesor agregue, consulte y administre los documentos de conocimiento de sus NeuroBots. Debe admitir archivos PDF con texto, DOCX, TXT y MD, con un tamaño máximo de 4 MB por archivo.

RF-46. Asignación de NeuroBots. El sistema debe permitir que el profesor asigne NeuroBots a grupos o estudiantes y establezca un objetivo de entre 1 y 200 interacciones.

RF-47. Seguimiento del progreso con NeuroBots. El sistema debe permitir que los profesores y Súper Profesores consulten el progreso de los estudiantes con cada NeuroBot asignado, según sus permisos.

RF-48. Administración de evaluaciones. El sistema debe permitir que el profesor cree evaluaciones en borrador, las edite, publique, cierre y elimine.

RF-49. Generación de preguntas con IA. El sistema debe permitir que el profesor genere preguntas para las evaluaciones mediante inteligencia artificial.

RF-50. Consulta y calificación de evaluaciones. El sistema debe permitir que el profesor consulte los resultados de las evaluaciones y califique las preguntas abiertas que requieran revisión manual.

RF-51. Publicación de anuncios. El sistema debe permitir que el profesor publique anuncios en sus grupos y adjunte archivos cuando corresponda.

RF-52. Organización y distribución de materiales. El sistema debe permitir que el profesor organice materiales en carpetas y los comparta con los grupos autorizados.

RF-53. Integraciones con Google Drive y Calendar. El sistema debe permitir que el profesor conecte Google Drive para importar archivos mediante enlaces y Google Calendar para crear eventos, gestionando adecuadamente la autenticación y los permisos de las integraciones.

RF-54. Automatizaciones. El sistema debe permitir que el profesor defina automatizaciones mediante reglas del tipo «cuando ocurra X, ejecutar Y» y consulte el historial de sus ejecuciones.

RF-55. Generación de materiales didácticos con IA. El sistema debe permitir que el profesor genere materiales didácticos mediante inteligencia artificial, incluyendo planes de clase, preguntas, guías de estudio y rúbricas.

RF-56. Administración del calendario por el profesor. El sistema debe permitir que el profesor y el Súper Profesor creen y eliminen eventos del calendario para los grupos o la institución, de acuerdo con sus permisos y las reglas de visibilidad establecidas.
1.5. Funcionalidades del Súper Profesor
RF-57. Administración de profesores. El sistema debe permitir que el Súper Profesor cree, consulte, edite y elimine cuentas de profesores de su institución, generando las credenciales de acceso correspondientes.

RF-58. Administración de estudiantes. El sistema debe permitir que el Súper Profesor cree, consulte, edite y elimine cuentas de estudiantes de su institución.

RF-59. Carga masiva de usuarios. El sistema debe permitir que el Súper Profesor cargue masivamente profesores y estudiantes mediante archivos CSV, validando la información y mostrando una vista previa de las filas antes de confirmar el registro.

RF-60. Consentimiento de acudientes. El sistema debe permitir registrar la autorización del acudiente para estudiantes menores de edad y gestionar los casos en que falte la fecha de nacimiento, conforme a las reglas de protección de datos aplicables.

RF-61. Tablero institucional. El sistema debe mostrar al Súper Profesor un tablero con métricas académicas y administrativas de su institución.

RF-62. Administración institucional de grupos. El sistema debe permitir que el Súper Profesor active, desactive y transfiera grupos a otros profesores de su institución.

RF-63. Supervisión institucional de NeuroBots. El sistema debe permitir que el Súper Profesor consulte los NeuroBots de su institución y los active, desactive o elimine, sin modificar el contenido de los NeuroBots creados por los profesores.

RF-64. Exportación de informes institucionales. El sistema debe permitir que el Súper Profesor exporte informes institucionales en formatos PDF y CSV.

RF-65. Anuncios institucionales. El sistema debe permitir que el Súper Profesor envíe anuncios a toda la institución, a los profesores, a los estudiantes o a un grado específico.

RF-66. Consulta y cierre de sesiones. El sistema debe permitir que el Súper Profesor consulte las sesiones activas y el historial de acceso de los usuarios de su institución, y cierre las sesiones de un usuario cuando esté autorizado.

RF-67. Actualización de datos institucionales. El sistema debe permitir que el Súper Profesor actualice la información de su institución dentro de los permisos asignados.

RF-68. Consulta de auditoría. El sistema debe permitir que el Súper Profesor consulte los registros de auditoría de su institución. El Administrador debe poder consultar los registros de auditoría de toda la plataforma.
1.6. Funcionalidades del Administrador
RF-69. Administración de instituciones. El sistema debe permitir que el Administrador registre instituciones, cree las cuentas de sus Súper Profesores y genere sus credenciales. También debe permitir consultar, activar y desactivar instituciones.

RF-70. Administración de usuarios de la plataforma. El sistema debe permitir que el Administrador consulte, filtre, edite y elimine los usuarios de la plataforma dentro de las operaciones autorizadas.

RF-71. Activación y desactivación de cuentas. El sistema debe permitir que el Administrador active o desactive cuentas de usuario.

RF-72. Asignación de roles y permisos. El sistema debe permitir que el Administrador asigne roles válidos y debe garantizar que cada usuario solo pueda ejecutar las operaciones autorizadas para su rol.

RF-73. Restablecimiento de contraseñas. El sistema debe permitir que el Administrador restablezca la contraseña de un usuario mediante una contraseña temporal.

RF-74. Moderación de NeuroBots de la plataforma. El sistema debe permitir que el Administrador modere los NeuroBots de la plataforma según su visibilidad y estado, y consulte los NeuroBots base preentrenados de las cinco competencias.

RF-75. Estadísticas globales. El sistema debe mostrar al Administrador estadísticas globales de la plataforma, incluyendo el número total y activo de instituciones y los usuarios activos por rol.

RF-76. Monitoreo técnico de la plataforma. El sistema debe permitir que el Administrador consulte, en modo de solo lectura, el estado de la base de datos, los proveedores de inteligencia artificial, el servicio de correo, la versión, el entorno, la vigencia del token y los conteos de usuarios e instituciones.

2. Requisitos no funcionales
2.1. Adecuación funcional
RNF-01. Adecuación funcional por rol. El sistema debe cubrir las funciones definidas para los roles de Estudiante, Profesor, Súper Profesor y Administrador, y debe permitir únicamente las operaciones autorizadas para cada rol.

RNF-02. Corrección y consistencia. El sistema debe producir resultados correctos y consistentes. El repositorio debe ejecutar pruebas automáticas del backend y la compilación del frontend ante cada cambio enviado.
2.2. Seguridad y protección de datos
RNF-03. Protección de contraseñas. El sistema debe almacenar las contraseñas mediante hash bcrypt y exigir una longitud mínima de ocho caracteres que incluya una mayúscula, una minúscula, un número y un carácter especial. Los tokens de recuperación deben almacenarse mediante hash SHA-256.

RNF-04. Seguridad de sesiones y solicitudes. El sistema debe utilizar JWT con vencimiento de 24 horas y mecanismos de invalidación de sesiones. Debe bloquear la cuenta durante 15 minutos después de 20 intentos fallidos dentro de un periodo de cinco minutos. También debe restringir CORS, aplicar las cabeceras de seguridad CSP y HSTS y validar el origen de las solicitudes.

RNF-05. Aislamiento de instituciones. El sistema debe mantener aislados los datos de cada institución mediante un esquema de separación lógica multiinstitucional, de modo que los usuarios no puedan acceder a información de otras instituciones sin autorización.

RNF-06. Protección de credenciales externas. El sistema debe almacenar las credenciales de servicios externos únicamente en variables de entorno del servidor y debe cifrar los tokens de Google.

RNF-07. Confidencialidad de datos neurodigitales. El sistema no debe almacenar videos, audios ni imágenes capturados para el análisis neurodigital. Al servidor solo deben enviarse los indicadores numéricos y el texto dictado que sean necesarios para las funcionalidades autorizadas.

RNF-08. Procesamiento local de señales. El sistema debe procesar en el dispositivo las señales faciales mediante MediaPipe y las señales de prosodia mediante Web Audio. Debe informar y gestionar adecuadamente las condiciones de privacidad del reconocimiento de voz del navegador, que puede utilizar servicios en línea del proveedor.

RNF-09. Persistencia y trazabilidad. El sistema debe mantener la persistencia de los datos académicos y registrar en auditoría las acciones administrativas y de acceso relevantes.
2.3. Fiabilidad y disponibilidad
RNF-10. Disponibilidad y tolerancia a fallos. El sistema debe mantener la disponibilidad de sus funcionalidades y tolerar fallos de los servicios externos. Debe utilizar los mecanismos de respaldo disponibles para los proveedores de inteligencia artificial y gestionar los errores de la base de datos y del despliegue de manera controlada.

RNF-11. Funcionamiento sin conexión. La aplicación debe permitir el acceso sin conexión a las funciones que lo soporten. También debe informar claramente cuáles funcionalidades, incluidos el acceso a datos remotos y el tutor de inteligencia artificial, requieren conexión a internet.
2.4. Rendimiento y capacidad
RNF-12. Tiempo de respuesta. El sistema debe responder en menos de 2,5 segundos en condiciones normales de operación. El cumplimiento debe verificarse mediante pruebas reproducibles que identifiquen las condiciones y las funcionalidades evaluadas.

RNF-13. Capacidad de crecimiento. La plataforma debe soportar el crecimiento del número de instituciones y usuarios. Su capacidad debe verificarse mediante pruebas de carga y de rendimiento.
2.5. Usabilidad, portabilidad e interoperabilidad
RNF-14. Diseño adaptable. La interfaz del sistema debe adaptarse a celulares, tabletas y computadores, manteniendo la legibilidad y el acceso a las funciones disponibles según el rol.

RNF-15. Instalabilidad como PWA. La aplicación debe poder instalarse como aplicación web progresiva (PWA) en navegadores modernos compatibles.

RNF-16. Integración con servicios externos. El sistema debe integrarse con Groq y Gemini para inteligencia artificial, Azure Speech para servicios de voz, Brevo para correo electrónico y Google Drive y Google Calendar para las funcionalidades de integración correspondientes.
