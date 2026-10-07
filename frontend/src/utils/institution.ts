import type { User } from '../types';

/**
 * Texto de la institución del usuario para encabezados y menús.
 * - Administrador: no pertenece a ninguna institución (gestiona todas).
 * - Resto: el nombre real que entrega /auth/me (institution_name).
 * - Sin institución asociada: se indica tal cual, sin inventar un nombre.
 */
export function institutionLabel(user: User | null | undefined): string {
  if (!user) return '';
  if (user.role === 'admin') return 'Administración global';
  if (user.institution_name) return user.institution_name;
  return user.institution_id ? 'Institución no disponible' : 'Sin institución asignada';
}
