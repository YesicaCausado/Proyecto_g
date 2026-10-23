/**
 * Política de Privacidad y Tratamiento de Datos Personales (ruta pública
 * PRIVACY_POLICY_PATH, sin iniciar sesión). Es la única página de la política:
 * la enlazan la landing, la interfaz del estudiante y el consentimiento de
 * cámara/micrófono.
 *
 * El texto describe lo que hace el código actual (verificado en backend y
 * frontend). Lo que aún no está definido —responsable, contacto, plazos de
 * conservación, contratos con proveedores— se marca como «Pendiente» en lugar
 * de inventarse. Si cambia el tratamiento, actualizar el texto y LAST_UPDATED.
 */
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, AlertTriangle, ChevronDown } from 'lucide-react';

const LAST_UPDATED = '23 de octubre de 2026';

const SECTIONS = [
  { id: 'alcance', title: 'Introducción y alcance' },
  { id: 'responsable', title: 'Responsable del tratamiento' },
  { id: 'datos', title: 'Datos personales que pueden tratarse' },
  { id: 'finalidades', title: 'Finalidades del tratamiento' },
  { id: 'ia', title: 'Uso de inteligencia artificial' },
  { id: 'patrones', title: 'Patrones neurodigitales y privacidad' },
  { id: 'menores', title: 'Datos de niñas, niños y adolescentes' },
  { id: 'sensibles', title: 'Datos sensibles y biométricos' },
  { id: 'autorizaciones', title: 'Bases jurídicas y autorizaciones' },
  { id: 'acceso', title: 'Comunicación y acceso a los datos' },
  { id: 'seguridad', title: 'Seguridad de la información' },
  { id: 'conservacion', title: 'Conservación y eliminación' },
  { id: 'derechos', title: 'Derechos de los titulares' },
  { id: 'almacenamiento', title: 'Cookies y almacenamiento local' },
  { id: 'servicios', title: 'Servicios externos e integraciones' },
  { id: 'cambios', title: 'Cambios en la política' },
  { id: 'contacto', title: 'Contacto y solicitudes' },
] as const;

// ── Piezas de presentación ──────────────────────────────────────────────────

function Pending({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 flex gap-2 rounded-md border border-[#F1D9A6] bg-[#FCF6E5] px-3 py-2.5 text-[13px] text-[#7A5200]">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div><strong className="font-semibold">Pendiente:</strong> {children}</div>
    </div>
  );
}

function Section({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20 border-t border-[#E9E9E7] pt-8 first:border-t-0 first:pt-0">
      <h2 id={`${id}-t`} tabIndex={-1} className="focus:outline-none text-lg sm:text-xl font-semibold text-[#191919] mb-3">
        <span className="text-[#9B9A97] font-medium mr-2">{n}.</span>{title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-[#37352F]">{children}</div>
    </section>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-[15px] font-semibold text-[#191919]">{children}</h3>;
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-[#9B9A97]">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#E9E9E7]">
      <table className="w-full min-w-[560px] text-left text-[13.5px]">
        <thead className="bg-[#F7F6F3] text-[#787774]">
          <tr>{head.map(h => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[#F1F1EF] align-top">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const prev = document.title;
    document.title = 'Política de Privacidad — NeuroLearn IA';
    window.scrollTo(0, 0);
    return () => { document.title = prev; };
  }, []);

  // Con HashRouter, un href="#seccion" cambiaría de ruta: el índice desplaza
  // la página sin tocar la URL.
  const goTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.querySelector('h2')?.focus({ preventScroll: true });
  };

  // «Volver» regresa a la pantalla anterior; si se abrió la política
  // directamente (sin historial dentro de la app), lleva a la landing.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/');
  };

  const toc = (
    <ol className="space-y-1 text-[13.5px]">
      {SECTIONS.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} onClick={goTo(s.id)}
            className="flex gap-2 rounded px-2 py-1 text-[#37352F] hover:bg-[#F1F1EF] hover:text-[#0B6E99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6FDB]">
            <span className="w-5 flex-shrink-0 text-right text-[#9B9A97]">{i + 1}.</span>
            <span>{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  // Número y título de cada sección según su lugar en el índice.
  const sec = (id: (typeof SECTIONS)[number]['id']) => {
    const i = SECTIONS.findIndex(s => s.id === id);
    return { n: i + 1, id, title: SECTIONS[i].title };
  };

  return (
    <div className="min-h-[100dvh] bg-white text-[#37352F]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="sticky top-0 z-20 border-b border-[#E9E9E7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <button onClick={goBack}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[#787774] hover:bg-[#F7F6F3] hover:text-[#37352F]">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <Link to="/" className="flex items-center gap-2" aria-label="NeuroLearn IA, ir al inicio">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#0B6E99] to-[#2E6FDB] text-sm font-bold text-white" aria-hidden="true">N</span>
            <span className="text-[15px] font-semibold text-[#191919]">NeuroLearn IA</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label="Índice de la política" className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#9B9A97]">Contenido</p>
            {toc}
          </nav>
        </aside>

        <main className="min-w-0 max-w-3xl">
          <div className="mb-6 flex items-center gap-2 text-[#0B6E99]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">Protección de datos personales</span>
          </div>
          <h1 className="text-2xl font-bold leading-tight text-[#191919] sm:text-3xl">
            Política de Privacidad y Tratamiento de Datos Personales
          </h1>
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm text-[#787774] sm:grid-cols-2">
            <div><dt className="inline font-medium text-[#37352F]">Última actualización: </dt><dd className="inline">{LAST_UPDATED}</dd></div>
            <div><dt className="inline font-medium text-[#37352F]">Entrada en vigor: </dt><dd className="inline">pendiente de definir por el responsable</dd></div>
          </dl>

          <div className="mt-6 rounded-md border border-[#E9E9E7] bg-[#F7F6F3] p-4 text-sm leading-relaxed">
            <p className="font-semibold text-[#191919]">Sobre este documento</p>
            <p className="mt-1">
              Describe cómo funciona hoy NeuroLearn IA con tus datos, según lo que hace la plataforma.
              Algunos datos legales y procedimientos aún no se han definido; aparecen marcados como
              <strong> «Pendiente»</strong> y se completarán antes de presentar esta política como definitiva.
              Este texto no es una certificación de cumplimiento legal.
            </p>
          </div>

          <details className="mt-6 rounded-md border border-[#E9E9E7] lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-[#191919]">
              Contenido <ChevronDown className="h-4 w-4 text-[#9B9A97]" aria-hidden="true" />
            </summary>
            <nav aria-label="Índice de la política" className="border-t border-[#E9E9E7] px-2 py-3">{toc}</nav>
          </details>

          <div className="mt-10 space-y-10">
            <Section {...sec('alcance')}>
              <p>
                Esta política explica qué datos personales trata NeuroLearn IA, para qué, con quién se
                comparten, cómo se protegen, cuánto tiempo se conservan y cómo puedes ejercer tus derechos.
              </p>
              <p>
                Se aplica a todas las personas que usan la plataforma: estudiantes, profesores, Súper
                Profesores (coordinadores de cada institución) y administradores, así como a las madres,
                padres o acudientes cuyos datos se registran para autorizar funciones a estudiantes menores de edad.
              </p>
              <p>
                Cubre la aplicación web de NeuroLearn IA (incluida su versión instalable) y sus funciones:
                tutor con inteligencia artificial (NeuroChat), NeuroBots, quizzes y evaluaciones, grupos,
                tablero, mensajería, calendario, materiales de apoyo, reportes y NeuroAlertas, y las
                integraciones con Google Drive y Google Calendar.
              </p>
              <p>
                Se redacta conforme al artículo 15 de la Constitución Política, la Ley 1581 de 2012, el
                Decreto 1074 de 2015 (que compila el Decreto 1377 de 2013), la Ley 1098 de 2006 (Código de
                la Infancia y la Adolescencia) y las orientaciones de la Superintendencia de Industria y
                Comercio (SIC).
              </p>
            </Section>

            <Section {...sec('responsable')}>
              <p>
                El responsable del tratamiento es quien decide sobre la finalidad y el uso de los datos.
              </p>
              <Pending>
                nombre o razón social, NIT, domicilio, correo electrónico y teléfono del responsable del
                tratamiento de NeuroLearn IA. Estos datos no se publican hasta que estén verificados.
              </Pending>
              <p>
                NeuroLearn IA se ofrece a instituciones educativas, que crean las cuentas de su comunidad
                (profesores y estudiantes). Según los acuerdos con cada institución, ella puede actuar como
                responsable y NeuroLearn IA como encargado del tratamiento, o ambos como responsables.
              </p>
              <Pending>definir por contrato el papel de cada institución y de NeuroLearn IA.</Pending>
            </Section>

            <Section {...sec('datos')}>
              <p>Según las funciones que se usen, la plataforma puede tratar estas categorías:</p>
              <Table
                head={['Categoría', 'Qué incluye', 'Obligatorio u opcional']}
                rows={[
                  ['Identificación y contacto', 'Nombre completo, tipo y número de documento (también es el nombre de usuario), correo electrónico, foto de perfil.', 'Nombre y documento: obligatorios. Correo: obligatorio para profesores, opcional para estudiantes (si falta se usa un identificador interno que no recibe correos). Foto: opcional.'],
                  ['Cuenta, rol e institución', 'Rol, institución, grado, área (profesores), fecha de nacimiento, fecha del último ingreso. La contraseña se guarda solo cifrada con un algoritmo irreversible (bcrypt).', 'Rol e institución: obligatorios. Grado y fecha de nacimiento: opcionales.'],
                  ['Acudiente', 'Nombre de la madre, el padre o el acudiente, y fecha y autor del registro de su autorización.', 'Solo si la institución lo registra.'],
                  ['Información académica', 'Grupos e inscripciones, respuestas y resultados de quizzes y evaluaciones, calificaciones y retroalimentación, progreso y dominio por competencia, resultados en NeuroBots.', 'Se genera al usar la plataforma.'],
                  ['Conversaciones con el tutor', 'Texto de los mensajes con NeuroChat y los NeuroBots e historial de conversaciones.', 'Se genera al usar el chat.'],
                  ['Patrones neurodigitales', 'Indicadores numéricos de rostro, voz, teclado, interacción y rendimiento (sección 6), y estimaciones derivadas como el nivel de riesgo y las NeuroAlertas.', 'Rostro y voz: opcionales y con consentimiento. Teclado, interacción y rendimiento: durante el uso del chat.'],
                  ['Comunicaciones y materiales', 'Mensajes directos, publicaciones y comentarios del tablero, notificaciones, comunicados de la institución y archivos que suben los profesores.', 'Según el uso.'],
                  ['Integraciones', 'Credenciales de acceso a Google Drive o Calendar del profesor que las conecte (guardadas cifradas) y eventos creados.', 'Opcional.'],
                  ['Registros técnicos y de seguridad', 'Auditoría de acciones administrativas (acción, quién, sobre quién, fecha y dirección IP), registro de consentimientos (versión, fecha y hora, IP y navegador) y solicitudes de restablecimiento de contraseña.', 'Necesarios para la seguridad.'],
                ]}
              />
              <p>
                No todos estos datos existen para cada persona: dependen del rol y de las funciones que use.
              </p>
            </Section>

            <Section {...sec('finalidades')}>
              <H3>Necesarias para prestar el servicio</H3>
              <List items={[
                'Crear y administrar cuentas, autenticar a los usuarios y aplicar los permisos de cada rol.',
                'Organizar la gestión académica: grupos, inscripciones, materiales, tablero, calendario y mensajería.',
                'Prestar el tutor de IA y los NeuroBots, y adaptar la dificultad y el estilo de las explicaciones.',
                'Calificar quizzes y evaluaciones, registrar el progreso por competencias y mostrarlo al estudiante y a sus profesores.',
                'Generar reportes y NeuroAlertas para que profesores y la institución acompañen a los estudiantes.',
                'Enviar correos necesarios: credenciales de acceso y restablecimiento de contraseña.',
                'Mantener la seguridad, investigar incidentes y conservar la trazabilidad de las acciones administrativas.',
              ]} />
              <H3>Requieren una autorización adicional</H3>
              <List items={[
                'Uso de la cámara (detección facial) y del micrófono (análisis de voz y modo de voz): solo con consentimiento expreso del estudiante y, si es menor de edad, con la autorización de su acudiente registrada por la institución (secciones 6 a 9).',
              ]} />
              <p>
                En la plataforma no existen funciones de publicidad, venta de datos ni seguimiento con fines comerciales.
              </p>
            </Section>

            <Section {...sec('ia')}>
              <H3>Funciones que usan inteligencia artificial</H3>
              <List items={[
                <><strong>Tutor (NeuroChat) y NeuroBots.</strong> Para responder se envía a un proveedor de modelos de lenguaje: tu mensaje, los últimos mensajes de la conversación, el tema, instrucciones pedagógicas con un resumen de tu estado de aprendizaje estimado y, en los NeuroBots, fragmentos de los documentos que cargó el profesor. Tu nombre y tu documento no se incluyen en esas instrucciones, pero sí cualquier dato que escribas en el mensaje: evita escribir información personal en el chat.</>,
                <><strong>Calificación de respuestas en el chat.</strong> El modelo puede valorar si una respuesta es correcta; ese resultado alimenta tu progreso.</>,
                <><strong>IA para profesores.</strong> Genera material didáctico (por ejemplo, planes de clase o preguntas) a partir de lo que escribe el profesor.</>,
                <><strong>Voz del tutor.</strong> El texto de la respuesta del tutor puede convertirse en audio con un servicio de síntesis de voz.</>,
                <><strong>Motor de adaptación propio.</strong> En los servidores de NeuroLearn IA se combinan tus resultados y, si están activos, tus patrones neurodigitales para estimar tu estado de aprendizaje y ajustar las explicaciones.</>,
              ]} />
              <H3>Resultados observados y estimaciones</H3>
              <p>
                Son <strong>observaciones</strong> tus respuestas, aciertos, errores, tiempos y calificaciones.
                Son <strong>estimaciones</strong> la atención, el estado emocional, el estado cognitivo, el
                riesgo y las NeuroAlertas: la plataforma las presenta como estimaciones experimentales, solo
                las calcula cuando hay datos suficientes y pueden equivocarse.
              </p>
              <p>
                NeuroLearn IA <strong>no realiza diagnósticos médicos, psicológicos ni neuropsicológicos</strong>.
                Las estimaciones no deben usarse por sí solas para calificar, sancionar ni tomar decisiones
                sobre un estudiante: son un apoyo para el acompañamiento pedagógico.
              </p>
            </Section>

            <Section {...sec('patrones')}>
              <p>NeuroLearn IA trabaja con cinco patrones. Así funcionan hoy:</p>
              <Table
                head={['Patrón', 'Qué se mide', 'Cuándo está activo', 'Dónde se procesa y qué se guarda']}
                rows={[
                  ['Facial', 'Emoción estimada, valencia, activación, atención, parpadeo, ceño, sonrisa y dirección de la mirada.', 'Solo en el chat, cuando el estudiante enciende la cámara después de aceptar el consentimiento.', 'La imagen se analiza en tu dispositivo, dentro del navegador. Solo se envían y guardan indicadores numéricos; la plataforma no envía video ni fotos.'],
                  ['Voz', 'Tono (centroide espectral), volumen, ritmo, pausas, muletillas, temblor y energía.', 'Solo en el chat, con el micrófono encendido y el consentimiento aceptado.', 'El sonido se analiza en tu dispositivo. Solo se envían y guardan indicadores numéricos; la plataforma no recibe audio.'],
                  ['Teclado', 'Velocidad de escritura, pausas y caracteres borrados.', 'Mientras se escribe en el chat.', 'Se envían tiempos y conteos con el mensaje; nunca lo que se teclea y se borra.'],
                  ['Interacción', 'Pestaña oculta o visible, foco, clics en el chat y uso de sugerencias.', 'Solo dentro del chat.', 'Se guarda como observación; no interviene en las estimaciones.'],
                  ['Rendimiento', 'Respuestas, aciertos, errores, tiempos y progreso.', 'En el chat, los quizzes y las evaluaciones.', 'Se calcula y guarda en el servidor.'],
                ]}
              />
              <H3>Lo que conviene saber</H3>
              <List items={[
                'Los indicadores quedan asociados a tu cuenta y a tu historial de aprendizaje. Aunque sean números, siguen siendo datos personales: no son anónimos.',
                'El servidor descarta los indicadores de cámara o micrófono si no hay un consentimiento vigente, y descarta cualquier campo no previsto (por ejemplo, una imagen) aunque se envíe.',
                <>En el <strong>modo de voz</strong> (dictar mensajes), el reconocimiento lo hace el propio navegador. En navegadores como Chrome o Edge ese servicio puede enviar el audio a Google o Microsoft; a NeuroLearn IA solo llega el texto. Si no quieres que esto ocurra, escribe en lugar de dictar.</>,
                'Las mediciones dependen de la luz, la cámara, el micrófono, el ruido y el dispositivo. Los indicadores faciales y de voz no están validados frente a un criterio clínico o externo: son aproximaciones con fines educativos.',
                'Si apagas la cámara o el micrófono, o retiras el consentimiento, el tutor sigue funcionando igual.',
              ]} />
              <Pending>
                evaluar si los patrones de teclado e interacción, activos durante el uso del chat, requieren
                una autorización o un aviso específico adicional.
              </Pending>
            </Section>

            <Section {...sec('menores')}>
              <p>
                NeuroLearn IA está dirigido principalmente a estudiantes de educación secundaria, muchos de
                ellos menores de edad. Sus datos se tratan respetando su interés superior y sus derechos
                fundamentales (Ley 1098 de 2006 y artículo 7 de la Ley 1581 de 2012), teniendo en cuenta su
                opinión según su madurez, y con la autorización de su representante legal cuando la ley la exija
                (Decreto 1074 de 2015).
              </p>
              <H3>Lo que hace hoy la plataforma</H3>
              <List items={[
                'Un estudiante menor de 18 años, o sin fecha de nacimiento registrada, no puede activar la cámara ni el micrófono hasta que la institución registre la autorización firmada de su madre, padre o acudiente.',
                'Si la institución retira esa autorización, los datos de cámara y micrófono dejan de tenerse en cuenta aunque el estudiante haya aceptado antes.',
                'El estudiante puede solicitar desde el chat que su institución gestione la autorización.',
              ]} />
              <p>
                La autorización de la institución educativa no reemplaza por sí sola las autorizaciones que
                deban dar los titulares o sus representantes.
              </p>
              <Pending>
                establecer el procedimiento para obtener, archivar y verificar la autorización de los
                representantes para el tratamiento general de datos de los menores (cuenta, chat, información
                académica), no solo para cámara y micrófono. El formato físico de la autorización y su archivo
                dependen hoy de cada institución.
              </Pending>
            </Section>

            <Section {...sec('sensibles')}>
              <p>
                La Ley 1581 de 2012 considera sensibles, entre otros, los datos biométricos y los relativos
                a la salud, y los de menores de edad gozan de protección reforzada.
              </p>
              <p>
                La plataforma no crea una huella o plantilla biométrica para identificar a las personas: el
                análisis facial busca indicadores de atención y emoción, no reconocer quién eres. Aun así,
                esas estimaciones pueden revelar aspectos íntimos de una persona, por lo que NeuroLearn IA
                las trata con las garantías propias de los datos sensibles:
              </p>
              <List items={[
                'son facultativas: no es obligatorio activar la cámara ni el micrófono para usar la plataforma;',
                'requieren consentimiento expreso y previo, con un texto que explica qué se procesa y qué no se guarda;',
                'se pueden retirar en cualquier momento;',
                'en menores de edad, exigen además la autorización del acudiente.',
              ]} />
              <Pending>confirmar con asesoría jurídica la calificación de estos datos y las salvaguardas exigibles.</Pending>
            </Section>

            <Section {...sec('autorizaciones')}>
              <H3>Mecanismos que existen</H3>
              <List items={[
                <><strong>Consentimiento de cámara y micrófono.</strong> Se pide dentro del chat antes de encender el dispositivo. Exige marcar una casilla y aceptar; se registran el usuario, el tipo, la versión del texto, la fecha y hora, la dirección IP y el navegador. Se puede retirar en <em>Configuración → Privacidad</em>; el retiro queda registrado y el historial se conserva para poder demostrar qué se aceptó.</>,
                <><strong>Autorización del acudiente.</strong> La institución la recoge en físico y el Súper Profesor la registra en la plataforma, que guarda la fecha y quién la registró, y deja una entrada en la auditoría.</>,
              ]} />
              <H3>Otras bases</H3>
              <p>
                Algunos tratamientos pueden apoyarse en la prestación del servicio educativo contratado por la
                institución o en obligaciones legales de conservación de registros académicos.
              </p>
              <Pending>
                (1) una autorización general de tratamiento de datos al crear la cuenta o en el primer ingreso,
                hoy inexistente en la plataforma; (2) un aviso de privacidad visible en el inicio de sesión;
                (3) determinar las bases jurídicas aplicables a cada tratamiento con asesoría jurídica.
              </Pending>
            </Section>

            <Section {...sec('acceso')}>
              <p>Cada persona solo ve lo que su rol permite, y nunca datos de otra institución.</p>
              <Table
                head={['Rol', 'A qué información accede']}
                rows={[
                  ['Estudiante', 'Sus propios datos, conversaciones, resultados, progreso y estimaciones; los materiales y publicaciones de sus grupos; sus mensajes.'],
                  ['Profesor', 'De los estudiantes de sus grupos: nombre, inscripción, resultados de quizzes, evaluaciones y NeuroBots que les asignó, progreso, nivel de riesgo y NeuroAlertas; sus mensajes con ellos. No accede al texto de las conversaciones con el tutor ni a los indicadores faciales o de voz de cada mensaje (solo ve cuántos mensajes hay en sus NeuroBots).'],
                  ['Súper Profesor', 'Usuarios de su institución (crear, editar, desactivar), registro de la autorización del acudiente, reportes institucionales y NeuroAlertas, auditoría de su institución y comunicados.'],
                  ['Administrador', 'Gestión de instituciones y usuarios de toda la plataforma, auditoría global y eliminación definitiva de cuentas.'],
                ]}
              />
              <p>
                Los permisos se comprueban en el servidor en cada solicitud, no solo en la pantalla. Los
                proveedores que procesan datos por cuenta de NeuroLearn IA se describen en la sección 15.
              </p>
            </Section>

            <Section {...sec('seguridad')}>
              <H3>Medidas implementadas</H3>
              <List items={[
                'Contraseñas almacenadas solo como hash bcrypt; las contraseñas temporales se muestran una vez y deben cambiarse en el primer ingreso.',
                'Sesiones con token firmado que vence a las 24 horas y posibilidad de cerrar todas las sesiones de una cuenta.',
                'Control de acceso por rol y aislamiento por institución, verificados en el servidor; una institución desactivada no puede ingresar.',
                'Archivos privados (materiales, adjuntos) entregados solo a usuarios con sesión y permiso; no tienen enlaces públicos.',
                'Credenciales de Google de los profesores cifradas en la base de datos; nunca se envían al navegador.',
                'Registro de auditoría de las acciones administrativas y de los consentimientos.',
              ]} />
              <p>
                La configuración de despliegue documentada usa HTTPS y conexión cifrada (SSL) con la base de datos.
              </p>
              <Pending>
                confirmar en producción el cifrado en tránsito y en reposo del proveedor de base de datos, las
                copias de seguridad y su conservación, y adoptar un procedimiento de respuesta a incidentes y
                de auditorías periódicas. Hasta entonces no se presentan como garantías.
              </Pending>
            </Section>

            <Section {...sec('conservacion')}>
              <p>Hoy la plataforma funciona así:</p>
              <List items={[
                <><strong>Desactivar un profesor o estudiante</strong> (acción «eliminar» del Súper Profesor): la cuenta ya no puede ingresar, pero su información se conserva.</>,
                <><strong>Retirar a un estudiante de un grupo:</strong> la inscripción queda inactiva y el historial se conserva.</>,
                <><strong>Mensajes:</strong> «eliminar para mí» solo lo oculta para quien lo elimina; «eliminar para todos» borra el contenido y deja la marca «Se eliminó este mensaje».</>,
                <><strong>Retirar el consentimiento</strong> de cámara o micrófono: no se recogen más indicadores; los enviados antes permanecen en el historial.</>,
                <><strong>Institución desactivada:</strong> sus usuarios no pueden ingresar y los datos se conservan.</>,
                <><strong>Eliminación definitiva</strong> por el Administrador: borra la cuenta y la mayor parte de la información asociada (conversaciones, eventos cognitivos, quizzes, mensajes, grupos e integraciones); la auditoría se conserva sin el vínculo al usuario.</>,
                'No existen eliminación ni anonimización automáticas.',
              ]} />
              <Pending>
                definir plazos de conservación por categoría y los criterios para eliminar o anonimizar;
                verificar que la eliminación definitiva cubra también consentimientos, evaluaciones y
                notificaciones; definir qué ocurre con las copias de seguridad y al terminar la relación con
                una institución. Algunos datos podrían tener que conservarse por obligaciones legales.
              </Pending>
            </Section>

            <Section {...sec('derechos')}>
              <p>Como titular (o a través de tu representante, si eres menor de edad) tienes derecho a:</p>
              <List items={[
                'conocer, actualizar y rectificar tus datos personales;',
                'solicitar prueba de la autorización otorgada, salvo cuando la ley no la exija;',
                'ser informado del uso que se ha dado a tus datos;',
                'presentar consultas y reclamos, y quejas ante la Superintendencia de Industria y Comercio después de agotar el trámite ante el responsable;',
                'revocar la autorización o pedir la supresión de tus datos cuando no se respeten los principios, derechos y garantías legales y no exista un deber legal o contractual de conservarlos;',
                'acceder en forma gratuita a tus datos personales.',
              ]} />
              <H3>Cómo presentar una solicitud</H3>
              <p>
                Indica tu nombre, tu documento, la descripción de lo que solicitas, el medio para responderte y,
                si actúas en nombre de otra persona, el documento que lo acredite.
              </p>
              <List items={[
                <><strong>Consultas:</strong> se responden en máximo 10 días hábiles, prorrogables 5 días hábiles más informando el motivo.</>,
                <><strong>Reclamos:</strong> se responden en máximo 15 días hábiles, prorrogables 8 días hábiles más. Si el reclamo está incompleto se pedirá completarlo en 5 días; si pasan 2 meses sin respuesta, se entiende desistido.</>,
              ]} />
              <p>
                Desde la plataforma ya puedes retirar los consentimientos de cámara y micrófono
                (<em>Configuración → Privacidad</em>) y actualizar algunos datos de tu perfil.
              </p>
              <Pending>publicar el canal oficial para recibir consultas y reclamos (sección 17).</Pending>
            </Section>

            <Section {...sec('almacenamiento')}>
              <p>NeuroLearn IA no usa cookies de publicidad ni herramientas de analítica o seguimiento. Guarda en tu navegador:</p>
              <List items={[
                <><strong>Almacenamiento local:</strong> el token de tu sesión y datos básicos de tu cuenta para mostrar la interfaz (se borran al cerrar sesión), y la fecha en que descartaste la invitación a instalar la aplicación.</>,
                <><strong>Almacenamiento de sesión:</strong> una marca técnica para recuperar la aplicación tras una actualización.</>,
                <><strong>Caché de la aplicación</strong> (service worker): los archivos de la propia aplicación para que cargue más rápido y funcione sin conexión. Las respuestas con datos personales no se guardan en esta caché.</>,
              ]} />
              <p>
                Las tipografías se cargan desde Google Fonts, por lo que Google recibe la dirección IP del
                navegador al mostrarlas. Todo lo anterior es necesario para el funcionamiento de la plataforma.
              </p>
            </Section>

            <Section {...sec('servicios')}>
              <p>
                La plataforma está integrada con los siguientes servicios. Que se usen depende de la
                configuración de cada despliegue:
              </p>
              <Table
                head={['Servicio', 'Para qué', 'Datos que recibe']}
                rows={[
                  ['Groq (principal) y Google Gemini (respaldo)', 'Generar las respuestas del tutor y de los NeuroBots, calificar respuestas y la IA para profesores.', 'El texto descrito en la sección 5.'],
                  ['Microsoft Azure Speech', 'Convertir en audio las respuestas del tutor.', 'El texto de la respuesta.'],
                  ['Reconocimiento de voz del navegador', 'Modo de voz (dictado).', 'Audio, procesado por el proveedor del navegador (sección 6).'],
                  ['Google Drive', 'Que un profesor agregue enlaces a sus archivos de Drive como material (acceso de solo lectura).', 'Lo autoriza el propio profesor al conectar su cuenta.'],
                  ['Google Calendar', 'Que un profesor publique en su calendario los eventos que crea.', 'Título, fecha y descripción del evento.'],
                  ['Brevo', 'Enviar correos de credenciales y de restablecimiento de contraseña.', 'Nombre, correo y contenido del mensaje.'],
                  ['Neon (PostgreSQL)', 'Base de datos de la plataforma.', 'Todos los datos almacenados.'],
                  ['Vercel', 'Alojamiento de la aplicación y del servidor.', 'Las solicitudes a la plataforma.'],
                  ['Google Fonts', 'Tipografías de la interfaz.', 'Dirección IP del navegador.'],
                ]}
              />
              <p>
                El modelo de detección facial se descarga desde la propia NeuroLearn IA y se ejecuta en el
                dispositivo: no se envían imágenes a terceros.
              </p>
              <Pending>
                verificar los países donde estos proveedores procesan los datos, suscribir los contratos de
                transmisión de datos con los encargados y revisar los requisitos de la Ley 1581 de 2012 para
                transferencias internacionales.
              </Pending>
            </Section>

            <Section {...sec('cambios')}>
              <p>
                Cuando esta política cambie, se actualizará la fecha de «Última actualización». Los cambios
                importantes se informarán dentro de la plataforma y a las instituciones antes de aplicarse.
              </p>
              <p>
                Los textos de consentimiento de cámara y micrófono tienen versión: si cambia lo que hace la
                plataforma con esos datos, se publica una versión nueva, la aceptación anterior deja de valer y
                se pide de nuevo.
              </p>
              <Pending>implementar el aviso de cambios de esta política general y, cuando un cambio lo requiera, la solicitud de una nueva autorización.</Pending>
            </Section>

            <Section {...sec('contacto')}>
              <Pending>
                correo electrónico y demás canales oficiales para consultas, reclamos y solicitudes de
                privacidad, y la persona o área encargada de atenderlas.
              </Pending>
              <p>
                Mientras se publica el canal oficial, los estudiantes y profesores pueden dirigirse a su
                institución educativa, que administra sus cuentas en NeuroLearn IA.
              </p>
              <p>
                También puedes acudir a la Superintendencia de Industria y Comercio, autoridad de protección
                de datos personales en Colombia:{' '}
                <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer"
                  className="font-medium text-[#0B6E99] underline underline-offset-2 hover:text-[#2E6FDB]">www.sic.gov.co</a>.
              </p>
            </Section>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E9E7] pt-6 text-sm">
            <button onClick={goBack} className="flex items-center gap-1.5 text-[#787774] hover:text-[#37352F]">
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <a href="#alcance" onClick={goTo('alcance')} className="text-[#0B6E99] hover:underline">Ir al inicio del documento</a>
          </div>
        </main>
      </div>
    </div>
  );
}
