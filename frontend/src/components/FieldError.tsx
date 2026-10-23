import { AlertCircle, Info } from 'lucide-react';

/**
 * Mensaje de error (o de ayuda) asociado a un campo de formulario.
 *
 * Uso: `<input {...fieldA11y('email', error)} />` (utils/formFields.ts) y
 * debajo `<FieldError id="email" error={error} />`. El error se anuncia a
 * lectores de pantalla y no depende solo del color (lleva icono y texto).
 */
export function FieldError({ id, error, hint }: { id: string; error?: string | null; hint?: string | null }) {
  if (error) {
    return (
      <p id={`${id}-error`} role="alert" className="mt-1 flex items-start gap-1 text-xs text-[#E03E3E]">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="mt-1 flex items-start gap-1 text-xs text-[#787774]">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{hint}</span>
      </p>
    );
  }
  return null;
}
