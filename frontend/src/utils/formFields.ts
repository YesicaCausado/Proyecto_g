/**
 * Ayudas de presentación para campos de formulario con validación
 * (acompañan a components/FieldError.tsx).
 */

/** Atributos de accesibilidad del campo según su estado de error. */
export function fieldA11y(id: string, error?: string | null, hint?: string | null) {
  return {
    id,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}

/** Clases de borde del campo (normal / con error) en el estilo de la app. */
export function fieldBorder(error?: string | null): string {
  return error
    ? 'border-[#E03E3E] focus:ring-[#FDEEEE]'
    : 'border-[#E9E9E7] focus:ring-[#E5F3FF] focus:border-[#0B6E99]';
}

/** Lleva el foco al primer campo inválido del formulario (tras el render). */
export function focusFirstInvalid(form: HTMLElement | null) {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
