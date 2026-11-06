export interface CsvTemplate {
  filename: string;
  headers: readonly string[];
  exampleRows?: readonly (readonly string[])[];
}

export const TEACHER_TEMPLATE = {
  filename: 'plantilla_profesores.csv',
  headers: ['nombre_completo', 'tipo_documento', 'numero_documento', 'correo', 'area'],
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
    ['Carlos Álvarez', 'TI', '1098765432', 'carlos.alvarez@colegio.edu.co', '10°', '2009-05-14', 'María Álvarez'],
  ],
} as const satisfies CsvTemplate;

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function csvTemplateContent(template: CsvTemplate): string {
  const rows = [template.headers, ...(template.exampleRows ?? [])];
  return `\uFEFFsep=;\r\n${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
