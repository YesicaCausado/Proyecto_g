/**
 * Política de contraseñas del frontend.
 *
 * Debe coincidir con `validate_password_strength` en backend/app/api/auth.py
 * (mín. 8 caracteres, mayúscula, minúscula, número y carácter especial).
 * Se usa en ForceChangePassword (CU-02) y ResetPasswordPage (CU-03).
 */
export interface PasswordRule {
  id: 'len' | 'upper' | 'lower' | 'digit' | 'special';
  label: string;
  test: (password: string) => boolean;
}

// Mismo conjunto de caracteres especiales que acepta el backend.
const SPECIAL_CHARS = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`';]/;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'len',     label: 'Mínimo 8 caracteres',         test: p => p.length >= 8 },
  { id: 'upper',   label: 'Una letra mayúscula',         test: p => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Una letra minúscula',         test: p => /[a-z]/.test(p) },
  { id: 'digit',   label: 'Un número',                   test: p => /\d/.test(p) },
  { id: 'special', label: 'Un carácter especial (!@#…)', test: p => SPECIAL_CHARS.test(p) },
];

export function passesAllPasswordRules(password: string): boolean {
  return PASSWORD_RULES.every(rule => rule.test(password));
}
