import { useCallback, useState } from 'react';
import type { FieldError } from '../utils/validation';

type Rules<F extends string> = Record<F, (value: string) => FieldError>;

/**
 * Errores por campo de un formulario, con un comportamiento común:
 *
 * - `onBlur`: valida al salir del campo, solo si ya tiene contenido (no se
 *   regaña por un campo que el usuario aún no ha llenado).
 * - `onChange`: si el campo ya muestra un error, lo revalida en cada cambio
 *   para que desaparezca en cuanto se corrige.
 * - `validateAll`: al enviar, valida todo (incluidos los obligatorios vacíos)
 *   y devuelve si el formulario es válido.
 * - `setErrors`: para mostrar en su campo los errores que devuelve el backend.
 */
export function useFieldErrors<F extends string>(rules: Rules<F>) {
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({});

  const setOne = useCallback((field: F, message: FieldError) => {
    setErrors(prev => {
      if ((prev[field] ?? null) === (message ?? null)) return prev;
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }, []);

  const onBlur = (field: F, value: string) => {
    if (String(value ?? '').trim()) setOne(field, rules[field](value));
  };

  const onChange = (field: F, value: string) => {
    if (errors[field]) setOne(field, rules[field](value));
  };

  const validateAll = (values: Record<F, string>): boolean => {
    const next: Partial<Record<F, string>> = {};
    (Object.keys(rules) as F[]).forEach(field => {
      const message = rules[field](values[field] ?? '');
      if (message) next[field] = message;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const reset = useCallback(() => setErrors({}), []);

  return { errors, setErrors, setOne, onBlur, onChange, validateAll, reset };
}
