# DICCIONARIO DE LA EDT – NEUROLEARN

**Aplicación híbrida con IA para el fortalecimiento de habilidades académicas**

- **Autores:** Yesica Brigitte Causado Alvarado · Matias Ramirez Torres
- **Proyecto:** NeuroLearn
- **Versión documento:** 1.0

---

## 1. Propósito del documento

Este diccionario de la EDT (Estructura de Desglose de Trabajo) define cada paquete de trabajo del proyecto
**NeuroLearn**, describiendo su alcance, actividades, requisitos, criterios de aceptación, responsables,
duración y costo estimado. Su objetivo es servir como referencia única para la planificación, seguimiento,
control y entrega del proyecto.

---

## 2. Índice de fases y paquetes de trabajo

La EDT se organiza en **6 fases**, cada una dividida en grupos de paquetes de trabajo. Los códigos sigue el
formato **`Fase.Grupo.Paquete`**.

| Fase | Grupo EDT | Contenido | Rango de códigos |
|------|-----------|-----------|------------------|
| 1. Gestión del proyecto | 1.1 | Planificación | 1.1.1 – 1.1.4 |
| 1. Gestión del proyecto | 1.2 | Requisitos | 1.2.1 – 1.2.4 |
| 1. Gestión del proyecto | 1.3 | Estimación y validación | 1.3.1 – 1.3.3 |
| 2. Diseño | 2.1 | Análisis | 2.1.1 – 2.1.4 |
| 2. Diseño | 2.2 | Diseño de paneles (UX/UI) | 2.2.1 – 2.2.5 |
| 2. Diseño | 2.3 | Arquitectura | 2.3.1 – 2.3.4 |
| 2. Diseño | 2.4 | Modelado de datos | 2.4.1 – 2.4.4 |
| 3. Implementación | 3.1 | Autenticación | 3.1.1 – 3.1.4 |
| 3. Implementación | 3.2 | Gestión institucional | 3.2.1 – 3.2.4 |
| 3. Implementación | 3.3 | Paneles | 3.3.1 – 3.3.5 |
| 3. Implementación | 3.4 | Licencias | 3.4.1 – 3.4.4 |
| 3. Implementación | 3.5 | Habilidades | 3.5.1 – 3.5.5 |
| 4. IA | 4.1 | NeuroChat Tutor | 4.1.1 – 4.1.4 |
| 4. IA | 4.2 | NeuroBots y RAG | 4.2.1 – 4.2.4 |
| 4. IA | 4.3 | Análisis neuroconductual | 4.3.1 – 4.3.5 |
| 4. IA | 4.4 | Privacidad y seguridad de IA | 4.4.1 – 4.4.4 |
| 5. Multiplataforma | 5.1 | PWA | 5.1.1 – 5.1.4 |
| 5. Multiplataforma | 5.2 | Aplicación híbrida | 5.2.1 – 5.2.4 |
| 5. Multiplataforma | 5.3 | Servicios y API | 5.3.1 – 5.3.4 |
| 5. Multiplataforma | 5.4 | Optimización | 5.4.1 – 5.4.4 |
| 6. Gestión de calidad | 6.1 | Pruebas funcionales | 6.1.1 – 6.1.4 |
| 6. Gestión de calidad | 6.2 | Pruebas no funcionales | 6.2.1 – 6.2.4 |
| 6. Gestión de calidad | 6.3 | Despliegue | 6.3.1 – 6.3.4 |
| 6. Gestión de calidad | 6.4 | Entrega | 6.4.1 – 6.4.2 |

---

## 3. Responsables y aprobadores

| Rol | Función |
|-----|---------|
| **Desarrolladores** | Responsables de ejecutar cada paquete de trabajo. |
| **Asesor** | Aprobador formal de los entregables y criterios de aceptación. |

---

## 4. Fichas de paquete de trabajo

> Estructura de cada ficha: código EDT, denominación, descripción, requisitos para iniciar, actividades,
> consideraciones contractuales, criterios de aceptación, responsable, aprobador, costo y duración estimada.

---

# FASE 1 — GESTIÓN DEL PROYECTO

## Grupo 1.1 — Planificación

### Ficha 1 — 1.1.1 Planificación del alcance

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.1.1 |
| **Denominación** | Planificación del alcance |
| **Descripción** | Definir y documentar el alcance funcional y técnico de NeuroLearn, incluyendo límites y entregables. |
| **Requisitos para iniciar** | Objetivos y alcance aprobados; información del proyecto disponible. |
| **Actividades** | Revisar objetivos; delimitar alcance; documentar inclusiones y exclusiones; validar alcance. |
| **Consideraciones contractuales** | Cambios de alcance deben pasar por control de cambios. |
| **Criterios de aceptación** | Documento de alcance aprobado por el equipo del proyecto. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en la gestión del proyecto |
| **Duración estimada** | 1 día |

### Ficha 2 — 1.1.2 Planificación del cronograma

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.1.2 |
| **Denominación** | Planificación del cronograma |
| **Descripción** | Establecer las actividades, dependencias, hitos y tiempos del proyecto. |
| **Requisitos para iniciar** | Alcance definido y EDT aprobado. |
| **Actividades** | Desglosar actividades; estimar duración; establecer dependencias; definir hitos; elaborar cronograma. |
| **Consideraciones contractuales** | El cronograma será referencia para seguimiento y control. |
| **Criterios de aceptación** | Cronograma aprobado y con hitos definidos. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en la gestión del proyecto |
| **Duración estimada** | 1 día |

### Ficha 3 — 1.1.3 Planificación de recursos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.1.3 |
| **Denominación** | Planificación de recursos |
| **Descripción** | Identificar recursos humanos, tecnológicos, de software y de infraestructura necesarios. |
| **Requisitos para iniciar** | EDT y cronograma preliminar disponibles. |
| **Actividades** | Identificar perfiles; herramientas; servicios; infraestructura; disponibilidad de recursos. |
| **Consideraciones contractuales** | Los recursos deben ajustarse al presupuesto y alcance aprobado. |
| **Criterios de aceptación** | Matriz de recursos validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en la gestión del proyecto |
| **Duración estimada** | 1 día |

### Ficha 4 — 1.1.4 Seguimiento y control

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.1.4 |
| **Denominación** | Seguimiento y control |
| **Descripción** | Realizar el seguimiento periódico del avance del proyecto NeuroLearn, verificando el cumplimiento del cronograma, alcance, actividades, entregables, recursos y objetivos establecidos, identificando desviaciones y aplicando las acciones correctivas necesarias. |
| **Requisitos para iniciar** | EDT aprobada; cronograma definido; alcance y entregables establecidos; responsables identificados y criterios de seguimiento definidos. |
| **Actividades** | Revisar periódicamente el avance del proyecto; comparar el avance real con el cronograma; verificar el cumplimiento de los entregables; identificar desviaciones de tiempo, alcance o recursos; registrar problemas, riesgos e incidencias. |
| **Consideraciones contractuales** | El seguimiento y control se realizará durante todo el ciclo de vida del proyecto. Los cambios significativos deberán ser revisados con el Asesor. |
| **Criterios de aceptación** | El avance está registrado y actualizado; las desviaciones tienen seguimiento; las incidencias están documentadas; las acciones correctivas están registradas y existen evidencias periódicas de seguimiento. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en la gestión del proyecto |
| **Duración estimada** | Durante todo el proyecto |

## Grupo 1.2 — Requisitos

### Ficha 5 — 1.2.1 Requisitos funcionales

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.2.1 |
| **Denominación** | Requisitos funcionales |
| **Descripción** | Documentar las funciones que NeuroLearn debe proporcionar a sus usuarios. |
| **Requisitos para iniciar** | Información de usuarios, procesos y objetivos disponible. |
| **Actividades** | Levantar requisitos; redactar requisitos; clasificarlos; validar con interesados. |
| **Consideraciones contractuales** | Los requisitos deben ser trazables y verificables. |
| **Criterios de aceptación** | Documento de requisitos funcionales validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis |
| **Duración estimada** | 3 días |

### Ficha 6 — 1.2.2 Requisitos no funcionales

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.2.2 |
| **Denominación** | Requisitos no funcionales |
| **Descripción** | Definir criterios de rendimiento, seguridad, disponibilidad, usabilidad y compatibilidad. |
| **Requisitos para iniciar** | Arquitectura preliminar y objetivos del sistema. |
| **Actividades** | Definir métricas; establecer restricciones; documentar criterios; validar valores objetivo. |
| **Consideraciones contractuales** | Los RNF deben ser medibles cuando sea posible. |
| **Criterios de aceptación** | Documento de RNF aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis |
| **Duración estimada** | 2 días |

### Ficha 7 — 1.2.3 Requisitos por tipo de usuario

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.2.3 |
| **Denominación** | Requisitos por tipo de usuario |
| **Descripción** | Definir necesidades y permisos específicos del Súper Profesor, Profesor y Estudiante. |
| **Requisitos para iniciar** | Roles identificados. |
| **Actividades** | Caracterizar usuarios; definir necesidades; mapear permisos; validar flujos. |
| **Consideraciones contractuales** | Los permisos deben ser consistentes con las reglas de negocio. |
| **Criterios de aceptación** | Matriz de requisitos por rol aprobada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis |
| **Duración estimada** | 2 días |

### Ficha 8 — 1.2.4 Requisitos por licencia

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.2.4 |
| **Denominación** | Requisitos por licencia |
| **Descripción** | Definir las funcionalidades, límites y accesos correspondientes a Basic, Premium y Pro. |
| **Requisitos para iniciar** | Modelo de licenciamiento definido. |
| **Actividades** | Comparar planes; establecer límites; definir funcionalidades; documentar restricciones. |
| **Consideraciones contractuales** | El acceso debe depender de la licencia institucional vigente. |
| **Criterios de aceptación** | Matriz de funcionalidades por licencia aprobada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en licenciamiento |
| **Duración estimada** | 2 días |

## Grupo 1.3 — Estimación y validación

### Ficha 9 — 1.3.1 Validación del alcance

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.3.1 |
| **Denominación** | Validación del alcance |
| **Descripción** | Verificar que el alcance definido corresponda con los objetivos del proyecto. |
| **Requisitos para iniciar** | Documento de alcance y requisitos preliminares. |
| **Actividades** | Revisar alcance; contrastar requisitos; registrar observaciones; ajustar documentación. |
| **Consideraciones contractuales** | No se incorporarán funcionalidades fuera del alcance sin aprobación. |
| **Criterios de aceptación** | Alcance validado y sin inconsistencias críticas. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en gestión |
| **Duración estimada** | 1 día |

### Ficha 10 — 1.3.2 Validación de requisitos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.3.2 |
| **Denominación** | Validación de requisitos |
| **Descripción** | Comprobar que los requisitos sean claros, completos, consistentes y verificables. |
| **Requisitos para iniciar** | Documento de requisitos completo. |
| **Actividades** | Revisar duplicidades; verificar trazabilidad; corregir ambigüedades; aprobar requisitos. |
| **Consideraciones contractuales** | Los requisitos ambiguos deben corregirse antes del diseño. |
| **Criterios de aceptación** | Matriz de requisitos validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis |
| **Duración estimada** | 2 días |

### Ficha 11 — 1.3.3 Criterios de aceptación

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 1.3.3 |
| **Denominación** | Criterios de aceptación |
| **Descripción** | Definir las condiciones que permitirán determinar si cada entregable cumple con lo esperado. |
| **Requisitos para iniciar** | Requisitos y entregables definidos. |
| **Actividades** | Definir condiciones de aceptación; asociarlas a entregables; validar criterios. |
| **Consideraciones contractuales** | Los criterios deben ser observables y comprobables. |
| **Criterios de aceptación** | Criterios de aceptación documentados. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en gestión |
| **Duración estimada** | 2 días |

---

# FASE 2 — DISEÑO

## Grupo 2.1 — Análisis

### Ficha 12 — 2.1.1 Identificación de actores

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.1.1 |
| **Denominación** | Identificación de actores |
| **Descripción** | Identificar los actores que interactúan con NeuroLearn y sus responsabilidades. |
| **Requisitos para iniciar** | Requisitos y roles preliminares. |
| **Actividades** | Identificar actores; describir responsabilidades; relacionar actores con funcionalidades. |
| **Consideraciones contractuales** | Debe incluirse como mínimo Súper Profesor, Profesor y Estudiante. |
| **Criterios de aceptación** | Catálogo de actores aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 1 día |

### Ficha 13 — 2.1.2 Casos de uso

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.1.2 |
| **Denominación** | Casos de uso |
| **Descripción** | Modelar las interacciones principales entre usuarios y sistema. |
| **Requisitos para iniciar** | Actores y requisitos disponibles. |
| **Actividades** | Definir casos de uso; documentar flujos; identificar excepciones; validar relaciones. |
| **Consideraciones contractuales** | Los casos de uso deben cubrir el alcance funcional. |
| **Criterios de aceptación** | Modelo de casos de uso validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

### Ficha 14 — 2.1.3 Reglas de negocio

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.1.3 |
| **Denominación** | Reglas de negocio |
| **Descripción** | Definir las condiciones que regulan usuarios, licencias, clases, contenidos y acceso. |
| **Requisitos para iniciar** | Requisitos funcionales y de licenciamiento. |
| **Actividades** | Identificar reglas; documentarlas; relacionarlas con procesos; validar consistencia. |
| **Consideraciones contractuales** | Las reglas deben poder implementarse y verificarse. |
| **Criterios de aceptación** | Catálogo de reglas de negocio aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

### Ficha 15 — 2.1.4 Roles y permisos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.1.4 |
| **Denominación** | Roles y permisos |
| **Descripción** | Establecer permisos por rol y restricciones de acceso. |
| **Requisitos para iniciar** | Actores y reglas de negocio definidos. |
| **Actividades** | Definir matriz de permisos; validar acceso a módulos; documentar restricciones. |
| **Consideraciones contractuales** | Debe respetarse la separación de privilegios. |
| **Criterios de aceptación** | Matriz de roles y permisos aprobada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en seguridad |
| **Duración estimada** | 2 días |

## Grupo 2.2 — Diseño de paneles (UX/UI)

### Ficha 16 — 2.2.1 Diseño del panel Súper Profesor

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.2.1 |
| **Denominación** | Diseño del panel Súper Profesor |
| **Descripción** | Diseñar la experiencia y estructura visual del panel institucional. |
| **Requisitos para iniciar** | Requisitos del Súper Profesor y licencia disponibles. |
| **Actividades** | Crear arquitectura de información; wireframes; componentes; prototipo; validación. |
| **Consideraciones contractuales** | El diseño debe mostrar solo funciones disponibles según licencia. |
| **Criterios de aceptación** | Prototipo validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

### Ficha 17 — 2.2.2 Diseño del panel Profesor

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.2.2 |
| **Denominación** | Diseño del panel Profesor |
| **Descripción** | Diseñar la experiencia visual del docente y sus principales flujos. |
| **Requisitos para iniciar** | Requisitos del Profesor disponibles. |
| **Actividades** | Diseñar navegación; vistas; componentes; estados; prototipo. |
| **Consideraciones contractuales** | Debe contemplar gestión de clases, estudiantes y alertas. |
| **Criterios de aceptación** | Prototipo validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

### Ficha 18 — 2.2.3 Diseño del panel Estudiante

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.2.3 |
| **Denominación** | Diseño del panel Estudiante |
| **Descripción** | Diseñar la experiencia del estudiante y su acceso al aprendizaje personalizado. |
| **Requisitos para iniciar** | Requisitos del estudiante disponibles. |
| **Actividades** | Diseñar dashboard; navegación; progreso; sesiones; historial. |
| **Consideraciones contractuales** | La interfaz debe priorizar claridad y facilidad de uso. |
| **Criterios de aceptación** | Prototipo validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

### Ficha 19 — 2.2.4 Diseño Admin

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.2.4 |
| **Denominación** | Diseño Admin |
| **Descripción** | Diseñar la interfaz administrativa para gestión institucional, usuarios, licencias y configuración. |
| **Requisitos para iniciar** | Requisitos administrativos y de licenciamiento disponibles. |
| **Actividades** | Definir arquitectura; diseñar vistas administrativas; establecer componentes; prototipar; validar. |
| **Consideraciones contractuales** | Debe diferenciar funciones administrativas de las funciones académicas. |
| **Criterios de aceptación** | Prototipo del panel Admin aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

### Ficha 20 — 2.2.5 Diseño Responsive

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.2.5 |
| **Denominación** | Diseño Responsive |
| **Descripción** | Diseñar la adaptación de NeuroLearn a diferentes tamaños de pantalla y dispositivos. |
| **Requisitos para iniciar** | Diseños base de los paneles disponibles. |
| **Actividades** | Definir breakpoints; adaptar componentes; validar navegación móvil, tablet y escritorio. |
| **Consideraciones contractuales** | Debe mantener funcionalidad y legibilidad en los dispositivos objetivo. |
| **Criterios de aceptación** | Diseños responsive validados. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

## Grupo 2.3 — Arquitectura

### Ficha 21 — 2.3.1 Arquitectura frontend

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.3.1 |
| **Denominación** | Arquitectura frontend |
| **Descripción** | Definir la estructura técnica del frontend de NeuroLearn. |
| **Requisitos para iniciar** | Requisitos y diseño UX/UI disponibles. |
| **Actividades** | Definir componentes; rutas; gestión de estado; estructura de proyecto; estándares. |
| **Consideraciones contractuales** | Debe permitir mantenimiento y escalabilidad. |
| **Criterios de aceptación** | Documento/estructura de arquitectura frontend aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en arquitectura |
| **Duración estimada** | 2 días |

### Ficha 22 — 2.3.2 Arquitectura backend

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.3.2 |
| **Denominación** | Arquitectura backend |
| **Descripción** | Definir servicios, API, lógica de negocio y organización del backend. |
| **Requisitos para iniciar** | Requisitos funcionales y RNF disponibles. |
| **Actividades** | Definir capas; endpoints; servicios; validaciones; manejo de errores. |
| **Consideraciones contractuales** | Debe garantizar separación de responsabilidades y seguridad. |
| **Criterios de aceptación** | Arquitectura backend documentada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en arquitectura |
| **Duración estimada** | 2 días |

### Ficha 23 — 2.3.3 Arquitectura de IA

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.3.3 |
| **Denominación** | Arquitectura de IA |
| **Descripción** | Definir integración de modelos y servicios de IA de NeuroLearn. |
| **Requisitos para iniciar** | Requisitos de IA y datos disponibles. |
| **Actividades** | Definir flujo de inferencia; proveedores; contexto; fallback; control de latencia. |
| **Consideraciones contractuales** | Debe contemplar disponibilidad y control de respuestas. |
| **Criterios de aceptación** | Arquitectura de IA documentada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en arquitectura |
| **Duración estimada** | 2 días |

### Ficha 24 — 2.3.4 Arquitectura PWA/híbrida

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.3.4 |
| **Denominación** | Arquitectura PWA/híbrida |
| **Descripción** | Definir la arquitectura que permita ejecutar NeuroLearn como PWA y aplicación híbrida. |
| **Requisitos para iniciar** | Requisitos multiplataforma disponibles. |
| **Actividades** | Definir estrategia PWA; contenedor híbrido; comunicación con dispositivo; permisos. |
| **Consideraciones contractuales** | Debe mantener una base de código coherente entre plataformas. |
| **Criterios de aceptación** | Documento de arquitectura multiplataforma aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en arquitectura |
| **Duración estimada** | 2 días |

## Grupo 2.4 — Modelado de datos

### Ficha 25 — 2.4.1 Modelo de datos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.4.1 |
| **Denominación** | Modelo de datos |
| **Descripción** | Diseñar el modelo conceptual, lógico y relacional de NeuroLearn. |
| **Requisitos para iniciar** | Requisitos y entidades identificadas. |
| **Actividades** | Identificar entidades; relaciones; atributos; restricciones; normalización. |
| **Consideraciones contractuales** | Debe soportar el alcance funcional y multi-institución. |
| **Criterios de aceptación** | Modelo de datos aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

### Ficha 26 — 2.4.2 Modelo de usuarios e instituciones

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.4.2 |
| **Denominación** | Modelo de usuarios e instituciones |
| **Descripción** | Diseñar las estructuras de usuarios, roles e instituciones. |
| **Requisitos para iniciar** | Modelo general de datos disponible. |
| **Actividades** | Definir usuarios; instituciones; relaciones; roles; permisos. |
| **Consideraciones contractuales** | Debe soportar aislamiento de información institucional. |
| **Criterios de aceptación** | Modelo validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 1 día |

### Ficha 27 — 2.4.3 Modelo de licencias

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.4.3 |
| **Denominación** | Modelo de licencias |
| **Descripción** | Diseñar entidades y relaciones para planes, límites, vigencias y funcionalidades. |
| **Requisitos para iniciar** | Requisitos de licenciamiento disponibles. |
| **Actividades** | Definir planes; licencias; límites; vigencia; características; relaciones. |
| **Consideraciones contractuales** | Debe permitir determinar funcionalidades por licencia. |
| **Criterios de aceptación** | Modelo de licenciamiento validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 1 día |

### Ficha 28 — 2.4.4 Modelo académico y sesiones

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 2.4.4 |
| **Denominación** | Modelo académico y sesiones |
| **Descripción** | Diseñar estructuras para clases, grupos, habilidades, actividades, sesiones y progreso. |
| **Requisitos para iniciar** | Requisitos académicos disponibles. |
| **Actividades** | Definir entidades; relaciones; resultados; historial; métricas. |
| **Consideraciones contractuales** | Debe permitir trazabilidad del progreso del estudiante. |
| **Criterios de aceptación** | Modelo académico validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en diseño |
| **Duración estimada** | 2 días |

---

# FASE 3 — IMPLEMENTACIÓN

## Grupo 3.1 — Autenticación

### Ficha 29 — 3.1.1 Registro e inicio de sesión

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.1.1 |
| **Denominación** | Registro e inicio de sesión |
| **Descripción** | Implementar el acceso seguro de usuarios a la plataforma. |
| **Requisitos para iniciar** | Diseño de autenticación y base de datos disponibles. |
| **Actividades** | Implementar registro; login; validación; cierre de sesión; manejo de errores. |
| **Consideraciones contractuales** | Debe impedir accesos no autorizados. |
| **Criterios de aceptación** | Pruebas de autenticación satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en desarrollo |
| **Duración estimada** | 3 días |

### Ficha 30 — 3.1.2 Gestión de perfiles

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.1.2 |
| **Denominación** | Gestión de perfiles |
| **Descripción** | Implementar consulta y actualización de información de usuario. |
| **Requisitos para iniciar** | Autenticación funcionando. |
| **Actividades** | Crear vistas y endpoints; validar datos; permitir edición controlada. |
| **Consideraciones contractuales** | Solo el usuario autorizado podrá modificar su perfil. |
| **Criterios de aceptación** | Perfil actualizado correctamente. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en desarrollo |
| **Duración estimada** | 2 días |

### Ficha 31 — 3.1.3 Roles y permisos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.1.3 |
| **Denominación** | Roles y permisos |
| **Descripción** | Implementar control de acceso basado en roles. |
| **Requisitos para iniciar** | Matriz de roles y permisos aprobada. |
| **Actividades** | Configurar roles; middleware/guards; restricciones; validaciones. |
| **Consideraciones contractuales** | Un usuario no podrá acceder a funciones no autorizadas. |
| **Criterios de aceptación** | Pruebas de permisos satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en seguridad |
| **Duración estimada** | 3 días |

### Ficha 32 — 3.1.4 Recuperación de contraseña

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.1.4 |
| **Denominación** | Recuperación de contraseña |
| **Descripción** | Implementar el proceso seguro para recuperar acceso a la cuenta. |
| **Requisitos para iniciar** | Servicio de correo y autenticación configurados. |
| **Actividades** | Solicitar recuperación; validar token; cambiar contraseña; invalidar token. |
| **Consideraciones contractuales** | Los tokens deben ser temporales y de un solo uso. |
| **Criterios de aceptación** | Flujo completo probado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en seguridad |
| **Duración estimada** | 2 días |

## Grupo 3.2 — Gestión institucional

### Ficha 33 — 3.2.1 Gestión de profesores

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.2.1 |
| **Denominación** | Gestión de profesores |
| **Descripción** | Implementar administración de profesores por parte del responsable institucional. |
| **Requisitos para iniciar** | Roles y modelo institucional disponibles. |
| **Actividades** | Crear; consultar; editar; activar/desactivar profesores. |
| **Consideraciones contractuales** | Debe respetar los límites de la licencia. |
| **Criterios de aceptación** | Gestión CRUD validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 3 días |

### Ficha 34 — 3.2.2 Gestión de estudiantes

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.2.2 |
| **Denominación** | Gestión de estudiantes |
| **Descripción** | Implementar administración de estudiantes y su asociación institucional. |
| **Requisitos para iniciar** | Modelo académico disponible. |
| **Actividades** | Crear; consultar; editar; asignar; activar/desactivar estudiantes. |
| **Consideraciones contractuales** | Debe controlar límites institucionales. |
| **Criterios de aceptación** | Gestión validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 3 días |

### Ficha 35 — 3.2.3 Gestión de grupos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.2.3 |
| **Denominación** | Gestión de grupos |
| **Descripción** | Implementar creación y administración de grupos académicos. |
| **Requisitos para iniciar** | Profesores y estudiantes disponibles. |
| **Actividades** | Crear grupos; editar; asignar miembros; consultar integrantes. |
| **Consideraciones contractuales** | Los grupos deben pertenecer a una institución. |
| **Criterios de aceptación** | Gestión de grupos validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 3 días |

### Ficha 36 — 3.2.4 Gestión de clases

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.2.4 |
| **Denominación** | Gestión de clases |
| **Descripción** | Implementar creación y administración de clases por los docentes. |
| **Requisitos para iniciar** | Grupos y profesores disponibles. |
| **Actividades** | Crear clase; asociar grupo; administrar integrantes; consultar información. |
| **Consideraciones contractuales** | Solo usuarios autorizados podrán modificar clases. |
| **Criterios de aceptación** | Gestión de clases validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 3 días |

## Grupo 3.3 — Paneles

### Ficha 37 — 3.3.1 Panel Súper Profesor

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.3.1 |
| **Denominación** | Panel Súper Profesor |
| **Descripción** | Implementar el panel institucional para supervisión y administración. |
| **Requisitos para iniciar** | Diseño y permisos disponibles. |
| **Actividades** | Construir navegación; indicadores; gestión institucional; alertas; acceso a módulos. |
| **Consideraciones contractuales** | Debe mostrar información según licencia. |
| **Criterios de aceptación** | Panel funcional y validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 5 días |

### Ficha 38 — 3.3.2 Panel Profesor

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.3.2 |
| **Denominación** | Panel Profesor |
| **Descripción** | Implementar el panel docente para administrar clases y seguimiento. |
| **Requisitos para iniciar** | Diseño y permisos disponibles. |
| **Actividades** | Construir dashboard; clases; estudiantes; alertas; herramientas docentes. |
| **Consideraciones contractuales** | Debe limitar funciones según licencia institucional. |
| **Criterios de aceptación** | Panel funcional y validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 5 días |

### Ficha 39 — 3.3.3 Panel Estudiante

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.3.3 |
| **Denominación** | Panel Estudiante |
| **Descripción** | Implementar el panel de aprendizaje y progreso del estudiante. |
| **Requisitos para iniciar** | Diseño y módulos académicos disponibles. |
| **Actividades** | Construir dashboard; habilidades; actividades; sesiones; historial. |
| **Consideraciones contractuales** | Debe presentar información personalizada del estudiante. |
| **Criterios de aceptación** | Panel funcional y validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 5 días |

### Ficha 40 — 3.3.4 Panel Admin

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.3.4 |
| **Denominación** | Panel Admin |
| **Descripción** | Implementar el panel administrativo para configuración y gestión institucional. |
| **Requisitos para iniciar** | Diseño Admin, roles y licenciamiento disponibles. |
| **Actividades** | Construir navegación; gestión; configuración; permisos; indicadores administrativos. |
| **Consideraciones contractuales** | Debe restringirse a usuarios con permisos administrativos. |
| **Criterios de aceptación** | Panel Admin validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 5 días |

### Ficha 41 — 3.3.5 Dashboards

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.3.5 |
| **Denominación** | Dashboards |
| **Descripción** | Implementar dashboards con indicadores relevantes para cada tipo de usuario. |
| **Requisitos para iniciar** | Datos y métricas definidos. |
| **Actividades** | Construir tarjetas; gráficos; filtros; estados; indicadores. |
| **Consideraciones contractuales** | Los datos mostrados deben corresponder al rol y licencia. |
| **Criterios de aceptación** | Dashboards funcionales y con datos consistentes. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 4 días |

## Grupo 3.4 — Licencias

### Ficha 42 — 3.4.1 Licencia Basic

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.4.1 |
| **Denominación** | Licencia Basic |
| **Descripción** | Implementar configuración y restricciones del plan Basic. |
| **Requisitos para iniciar** | Matriz de funcionalidades por licencia aprobada. |
| **Actividades** | Configurar límites; permisos; módulos; validaciones. |
| **Consideraciones contractuales** | No debe habilitar funcionalidades Premium/Pro. |
| **Criterios de aceptación** | Pruebas de acceso Basic satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en licenciamiento |
| **Duración estimada** | 2 días |

### Ficha 43 — 3.4.2 Licencia Premium

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.4.2 |
| **Denominación** | Licencia Premium |
| **Descripción** | Implementar configuración y funcionalidades del plan Premium. |
| **Requisitos para iniciar** | Matriz de funcionalidades aprobada. |
| **Actividades** | Configurar límites; módulos; funcionalidades Premium; validaciones. |
| **Consideraciones contractuales** | Debe incluir únicamente lo definido para Premium y lo común. |
| **Criterios de aceptación** | Pruebas Premium satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en licenciamiento |
| **Duración estimada** | 2 días |

### Ficha 44 — 3.4.3 Licencia Pro

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.4.3 |
| **Denominación** | Licencia Pro |
| **Descripción** | Implementar configuración y funcionalidades del plan Pro. |
| **Requisitos para iniciar** | Matriz de funcionalidades aprobada. |
| **Actividades** | Configurar límites; módulos; funcionalidades Pro; validaciones. |
| **Consideraciones contractuales** | Debe habilitar únicamente las funciones correspondientes. |
| **Criterios de aceptación** | Pruebas Pro satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en licenciamiento |
| **Duración estimada** | 2 días |

### Ficha 45 — 3.4.4 Control de funcionalidades según licencia

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.4.4 |
| **Denominación** | Control de funcionalidades según licencia |
| **Descripción** | Aplicar dinámicamente las restricciones y funciones disponibles por licencia. |
| **Requisitos para iniciar** | Planes y funcionalidades configurados. |
| **Actividades** | Implementar validación de licencia; ocultar/bloquear funciones; validar límites. |
| **Consideraciones contractuales** | La licencia debe ser la fuente de autorización funcional. |
| **Criterios de aceptación** | Pruebas cruzadas de licencias aprobadas. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en licenciamiento |
| **Duración estimada** | 3 días |

## Grupo 3.5 — Habilidades

### Ficha 46 — 3.5.1 Pensamiento lógico-matemático

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.5.1 |
| **Denominación** | Pensamiento lógico-matemático |
| **Descripción** | Integrar la habilidad de pensamiento lógico-matemático en la plataforma. |
| **Requisitos para iniciar** | Modelo de habilidades definido. |
| **Actividades** | Crear categoría; asociar contenidos; registrar actividades; medir progreso. |
| **Consideraciones contractuales** | Debe ser visible según configuración del sistema/licencia. |
| **Criterios de aceptación** | Habilidad operativa y medible. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 2 días |

### Ficha 47 — 3.5.2 Lectura crítica

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.5.2 |
| **Denominación** | Lectura crítica |
| **Descripción** | Integrar la habilidad de lectura crítica. |
| **Requisitos para iniciar** | Modelo de habilidades definido. |
| **Actividades** | Configurar categoría; contenidos; actividades; métricas. |
| **Consideraciones contractuales** | Debe registrar progreso correctamente. |
| **Criterios de aceptación** | Habilidad validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 2 días |

### Ficha 48 — 3.5.3 Inglés comunicativo

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.5.3 |
| **Denominación** | Inglés comunicativo |
| **Descripción** | Integrar la habilidad de inglés comunicativo. |
| **Requisitos para iniciar** | Modelo de habilidades definido. |
| **Actividades** | Configurar categoría; actividades; seguimiento; métricas. |
| **Consideraciones contractuales** | Debe registrar resultados por habilidad. |
| **Criterios de aceptación** | Habilidad validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 2 días |

### Ficha 49 — 3.5.4 Competencias ciudadanas

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.5.4 |
| **Denominación** | Competencias ciudadanas |
| **Descripción** | Integrar la habilidad de competencias ciudadanas. |
| **Requisitos para iniciar** | Modelo de habilidades definido. |
| **Actividades** | Configurar categoría; actividades; seguimiento; métricas. |
| **Consideraciones contractuales** | Debe registrar resultados por habilidad. |
| **Criterios de aceptación** | Habilidad validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 2 días |

### Ficha 50 — 3.5.5 Pensamiento científico

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 3.5.5 |
| **Denominación** | Pensamiento científico |
| **Descripción** | Integrar la habilidad de pensamiento científico. |
| **Requisitos para iniciar** | Modelo de habilidades definido. |
| **Actividades** | Configurar categoría; actividades; seguimiento; métricas. |
| **Consideraciones contractuales** | Debe registrar resultados por habilidad. |
| **Criterios de aceptación** | Habilidad validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en plataforma |
| **Duración estimada** | 2 días |

---

# FASE 4 — IA

## Grupo 4.1 — NeuroChat Tutor

### Ficha 51 — 4.1.1 Interfaz de NeuroChat Tutor

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.1.1 |
| **Denominación** | Interfaz de NeuroChat Tutor |
| **Descripción** | Implementar la interfaz de interacción conversacional con el tutor IA. |
| **Requisitos para iniciar** | Diseño y servicio de IA disponibles. |
| **Actividades** | Construir chat; mensajes; estados de carga/error; entrada de usuario. |
| **Consideraciones contractuales** | Debe ser usable y mostrar respuestas de forma clara. |
| **Criterios de aceptación** | Chat funcional y validado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 3 días |

### Ficha 52 — 4.1.2 Procesamiento de consultas

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.1.2 |
| **Denominación** | Procesamiento de consultas |
| **Descripción** | Implementar el envío y procesamiento de consultas del estudiante. |
| **Requisitos para iniciar** | API de IA disponible. |
| **Actividades** | Validar consulta; enviar contexto; procesar respuesta; manejar errores. |
| **Consideraciones contractuales** | Debe proteger datos y controlar tiempos de respuesta. |
| **Criterios de aceptación** | Consultas procesadas correctamente. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 3 días |

### Ficha 53 — 4.1.3 Generación de respuestas

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.1.3 |
| **Denominación** | Generación de respuestas |
| **Descripción** | Integrar la generación de respuestas del modelo de IA. |
| **Requisitos para iniciar** | Proveedor/modelo configurado. |
| **Actividades** | Construir prompts; integrar modelo; procesar respuesta; aplicar controles. |
| **Consideraciones contractuales** | Las respuestas deben corresponder al contexto solicitado. |
| **Criterios de aceptación** | Pruebas de respuestas satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 3 días |

### Ficha 54 — 4.1.4 Tutoría personalizada

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.1.4 |
| **Denominación** | Tutoría personalizada |
| **Descripción** | Adaptar la interacción del tutor al contexto, habilidad y progreso del estudiante. |
| **Requisitos para iniciar** | Datos académicos e IA disponibles. |
| **Actividades** | Construir contexto; incorporar progreso; generar recomendaciones; retroalimentar. |
| **Consideraciones contractuales** | La personalización debe basarse en datos disponibles y autorizados. |
| **Criterios de aceptación** | Casos de tutoría personalizados validados. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 4 días |

## Grupo 4.2 — NeuroBots y RAG

### Ficha 55 — 4.2.1 Creación de NeuroBots

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.2.1 |
| **Denominación** | Creación de NeuroBots |
| **Descripción** | Permitir al docente crear asistentes especializados. |
| **Requisitos para iniciar** | Diseño de NeuroBots y permisos disponibles. |
| **Actividades** | Crear formulario; validar datos; guardar configuración; asociar habilidad. |
| **Consideraciones contractuales** | Debe respetar límites de licencia. |
| **Criterios de aceptación** | NeuroBot creado correctamente. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 3 días |

### Ficha 56 — 4.2.2 Carga de documentos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.2.2 |
| **Denominación** | Carga de documentos |
| **Descripción** | Permitir cargar documentos para alimentar la base de conocimiento. |
| **Requisitos para iniciar** | Almacenamiento y permisos configurados. |
| **Actividades** | Cargar; validar formato; validar tamaño; almacenar documento. |
| **Consideraciones contractuales** | Solo formatos permitidos y archivos autorizados. |
| **Criterios de aceptación** | Carga validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 3 días |

### Ficha 57 — 4.2.3 Base de conocimiento

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.2.3 |
| **Denominación** | Base de conocimiento |
| **Descripción** | Procesar documentos y convertirlos en información consultable. |
| **Requisitos para iniciar** | Documentos cargados. |
| **Actividades** | Extraer texto; dividir contenido; generar representaciones; almacenar índices. |
| **Consideraciones contractuales** | La información debe asociarse al NeuroBot correspondiente. |
| **Criterios de aceptación** | Base de conocimiento consultable. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 4 días |

### Ficha 58 — 4.2.4 Sistema RAG

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.2.4 |
| **Denominación** | Sistema RAG |
| **Descripción** | Implementar recuperación de información contextual para responder consultas. |
| **Requisitos para iniciar** | Base de conocimiento y modelo IA disponibles. |
| **Actividades** | Recuperar fragmentos; construir contexto; enviar al modelo; devolver respuesta. |
| **Consideraciones contractuales** | La respuesta debe utilizar información recuperada cuando corresponda. |
| **Criterios de aceptación** | Pruebas RAG satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 4 días |

## Grupo 4.3 — Análisis neuroconductual

### Ficha 59 — 4.3.1 FACIAL microexpresiones y cambios faciales

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.3.1 |
| **Denominación** | FACIAL microexpresiones y cambios faciales |
| **Descripción** | Implementar el análisis del patrón Facial para identificar microexpresiones y cambios faciales durante la interacción con NeuroLearn. |
| **Requisitos para iniciar** | Cámara disponible; consentimiento y permisos configurados; componente de procesamiento disponible. |
| **Actividades** | Capturar señales faciales necesarias; procesarlas localmente; identificar cambios y microexpresiones; generar indicadores; asociar resultados a la sesión. |
| **Consideraciones contractuales** | No almacenar video bruto. El análisis debe limitarse a indicadores necesarios y autorizados. |
| **Criterios de aceptación** | Indicadores faciales generados correctamente y sin persistencia de video bruto. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis neuroconductual |
| **Duración estimada** | 4 días |

### Ficha 60 — 4.3.2 VOZ prosodia, ritmo y pausas

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.3.2 |
| **Denominación** | VOZ prosodia, ritmo y pausas |
| **Descripción** | Implementar el análisis del patrón Voz para identificar características de prosodia, ritmo y pausas durante la interacción. |
| **Requisitos para iniciar** | Micrófono disponible; consentimiento y permisos configurados; componente de procesamiento disponible. |
| **Actividades** | Capturar señales necesarias; analizar prosodia; medir ritmo y pausas; generar indicadores; asociar resultados a la sesión. |
| **Consideraciones contractuales** | No almacenar audio bruto. El procesamiento debe respetar las condiciones de privacidad definidas. |
| **Criterios de aceptación** | Indicadores de voz generados correctamente y sin persistencia de audio bruto. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis neuroconductual |
| **Duración estimada** | 4 días |

### Ficha 61 — 4.3.3 TECLADO velocidad, pausas y errores

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.3.3 |
| **Denominación** | TECLADO velocidad, pausas y errores |
| **Descripción** | Implementar el análisis del patrón Teclado mediante velocidad, pausas y errores de interacción. |
| **Requisitos para iniciar** | Eventos de teclado disponibles; sesión iniciada; mecanismos de medición configurados. |
| **Actividades** | Capturar eventos necesarios; calcular velocidad; medir pausas; contabilizar errores; generar indicadores; asociar resultados a la sesión. |
| **Consideraciones contractuales** | No registrar contenido sensible innecesario; utilizar únicamente métricas requeridas para el análisis. |
| **Criterios de aceptación** | Métricas de velocidad, pausas y errores calculadas correctamente. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis neuroconductual |
| **Duración estimada** | 3 días |

### Ficha 62 — 4.3.4 INTERACCIÓN clics, navegación y comportamiento digital

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.3.4 |
| **Denominación** | INTERACCIÓN clics, navegación y comportamiento digital |
| **Descripción** | Implementar el análisis del patrón Interacción a partir de clics, navegación y comportamiento digital dentro de la plataforma. |
| **Requisitos para iniciar** | Eventos de interacción disponibles; sesión iniciada; mecanismos de trazabilidad configurados. |
| **Actividades** | Registrar eventos permitidos; analizar clics; analizar navegación; identificar patrones de comportamiento digital; generar indicadores; asociar resultados a la sesión. |
| **Consideraciones contractuales** | Debe recopilar únicamente eventos necesarios para el propósito definido y respetar las políticas de privacidad. |
| **Criterios de aceptación** | Indicadores de interacción generados correctamente y asociados a la sesión. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis neuroconductual |
| **Duración estimada** | 3 días |

### Ficha 63 — 4.3.5 RENDIMIENTO respuestas, errores, tiempo y progreso

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.3.5 |
| **Denominación** | RENDIMIENTO respuestas, errores, tiempo y progreso |
| **Descripción** | Implementar el análisis del patrón Rendimiento considerando respuestas, errores, tiempo y progreso del estudiante. |
| **Requisitos para iniciar** | Módulos de actividades y progreso disponibles; métricas académicas definidas. |
| **Actividades** | Registrar respuestas; contabilizar errores; medir tiempo de respuesta; analizar progreso; generar indicadores; asociar resultados a la sesión. |
| **Consideraciones contractuales** | Los indicadores deben utilizar datos académicos disponibles y no deben interpretarse como diagnóstico clínico. |
| **Criterios de aceptación** | Indicadores de rendimiento calculados correctamente y reflejados en el seguimiento del estudiante. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en análisis neuroconductual |
| **Duración estimada** | 4 días |

## Grupo 4.4 — Privacidad y seguridad de IA

### Ficha 64 — 4.4.1 Procesamiento local

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.4.1 |
| **Denominación** | Procesamiento local |
| **Descripción** | Implementar procesamiento local de información sensible cuando sea técnicamente posible. |
| **Requisitos para iniciar** | Arquitectura de privacidad definida. |
| **Actividades** | Procesar datos en dispositivo; minimizar transferencias; eliminar temporales. |
| **Consideraciones contractuales** | Debe reducir exposición de datos sensibles. |
| **Criterios de aceptación** | Pruebas de procesamiento local satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en seguridad |
| **Duración estimada** | 3 días |

### Ficha 65 — 4.4.2 Protección de información

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.4.2 |
| **Denominación** | Protección de información |
| **Descripción** | Aplicar controles de privacidad, acceso y protección de datos. |
| **Requisitos para iniciar** | Políticas y requisitos de seguridad definidos. |
| **Actividades** | Aplicar permisos; validaciones; cifrado cuando corresponda; control de acceso. |
| **Consideraciones contractuales** | Debe cumplir las políticas de privacidad del proyecto. |
| **Criterios de aceptación** | Pruebas de protección satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en seguridad |
| **Duración estimada** | 3 días |

### Ficha 66 — 4.4.3 No almacenamiento de audio/video

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.4.3 |
| **Denominación** | No almacenamiento de audio/video |
| **Descripción** | Garantizar que el sistema no conserve audio/video bruto del análisis neuroconductual. |
| **Requisitos para iniciar** | Diseño de procesamiento definido. |
| **Actividades** | Configurar procesamiento temporal; eliminar buffers; verificar almacenamiento. |
| **Consideraciones contractuales** | No debe existir persistencia de audio/video bruto. |
| **Criterios de aceptación** | Evidencia de pruebas de no persistencia. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en seguridad |
| **Duración estimada** | 2 días |

### Ficha 67 — 4.4.4 Almacenamiento de metadatos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 4.4.4 |
| **Denominación** | Almacenamiento de metadatos |
| **Descripción** | Almacenar únicamente los indicadores necesarios derivados del análisis. |
| **Requisitos para iniciar** | Modelo de datos y política de privacidad disponibles. |
| **Actividades** | Definir metadatos; persistir indicadores; asociar sesión; controlar acceso. |
| **Consideraciones contractuales** | Solo deben almacenarse datos autorizados y necesarios. |
| **Criterios de aceptación** | Metadatos almacenados correctamente. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en seguridad |
| **Duración estimada** | 2 días |

---

# FASE 5 — MULTIPLATAFORMA

## Grupo 5.1 — PWA

### Ficha 68 — 5.1.1 Configuración del manifest

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.1.1 |
| **Denominación** | Configuración del manifest |
| **Descripción** | Configurar el archivo manifest para instalación y comportamiento de la PWA. |
| **Requisitos para iniciar** | Identidad visual y requisitos PWA disponibles. |
| **Actividades** | Configurar nombre; iconos; colores; display; orientación; rutas. |
| **Consideraciones contractuales** | Debe permitir instalación correcta. |
| **Criterios de aceptación** | PWA instalable y validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en PWA |
| **Duración estimada** | 1 día |

### Ficha 69 — 5.1.2 Service Worker

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.1.2 |
| **Denominación** | Service Worker |
| **Descripción** | Implementar el Service Worker para capacidades PWA y recursos controlados. |
| **Requisitos para iniciar** | Arquitectura frontend definida. |
| **Actividades** | Configurar registro; caché; actualización; manejo de recursos. |
| **Consideraciones contractuales** | Debe evitar servir versiones inconsistentes. |
| **Criterios de aceptación** | Service Worker operativo. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en PWA |
| **Duración estimada** | 2 días |

### Ficha 70 — 5.1.3 Instalación como PWA

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.1.3 |
| **Denominación** | Instalación como PWA |
| **Descripción** | Garantizar instalación y ejecución de NeuroLearn como aplicación web progresiva. |
| **Requisitos para iniciar** | Manifest y Service Worker funcionando. |
| **Actividades** | Validar instalación; acceso; actualización; desinstalación. |
| **Consideraciones contractuales** | Debe funcionar en navegadores objetivo. |
| **Criterios de aceptación** | Instalación validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en PWA |
| **Duración estimada** | 1 día |

### Ficha 71 — 5.1.4 Diseño responsive

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.1.4 |
| **Denominación** | Diseño responsive |
| **Descripción** | Implementar la adaptación visual definida para distintos dispositivos. |
| **Requisitos para iniciar** | Diseños responsive aprobados. |
| **Actividades** | Aplicar breakpoints; adaptar componentes; probar resoluciones. |
| **Consideraciones contractuales** | Debe conservar usabilidad en móvil, tablet y escritorio. |
| **Criterios de aceptación** | Pruebas responsive satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en PWA |
| **Duración estimada** | 4 días |

## Grupo 5.2 — Aplicación híbrida

### Ficha 72 — 5.2.1 Contenedor móvil

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.2.1 |
| **Denominación** | Contenedor móvil |
| **Descripción** | Integrar la PWA en un contenedor para ejecución híbrida. |
| **Requisitos para iniciar** | Versión PWA estable. |
| **Actividades** | Configurar proyecto móvil; cargar aplicación; configurar compilación. |
| **Consideraciones contractuales** | Debe ejecutar la aplicación sin alterar funcionalidades principales. |
| **Criterios de aceptación** | Aplicación híbrida ejecutable. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en híbrida |
| **Duración estimada** | 3 días |

### Ficha 73 — 5.2.2 Integración con dispositivos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.2.2 |
| **Denominación** | Integración con dispositivos |
| **Descripción** | Integrar capacidades nativas necesarias del dispositivo. |
| **Requisitos para iniciar** | Requisitos de cámara, micrófono y permisos disponibles. |
| **Actividades** | Configurar APIs/puentes; probar acceso; gestionar errores. |
| **Consideraciones contractuales** | Solo usar capacidades necesarias y autorizadas. |
| **Criterios de aceptación** | Integraciones probadas. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en híbrida |
| **Duración estimada** | 3 días |

### Ficha 74 — 5.2.3 Cámara y micrófono

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.2.3 |
| **Denominación** | Cámara y micrófono |
| **Descripción** | Habilitar acceso controlado a cámara y micrófono desde la aplicación híbrida. |
| **Requisitos para iniciar** | Permisos y módulo neuroconductual disponibles. |
| **Actividades** | Solicitar permisos; inicializar dispositivos; manejar rechazo; liberar recursos. |
| **Consideraciones contractuales** | No acceder sin consentimiento del usuario. |
| **Criterios de aceptación** | Pruebas en dispositivos objetivo satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en híbrida |
| **Duración estimada** | 3 días |

### Ficha 75 — 5.2.4 Permisos del dispositivo

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.2.4 |
| **Denominación** | Permisos del dispositivo |
| **Descripción** | Gestionar permisos necesarios para las capacidades móviles. |
| **Requisitos para iniciar** | Lista de permisos definida. |
| **Actividades** | Configurar permisos; mensajes de consentimiento; estados denegados; recuperación. |
| **Consideraciones contractuales** | El sistema debe funcionar razonablemente cuando un permiso sea rechazado. |
| **Criterios de aceptación** | Gestión de permisos validada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en híbrida |
| **Duración estimada** | 2 días |

## Grupo 5.3 — Servicios y API

### Ficha 76 — 5.3.1 API

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.3.1 |
| **Denominación** | API |
| **Descripción** | Implementar los endpoints necesarios para comunicación entre frontend y backend. |
| **Requisitos para iniciar** | Arquitectura backend y requisitos disponibles. |
| **Actividades** | Desarrollar endpoints; validaciones; respuestas; documentación. |
| **Consideraciones contractuales** | La API debe manejar errores y autenticación correctamente. |
| **Criterios de aceptación** | Endpoints probados. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en backend |
| **Duración estimada** | 5 días |

### Ficha 77 — 5.3.2 Servicios de autenticación

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.3.2 |
| **Denominación** | Servicios de autenticación |
| **Descripción** | Implementar servicios backend para autenticación y autorización. |
| **Requisitos para iniciar** | Modelo de usuarios y roles disponible. |
| **Actividades** | Tokens/sesiones; validación; permisos; recuperación. |
| **Consideraciones contractuales** | Debe impedir acceso no autorizado. |
| **Criterios de aceptación** | Servicios validados. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en backend |
| **Duración estimada** | 3 días |

### Ficha 78 — 5.3.3 Servicios académicos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.3.3 |
| **Denominación** | Servicios académicos |
| **Descripción** | Implementar servicios para usuarios, grupos, clases, habilidades y progreso. |
| **Requisitos para iniciar** | Modelo académico disponible. |
| **Actividades** | Crear servicios; consultas; operaciones; validaciones. |
| **Consideraciones contractuales** | Debe mantener integridad de datos. |
| **Criterios de aceptación** | Servicios académicos probados. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en backend |
| **Duración estimada** | 5 días |

### Ficha 79 — 5.3.4 Servicios de IA

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.3.4 |
| **Denominación** | Servicios de IA |
| **Descripción** | Implementar servicios de integración entre plataforma y componentes de IA. |
| **Requisitos para iniciar** | Arquitectura IA disponible. |
| **Actividades** | Crear endpoints; contexto; llamadas a modelo; manejo de errores. |
| **Consideraciones contractuales** | Debe controlar latencia, fallos y datos enviados. |
| **Criterios de aceptación** | Servicios IA probados. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en IA |
| **Duración estimada** | 5 días |

## Grupo 5.4 — Optimización

### Ficha 80 — 5.4.1 Optimización frontend

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.4.1 |
| **Denominación** | Optimización frontend |
| **Descripción** | Mejorar carga, renderizado y consumo de recursos del frontend. |
| **Requisitos para iniciar** | Aplicación funcional y métricas iniciales disponibles. |
| **Actividades** | Optimizar componentes; recursos; carga diferida; caché; imágenes. |
| **Consideraciones contractuales** | Debe conservar funcionalidad y diseño. |
| **Criterios de aceptación** | Pruebas de rendimiento mejoradas. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en rendimiento |
| **Duración estimada** | 3 días |

### Ficha 81 — 5.4.2 Optimización backend

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.4.2 |
| **Denominación** | Optimización backend |
| **Descripción** | Mejorar tiempos de procesamiento y consumo de recursos del backend. |
| **Requisitos para iniciar** | API funcional y métricas disponibles. |
| **Actividades** | Optimizar servicios; consultas; concurrencia; manejo de errores. |
| **Consideraciones contractuales** | Debe mantener estabilidad bajo carga prevista. |
| **Criterios de aceptación** | Pruebas de rendimiento satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en rendimiento |
| **Duración estimada** | 3 días |

### Ficha 82 — 5.4.3 Optimización de base de datos

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.4.3 |
| **Denominación** | Optimización de base de datos |
| **Descripción** | Optimizar consultas, índices y estructura para rendimiento. |
| **Requisitos para iniciar** | Base de datos funcional. |
| **Actividades** | Analizar consultas; crear índices; optimizar relaciones; revisar tiempos. |
| **Consideraciones contractuales** | No debe degradar integridad de datos. |
| **Criterios de aceptación** | Consultas críticas optimizadas. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en rendimiento |
| **Duración estimada** | 2 días |

### Ficha 83 — 5.4.4 Optimización de respuesta de IA

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 5.4.4 |
| **Denominación** | Optimización de respuesta de IA |
| **Descripción** | Reducir la latencia de las respuestas del sistema de IA. |
| **Requisitos para iniciar** | Integración IA funcional y métrica de latencia definida. |
| **Actividades** | Optimizar prompts; contexto; proveedor; caché cuando aplique; fallback. |
| **Consideraciones contractuales** | Objetivo de latencia según RNF del proyecto. |
| **Criterios de aceptación** | Pruebas de latencia satisfactorias. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en rendimiento |
| **Duración estimada** | 3 días |

---

# FASE 6 — GESTIÓN DE CALIDAD

## Grupo 6.1 — Pruebas funcionales

### Ficha 84 — 6.1.1 Pruebas de autenticación

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.1.1 |
| **Denominación** | Pruebas de autenticación |
| **Descripción** | Verificar registro, inicio, cierre y recuperación de acceso. |
| **Requisitos para iniciar** | Módulo de autenticación implementado. |
| **Actividades** | Diseñar casos; ejecutar pruebas; registrar resultados; corregir defectos. |
| **Consideraciones contractuales** | Todos los flujos críticos deben funcionar. |
| **Criterios de aceptación** | Casos aprobados sin defectos críticos. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en QA |
| **Duración estimada** | 2 días |

### Ficha 85 — 6.1.2 Pruebas de integración

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.1.2 |
| **Denominación** | Pruebas de integración |
| **Descripción** | Verificar interacción correcta entre módulos y servicios. |
| **Requisitos para iniciar** | Módulos principales disponibles. |
| **Actividades** | Integrar escenarios; ejecutar pruebas; registrar errores; repetir validación. |
| **Consideraciones contractuales** | No deben existir fallos críticos de integración. |
| **Criterios de aceptación** | Informe de integración aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en QA |
| **Duración estimada** | 3 días |

### Ficha 86 — 6.1.3 Pruebas de IA

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.1.3 |
| **Denominación** | Pruebas de IA |
| **Descripción** | Evaluar respuestas, RAG, personalización y análisis neuroconductual. |
| **Requisitos para iniciar** | Componentes IA implementados. |
| **Actividades** | Definir casos; ejecutar pruebas; medir resultados; documentar errores. |
| **Consideraciones contractuales** | Los criterios de calidad definidos deben cumplirse. |
| **Criterios de aceptación** | Informe de pruebas IA aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en QA |
| **Duración estimada** | 4 días |

### Ficha 87 — 6.1.4 Pruebas de usabilidad

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.1.4 |
| **Denominación** | Pruebas de usabilidad |
| **Descripción** | Evaluar facilidad de uso y comprensión de la interfaz. |
| **Requisitos para iniciar** | Versión candidata disponible. |
| **Actividades** | Preparar escenarios; observar usuarios; registrar hallazgos; corregir problemas. |
| **Consideraciones contractuales** | Debe cumplir criterios de usabilidad definidos. |
| **Criterios de aceptación** | Informe de usabilidad y correcciones. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en QA |
| **Duración estimada** | 3 días |

## Grupo 6.2 — Pruebas no funcionales

### Ficha 88 — 6.2.1 Pruebas de seguridad

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.2.1 |
| **Denominación** | Pruebas de seguridad |
| **Descripción** | Verificar autenticación, autorización, exposición de datos y controles básicos. |
| **Requisitos para iniciar** | Aplicación candidata disponible. |
| **Actividades** | Ejecutar pruebas; revisar permisos; validar entradas; analizar exposición. |
| **Consideraciones contractuales** | No deben existir vulnerabilidades críticas conocidas sin tratar. |
| **Criterios de aceptación** | Informe de seguridad y correcciones. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en QA |
| **Duración estimada** | 3 días |

### Ficha 89 — 6.2.2 Pruebas de rendimiento

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.2.2 |
| **Denominación** | Pruebas de rendimiento |
| **Descripción** | Evaluar tiempos de respuesta y comportamiento bajo carga prevista. |
| **Requisitos para iniciar** | RNF de rendimiento definidos. |
| **Actividades** | Medir tiempos; ejecutar carga; identificar cuellos de botella; optimizar. |
| **Consideraciones contractuales** | Debe cumplir los objetivos de rendimiento definidos. |
| **Criterios de aceptación** | Informe de rendimiento aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en QA |
| **Duración estimada** | 3 días |

### Ficha 90 — 6.2.3 Pruebas de compatibilidad

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.2.3 |
| **Denominación** | Pruebas de compatibilidad |
| **Descripción** | Verificar funcionamiento en navegadores y dispositivos objetivo. |
| **Requisitos para iniciar** | PWA y aplicación híbrida disponibles. |
| **Actividades** | Probar resoluciones; navegadores; dispositivos; permisos. |
| **Consideraciones contractuales** | No debe haber defectos críticos en plataformas objetivo. |
| **Criterios de aceptación** | Matriz de compatibilidad aprobada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en QA |
| **Duración estimada** | 3 días |

### Ficha 91 — 6.2.4 Corrección de errores

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.2.4 |
| **Denominación** | Corrección de errores |
| **Descripción** | Resolver defectos encontrados durante pruebas. |
| **Requisitos para iniciar** | Informes de QA disponibles. |
| **Actividades** | Priorizar defectos; corregir; volver a probar; cerrar incidencias. |
| **Consideraciones contractuales** | Los defectos críticos deben estar cerrados antes de entrega. |
| **Criterios de aceptación** | Registro de defectos actualizado y aprobado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en QA |
| **Duración estimada** | 5 días |

## Grupo 6.3 — Despliegue

### Ficha 92 — 6.3.1 Configuración de infraestructura

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.3.1 |
| **Denominación** | Configuración de infraestructura |
| **Descripción** | Preparar servicios necesarios para ejecutar NeuroLearn. |
| **Requisitos para iniciar** | Arquitectura y requisitos de infraestructura disponibles. |
| **Actividades** | Configurar servicios; variables; recursos; monitoreo básico. |
| **Consideraciones contractuales** | Debe existir un entorno estable para despliegue. |
| **Criterios de aceptación** | Infraestructura operativa. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en despliegue |
| **Duración estimada** | 2 días |

### Ficha 93 — 6.3.2 Despliegue frontend

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.3.2 |
| **Denominación** | Despliegue frontend |
| **Descripción** | Publicar la aplicación frontend/PWA en el entorno objetivo. |
| **Requisitos para iniciar** | Build estable y pruebas aprobadas. |
| **Actividades** | Generar build; configurar hosting; variables; validar acceso. |
| **Consideraciones contractuales** | Debe estar disponible mediante HTTPS. |
| **Criterios de aceptación** | Frontend desplegado y accesible. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en despliegue |
| **Duración estimada** | 1 día |

### Ficha 94 — 6.3.3 Despliegue backend

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.3.3 |
| **Denominación** | Despliegue backend |
| **Descripción** | Publicar API y servicios backend en el entorno objetivo. |
| **Requisitos para iniciar** | Backend probado y configuración disponible. |
| **Actividades** | Generar despliegue; configurar variables; conectar BD; validar endpoints. |
| **Consideraciones contractuales** | Los servicios deben responder correctamente en producción. |
| **Criterios de aceptación** | Backend desplegado y probado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en despliegue |
| **Duración estimada** | 2 días |

### Ficha 95 — 6.3.4 Configuración en Vercel

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.3.4 |
| **Denominación** | Configuración en Vercel |
| **Descripción** | Configurar dominio y comunicación segura. |
| **Requisitos para iniciar** | Dominio y certificados disponibles. |
| **Actividades** | Configuraciones; redirecciones. |
| **Consideraciones contractuales** | Todo acceso público debe usar comunicación segura. |
| **Criterios de aceptación** | Dominio operativo en Vercel. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en despliegue |
| **Duración estimada** | 1 día |

## Grupo 6.4 — Entrega

### Ficha 96 — 6.4.1 Documentación técnica y manuales

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.4.1 |
| **Denominación** | Documentación técnica y manuales |
| **Descripción** | Documentar arquitectura, instalación, configuración y operación técnica. |
| **Requisitos para iniciar** | Versión final y arquitectura disponibles. |
| **Actividades** | Documentar componentes; instalación; configuración; API; mantenimiento. |
| **Consideraciones contractuales** | Debe permitir que otro desarrollador comprenda el sistema. |
| **Criterios de aceptación** | Documento técnico entregado. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en entrega |
| **Duración estimada** | 3 días |

### Ficha 97 — 6.4.2 Entrega de la versión final

| Campo | Detalle |
|-------|---------|
| **Código EDT** | 6.4.2 |
| **Denominación** | Entrega de la versión final |
| **Descripción** | Consolidar y entregar la versión final funcional de NeuroLearn. |
| **Requisitos para iniciar** | Pruebas, documentación y despliegue completados. |
| **Actividades** | Verificar versión; consolidar código; entregar documentación; realizar demostración final. |
| **Consideraciones contractuales** | La entrega debe cumplir alcance y criterios de aceptación. |
| **Criterios de aceptación** | Acta/registro de entrega y versión final aprobada. |
| **Responsable** | Desarrolladores |
| **Aprobador** | Asesor |
| **Costo estimado** | Incluido en entrega |
| **Duración estimada** | 1 día |

---

## 5. Resumen de duraciones por fase

> Los siguientes totales estiman la duración de paquetes (días hábiles), sin considerar dependencias ni
> ejecución en paralelo. Son una referencia orientativa para el control del cronograma.

| Fase | Total estimado (días) |
|------|----------------------|
| 1. Gestión del proyecto | 19 |
| 2. Diseño | 36 |
| 3. Implementación | 63 |
| 4. IA | 60 |
| 5. Multiplataforma | 55 |
| 6. Gestión de calidad | 42 |
| **Total orientativo** | **275** |

> Nota: el paquete 1.1.4 "Seguimiento y control" aplica durante todo el proyecto y no se acumula en el total.

---

## 6. Notas finales

- **Diccionario vivo:** este documento debe actualizarse cuando la EDT cambie mediante el proceso de control de cambios.
- **Licencias:** NeuroLearn contempla los planes **Basic**, **Premium** y **Pro**, controlados en las fases 1.2.4, 2.4.3, 3.4 y 4.4.
- **Habilidades académicas:** las cinco habilidades son **Pensamiento lógico-matemático**, **Lectura crítica**,
  **Inglés comunicativo**, **Competencias ciudadanas** y **Pensamiento científico**.
- **Roles:** **Súper Profesor** (institucional), **Profesor** (docente), **Estudiante** y **Admin** (administrativo).