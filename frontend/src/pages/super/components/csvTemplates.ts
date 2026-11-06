export interface CsvTemplate {
  filename: string;
  headers: readonly string[];
  exampleRows?: readonly (readonly string[])[];
  instructions: readonly string[];
}

export const TEACHER_TEMPLATE = {
  filename: 'plantilla_profesores.csv',
  headers: ['nombre_completo', 'tipo_documento', 'numero_documento', 'correo', 'area'],
  exampleRows: [
    ['Carlos Alvarez', 'CC', '1023456789', 'carlos.alvarez.docente@example.com', 'Matemáticas'],
  ],
  instructions: [
    'Reemplaza o elimina la fila de ejemplo antes de importar.',
    'Completa una persona por fila y conserva los encabezados y el orden de las columnas.',
    'El nombre, tipo y número de documento y correo son obligatorios; el área es opcional.',
  ],
} as const satisfies CsvTemplate;

export const STUDENT_TEMPLATE = {
  filename: 'plantilla_estudiantes.csv',
  headers: [
    'nombre_completo',
    'tipo_documento',
    'numero_documento',
    'correo',
    'grado',
    'fecha_nacimiento',
    'nombre_acudiente',
  ],
  exampleRows: [
    ['Carlos Alvarez', 'TI', '1098765432', 'carlos.alvarez.estudiante@example.com', '10°', '2009-05-14', 'Maria Alvarez'],
  ],
  instructions: [
    'Reemplaza o elimina la fila de ejemplo antes de importar.',
    'Completa una persona por fila y conserva los encabezados y el orden de las columnas.',
    'Usa fecha AAAA-MM-DD; para menores se requiere el nombre del acudiente y confirmar su autorización.',
  ],
} as const satisfies CsvTemplate;

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function csvTemplateContent(template: CsvTemplate): string {
  const instructionRows = template.instructions.map(instruction => [
    `# ${instruction}`,
    ...template.headers.slice(1).map(() => ''),
  ]);
  const rows = [template.headers, ...(template.exampleRows ?? []), ...instructionRows];
  return `\uFEFFsep=;\r\n${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
