/**
 * Política de contraseñas del frontend.
 *
 * Debe coincidir con `password_policy_error` en backend/app/core/validators.py
 * (8 a 128 caracteres, mayúscula, minúscula, número y carácter especial).
 * Se usa en ForceChangePassword (CU-02) y ResetPasswordPage (CU-03).
 *
 * Carácter especial = cualquier símbolo o espacio (no solo !@#…): la «ñ» y las
 * vocales con tilde cuentan como letras. La contraseña nunca se recorta ni se
 * transforma.
 */
export interface PasswordRule {
  id: 'len' | 'upper' | 'lower' | 'digit' | 'special';
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'len',     label: `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`,
    test: p => [...p].length >= PASSWORD_MIN && [...p].length <= PASSWORD_MAX },
  { id: 'upper',   label: 'Una letra mayúscula',                test: p => /\p{Lu}/u.test(p) },
  { id: 'lower',   label: 'Una letra minúscula',                test: p => /\p{Ll}/u.test(p) },
  { id: 'digit',   label: 'Un número',                          test: p => /\p{Nd}/u.test(p) },
  { id: 'special', label: 'Un carácter especial (!@#?, espacio…)', test: p => /[^\p{L}\p{N}]/u.test(p) },
];

export function passesAllPasswordRules(password: string): boolean {
  return PASSWORD_RULES.every(rule => rule.test(password));
}
