# **Requisitos Funcionales** 

## Neurolearn IA 

Yesica Causado 

Matias Ramirez 

### **Actor: Súper Profesor** 

- El sistema debe permitir al Súper Profesor iniciar y cerrar sesión mediante credenciales institucionales. 

- El sistema debe permitir al Súper Profesor gestionar docentes. 

- El sistema debe permitir al Súper Profesor gestionar cupos de estudiantes 

- El sistema debe permitir la carga masiva de usuarios mediante archivos CSV o Excel. 

- El sistema debe mostrar un dashboard institucional con métricas académicas y administrativas 

- El sistema debe mostrar en el panel del Súper Profesor únicamente los módulos y funcionalidades habilitados según la licencia institucional. 

- El sistema debe mostrar en el panel del Súper Profesor el tipo de licencia activa y su estado. 

- El sistema debe mostrar en el panel del Súper Profesor los límites de la licencia, incluyendo cupos de docentes y estudiantes. 

- El sistema debe mostrar el consumo actual de los cupos disponibles. 

- El sistema debe indicar las funcionalidades que no están disponibles debido al tipo de licencia. 

- El sistema debe restringir el acceso a módulos y funcionalidades que no correspondan a la licencia contratada. 

### **Actor: Profesor** 

- El sistema debe permitir al profesor iniciar sesión de forma segura. 

- El sistema debe obligar al profesor a cambiar la contraseña temporal en el primer acceso. 

- El sistema debe permitir al profesor crear y gestionar aulas o grupos. 

- El sistema debe generar códigos de invitación para las clases creadas. 

- El sistema debe permitir al profesor crear bots expertos de tutoría. 

- El sistema debe permitir cargar documentos de conocimiento para los bots. 

- El sistema debe permitir configurar bots públicos o privados. 

- El sistema debe permitir asignar bots a clases específicas. 

- El sistema debe permitir al profesor visualizar estudiantes inscritos. 

- El sistema debe generar neuro-alertas sobre fatiga, frustración o riesgo académico. 

- El sistema debe permitir visualizar estadísticas y reportes académicos. 

- El sistema debe permitir exportar reportes en formatos PDF o CSV. 

- El sistema debe permitir compartir bots educativos. 

- El sistema debe mostrar en el panel del profesor únicamente los módulos y funcionalidades habilitados según la licencia de la institución a la que pertenece. 

- El sistema debe restringir el acceso del profesor a funcionalidades correspondientes a planes superiores. 

### **Actor: Estudiante** 

- El sistema debe permitir al estudiante registrarse e iniciar sesión. 

- El sistema debe obligar al estudiante a cambiar la contraseña temporal en el primer acceso. 

- El sistema debe permitir recuperar la contraseña mediante correo electrónico. 

- El sistema debe permitir editar información básica del perfil. 

- El sistema debe permitir unirse a clases mediante códigos de invitación. 

- El sistema debe mostrar las habilidades transversales disponibles. 

- El sistema debe permitir seleccionar habilidades para iniciar aprendizaje. 

- El sistema debe mostrar bots de tutoría disponibles. 

- El sistema debe iniciar sesiones de aprendizaje con tutor IA. 

- El sistema debe realizar diagnósticos iniciales de nivel académico. 

- El sistema debe permitir la interacción con el tutor IA mediante chat. 

- El sistema debe generar explicaciones adaptadas al nivel del estudiante. 

- El sistema debe realizar evaluaciones automáticas. 

- El sistema debe proporcionar retroalimentación inmediata. 

- El sistema debe reforzar temas donde existan debilidades. 

- El sistema debe permitir solicitar ejemplos, evaluaciones y resúmenes. 

- El sistema debe mostrar el estado cognitivo del estudiante en tiempo real. 

- El sistema debe mostrar dashboards de progreso académico. 

- El sistema debe almacenar historial de sesiones y conversaciones.* 

- El sistema debe mostrar fortalezas y debilidades del estudiante. 

- El sistema debe registrar y mostrar rachas de aprendizaje. 

- El sistema debe mostrar en el panel del estudiante únicamente las funcionalidades de aprendizaje habilitadas por la licencia de la institución. 

- El sistema debe restringir el acceso del estudiante a funcionalidades que no estén incluidas en la licencia institucional. 

- El sistema debe adaptar las opciones disponibles del dashboard del estudiante de acuerdo con el nivel de licencia contratado. 

### **Actor: Sistema IA** 

- El sistema debe capturar métricas de dinámica de teclado. 

- El sistema debe analizar señales visuales y sonoras cuando exista autorización. 

- El sistema debe realizar fusión multimodal de datos conductuales. 

- El sistema debe inferir estados cognitivos del estudiante. 

- El sistema debe ajustar automáticamente la dificultad pedagógica. 

- El sistema debe predecir posibles errores del estudiante. 

- El sistema debe tomar decisiones pedagógicas automáticas. 

- El sistema debe realizar enseñanza secuencial adaptativa. 

- El sistema debe generar evaluaciones automáticas posteriores a la enseñanza. 

- El sistema debe reforzar automáticamente conceptos no comprendidos. 

- El sistema debe detectar estados de fatiga o frustración. 

- El sistema debe adaptar respuestas según el nivel del estudiante. 

- El sistema debe utilizar APIs externas de IA con mecanismos de fallback. 

- El sistema debe registrar eventos cognitivos e interacciones. 

- El sistema debe actualizar el perfil cognitivo del estudiante. 

- El sistema debe generar recomendaciones pedagógicas para profesores. 

- El sistema debe permitir realizar cambios en el perfil y configuracion 

### **Actor: Administrador** 

- El sistema debe permitir gestionar usuarios registrados. 

- El sistema debe permitir activar o desactivar cuentas. 

- El sistema debe permitir asignar roles de usuario.* 

- El sistema debe permitir moderar bots públicos.* 

- El sistema debe permitir administrar bots pre-entrenados.* 

- El sistema debe mostrar estadísticas globales de la plataforma. 

- El sistema debe monitorear el estado general del sistema. 

- El sistema debe mostrar la auditorial general 

- El sistema debe permitir consultar la configuración de los planes Basic, Premium y Pro. 

- El sistema debe aplicar automáticamente las configuraciones de funcionalidades y límites correspondientes a la licencia asignada a cada institución. 

# **Requisitos No Funcionales** 

- El sistema debe garantizar la privacidad y protección de datos personales según la Ley Habeas Data. 

- El sistema no debe almacenar videos, audios o imágenes en bruto de menores de edad. 

- El sistema debe procesar datos biométricos localmente en el dispositivo. 

- El sistema debe funcionar como una Progressive Web App (PWA). 

- El sistema debe ser responsive y compatible con móviles, tablets y computadores. 

- El sistema debe responder en menos de 2.5 segundos en condiciones normales. 

- El sistema debe implementar arquitectura multi-tenant para separar instituciones. 

- El sistema debe garantizar alta disponibilidad y tolerancia a fallos. 

- * 

- El sistema debe almacenar contraseñas utilizando cifrado hash seguro. 

- El backend debe desarrollarse en FastAPI y Python. 

- El frontend debe desarrollarse en React, TypeScript y Vite. 

- El sistema debe garantizar seguridad e integridad de la información. 

- El sistema debe mantener trazabilidad y persistencia de datos académicos. 

- El sistema debe integrarse con servicios externos de inteligencia artificial. 

