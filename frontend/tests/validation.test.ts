/**
 * Pruebas de las reglas de validación del frontend (src/utils/validation.ts y
 * src/data/passwordRules.ts). Las mismas reglas las aplica el backend en
 * backend/app/core/validators.py (tests/test_validaciones_entradas.py).
 *
 * Ejecutar desde frontend/:  npm test   (node --test, sin dependencias extra)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  apiErrorMessage, apiFieldErrors, escapeHtml, filterDocumentInput, filterInviteCode,
  filterPhoneInput, isRealDate, normalizeEmail, normalizePersonName, todayISO,
  validateBirthDate, validateDaneCode, validateDate, validateDateRange,
  validateDocumentNumber, validateEmail, validateFile, validateGrade,
  validateInviteCode, validateNumber, validatePersonName, validatePhone,
  validateText, validateTime, validateUrl, MATERIAL_EXTENSIONS,
} from '../src/utils/validation.ts';
import { PASSWORD_RULES, passesAllPasswordRules } from '../src/data/passwordRules.ts';

const ok = (value: unknown) => assert.equal(value, null);
const bad = (value: unknown, includes?: string) => {
  assert.equal(typeof value, 'string', `se esperaba un error y se obtuvo ${String(value)}`);
  if (includes) assert.ok(String(value).includes(includes), `«${value}» no contiene «${includes}»`);
};

describe('nombres de personas', () => {
  it('acepta tildes, ñ, diéresis, nombres compuestos, guiones y apóstrofos', () => {
    for (const name of ['María José', 'Peña', 'Güiza', 'Ana-Lucía', "O'Neill", 'D’Ángelo', 'Ma. Fernanda', 'Zoë Ñúñez']) {
      ok(validatePersonName(name));
    }
  });
  it('rechaza vacío, solo espacios, números y símbolos', () => {
    bad(validatePersonName(''), 'obligatorio');
    bad(validatePersonName('    '), 'obligatorio');
    bad(validatePersonName('Carlos 2'), 'números');
    bad(validatePersonName('Ana<script>'));
    bad(validatePersonName('Juan@Pérez'));
    bad(validatePersonName('--'));
  });
  it('controla longitud mínima y máxima', () => {
    bad(validatePersonName('A'), '2 letras');
    ok(validatePersonName('Al'));
    ok(validatePersonName('a'.repeat(100)));
    bad(validatePersonName('a'.repeat(101)), '100');
  });
  it('el opcional vacío es válido; normaliza espacios sin cambiar mayúsculas ni tildes', () => {
    ok(validatePersonName('', { required: false }));
    assert.equal(normalizePersonName('  José   ÁLVAREZ '), 'José ÁLVAREZ');
  });
});

describe('correo electrónico', () => {
  it('acepta formatos válidos', () => {
    for (const email of ['ana@colegio.edu.co', 'ana.gomez+10@sub.dominio.org', 'A_B-c@x.io', '123@neurolearn.local']) {
      ok(validateEmail(email));
    }
  });
  it('rechaza formatos inválidos', () => {
    for (const email of ['ana', 'ana@', '@x.co', 'ana@x', 'ana @x.co', 'ana@@x.co', 'ana..b@x.co', '.ana@x.co', 'ana@-x.co', 'ana@x.c']) {
      bad(validateEmail(email), 'formato válido');
    }
  });
  it('vacío obligatorio / opcional, longitud máxima y normalización', () => {
    bad(validateEmail(''), 'obligatorio');
    ok(validateEmail('', { required: false }));
    bad(validateEmail(`${'a'.repeat(60)}@${'b'.repeat(40)}.co`), '100');
    assert.equal(normalizeEmail('  Ana@Colegio.EDU.co '), 'ana@colegio.edu.co');
  });
});

describe('documentos de identidad', () => {
  it('conserva ceros iniciales y valida longitudes por tipo', () => {
    ok(validateDocumentNumber('0012345678', 'CC'));
    ok(validateDocumentNumber('1234', 'CC'));
    bad(validateDocumentNumber('123', 'CC'), 'entre 4 y 10');
    bad(validateDocumentNumber('12345678901', 'CC'), 'entre 4 y 10');
    ok(validateDocumentNumber('1098765432', 'TI'));
    ok(validateDocumentNumber('AB123456', 'PA'));
  });
  it('rechaza letras en tipos numéricos, espacios y símbolos', () => {
    bad(validateDocumentNumber('12AB5678', 'CC'), 'únicamente números');
    bad(validateDocumentNumber('1234 5678', 'TI'), 'espacios');
    bad(validateDocumentNumber('12.345.678', 'CE'));
    bad(validateDocumentNumber('AB-1234', 'PA'));
    bad(validateDocumentNumber('', 'CC'), 'obligatorio');
  });
  it('el filtro de escritura quita separadores y avisa si había caracteres no válidos', () => {
    assert.deepEqual(filterDocumentInput('1.234.567', 'CC'), { value: '1234567', removed: false });
    assert.deepEqual(filterDocumentInput('12a34', 'CC'), { value: '1234', removed: true });
    assert.deepEqual(filterDocumentInput('0001234', 'TI'), { value: '0001234', removed: false });
    assert.equal(filterDocumentInput('ab 12-34', 'PA').value, 'AB1234');
    assert.equal(filterDocumentInput('9'.repeat(15), 'CC').value.length, 10);
    assert.equal(filterDocumentInput('9'.repeat(15), 'CC').removed, true);
  });
});

describe('teléfonos', () => {
  it('acepta nacionales e internacionales con formato', () => {
    for (const phone of ['3001234567', '+57 300 123 4567', '(601) 555-1234', '+1-202-555-0143']) ok(validatePhone(phone));
  });
  it('rechaza letras, «+» fuera del inicio y longitudes imposibles', () => {
    bad(validatePhone('300-ABC-1234'));
    bad(validatePhone('300+1234567'));
    bad(validatePhone('12345'), 'entre 7 y 15');
    bad(validatePhone('+' + '1'.repeat(16)), 'entre 7 y 15');
    ok(validatePhone(''));
    bad(validatePhone('', { required: true }), 'obligatorio');
  });
  it('el filtro solo deja «+» al inicio', () => {
    assert.equal(filterPhoneInput('+57 (300) abc-123').value, '+57 (300) -123');
    assert.equal(filterPhoneInput('+57 (300) abc-123').removed, true);
    assert.equal(filterPhoneInput('57+300').value, '57300');
  });
});

describe('contraseñas', () => {
  it('acepta símbolos, espacios y letras con tilde sin transformarlas', () => {
    assert.ok(passesAllPasswordRules('Clave segura 2026'));
    assert.ok(passesAllPasswordRules('Ñandú#2026'));
    assert.ok(passesAllPasswordRules('Abc123¡x'));
    assert.ok(passesAllPasswordRules('Pa$$w0rd<>"'));
  });
  it('rechaza las que no cumplen la política', () => {
    assert.equal(passesAllPasswordRules('Ab1!'), false);           // corta
    assert.equal(passesAllPasswordRules('abcdefg1!'), false);      // sin mayúscula
    assert.equal(passesAllPasswordRules('ABCDEFG1!'), false);      // sin minúscula
    assert.equal(passesAllPasswordRules('Abcdefgh!'), false);      // sin número
    assert.equal(passesAllPasswordRules('Abcdefgh1ñ'), false);     // la ñ es letra, no símbolo
    assert.equal(passesAllPasswordRules('Aa1!' + 'x'.repeat(125)), false); // > 128
  });
  it('cada regla tiene etiqueta visible', () => {
    assert.equal(PASSWORD_RULES.length, 5);
    for (const rule of PASSWORD_RULES) assert.ok(rule.label.length > 3);
  });
});

describe('fechas y horas', () => {
  it('rechaza fechas imposibles y formatos inválidos', () => {
    assert.equal(isRealDate('2024-02-29'), true);
    assert.equal(isRealDate('2025-02-29'), false);
    assert.equal(isRealDate('2025-13-01'), false);
    bad(validateDate('2025-02-30'), 'no es una fecha válida');
    bad(validateDate('30/01/2025'), 'AAAA-MM-DD');
    bad(validateDate(''), 'obligatoria');
    ok(validateDate('', { required: false }));
  });
  it('fecha de nacimiento: no futura y desde 1900; límite = hoy', () => {
    const today = todayISO();
    ok(validateBirthDate(today, today));
    ok(validateBirthDate('2009-05-14', today));
    bad(validateBirthDate('2999-01-01', today), 'posterior al día de hoy');
    bad(validateBirthDate('1899-12-31', today), '1900');
    ok(validateBirthDate(''));
  });
  it('todayISO usa la fecha local (sin desfase UTC)', () => {
    assert.equal(todayISO(new Date(2026, 0, 1, 23, 30)), '2026-01-01');
  });
  it('rango y límites', () => {
    bad(validateDateRange('2026-05-10', '2026-05-01'), 'anterior');
    ok(validateDateRange('2026-05-01', '2026-05-01'));
    bad(validateDate('2026-01-01', { min: '2026-02-01' }), 'anterior');
    bad(validateDate('2026-03-01', { max: '2026-02-01' }), 'posterior');
  });
  it('horas HH:MM', () => {
    ok(validateTime('07:05'));
    ok(validateTime('23:59'));
    bad(validateTime('24:00'));
    bad(validateTime('7pm'));
  });
});

describe('números', () => {
  it('límites, enteros, negativos, NaN e infinito', () => {
    ok(validateNumber('40', { label: 'El cupo', min: 1, max: 100 }));
    ok(validateNumber(100, { label: 'El cupo', min: 1, max: 100 }));
    bad(validateNumber('101', { label: 'El cupo', min: 1, max: 100 }), 'máximo');
    bad(validateNumber('-3', { label: 'El cupo', min: 1, max: 100 }), 'al menos');
    bad(validateNumber('2.5', { label: 'El cupo', min: 1, max: 100 }), 'entero');
    ok(validateNumber('2,5', { label: 'El umbral', min: 0, max: 100, integer: false }));
    bad(validateNumber('abc', { label: 'El umbral', min: 0, max: 100 }), 'número válido');
    bad(validateNumber('Infinity', { label: 'El umbral', min: 0, max: 100 }), 'número válido');
    bad(validateNumber('', { label: 'El cupo', min: 1, max: 100 }), 'obligatorio');
  });
});

describe('códigos', () => {
  it('código de invitación: 8 letras/números, sin distinguir mayúsculas', () => {
    ok(validateInviteCode('ab12cd34'));
    ok(validateInviteCode('  AB12CD34 '));
    bad(validateInviteCode('AB12CD3'), '8 letras');
    bad(validateInviteCode('AB12-D34'));
    bad(validateInviteCode(''), 'Debes ingresar');
    assert.deepEqual(filterInviteCode('ab12 cd34'), { value: 'AB12CD34', removed: false });
    assert.equal(filterInviteCode('ab-12cd34').removed, true);
  });
  it('código DANE: solo dígitos, 5 a 12', () => {
    ok(validateDaneCode('154001000149'));
    bad(validateDaneCode('15A001'), 'solo admite números');
    bad(validateDaneCode('1234'), 'entre 5 y 12');
    bad(validateDaneCode('1234567890123'), 'entre 5 y 12');
  });
  it('grado escolar', () => {
    for (const g of ['10°', '11-A', 'Décimo', '9 B', '6']) ok(validateGrade(g));
    bad(validateGrade('10<b>'));
    bad(validateGrade('x'.repeat(21)), '20');
    bad(validateGrade('', { required: true }), 'obligatorio');
  });
});

describe('textos libres', () => {
  it('admite puntuación, comillas, emojis y saltos de línea', () => {
    ok(validateText('¿Qué es «x»? (ver pág. 3) — "ok" 😀\nSegunda línea', { label: 'El mensaje', max: 2000 }));
    ok(validateText('<b>no es HTML</b> & a < b', { label: 'El mensaje', max: 2000 }));
  });
  it('rechaza vacío/espacios y excesos (cuenta emojis como un carácter)', () => {
    bad(validateText('   \n  ', { label: 'El mensaje', max: 10 }), 'obligatorio');
    ok(validateText('😀'.repeat(10), { label: 'El mensaje', max: 10 }));
    bad(validateText('😀'.repeat(11), { label: 'El mensaje', max: 10 }), '10');
    bad(validateText('ab', { label: 'El título', max: 10, min: 3 }), 'al menos 3');
  });
});

describe('URL', () => {
  it('solo http(s) con dominio', () => {
    ok(validateUrl('https://drive.google.com/file/d/abc/view'));
    ok(validateUrl('http://colegio.edu.co'));
    bad(validateUrl('javascript:alert(1)'), 'https://');
    bad(validateUrl('data:text/html,hola'), 'https://');
    bad(validateUrl('ftp://x.co/a'), 'https://');
    bad(validateUrl('https://user:pass@x.co'), 'usuario');
    bad(validateUrl('https://x.co/a b'), 'espacios');
    bad(validateUrl('colegio.edu.co'));
  });
});

describe('archivos', () => {
  it('extensión, vacío y tamaño máximo', () => {
    const opts = { extensions: MATERIAL_EXTENSIONS, maxBytes: 4 * 1024 * 1024 };
    ok(validateFile({ name: 'Guía 1.PDF', size: 1000 }, opts));
    bad(validateFile({ name: 'virus.exe', size: 1000 }, opts), 'formato permitido');
    bad(validateFile({ name: 'logo.svg', size: 1000 }, opts), 'formato permitido');
    bad(validateFile({ name: 'vacio.pdf', size: 0 }, opts), 'vacío');
    bad(validateFile({ name: 'grande.pdf', size: 4 * 1024 * 1024 + 1 }, opts), 'tamaño máximo');
    ok(validateFile({ name: 'justo.pdf', size: 4 * 1024 * 1024 }, opts));
  });
});

describe('seguridad y errores del backend', () => {
  it('escapeHtml neutraliza etiquetas y comillas', () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    assert.equal(escapeHtml("O'Neill & Hijos"), 'O&#39;Neill &amp; Hijos');
  });
  it('apiErrorMessage entiende detail texto, lista de Pydantic y falta de conexión', () => {
    assert.equal(apiErrorMessage({ response: { data: { detail: 'Correo duplicado' } } }, 'x'), 'Correo duplicado');
    assert.equal(apiErrorMessage({ response: { data: { detail: [{ msg: 'Value error, Nombre inválido' }] } } }, 'x'), 'Nombre inválido');
    assert.equal(apiErrorMessage({ response: { data: {} } }, 'Falló'), 'Falló');
    assert.ok(apiErrorMessage({}, 'x').includes('conectar'));
  });
  it('apiFieldErrors asocia cada error a su campo', () => {
    const err = { response: { data: { errors: [
      { field: 'email', message: 'Correo inválido' },
      { field: 'full_name', message: 'Nombre inválido' },
    ] } } };
    assert.deepEqual(apiFieldErrors(err, { full_name: 'lastName' }), { email: 'Correo inválido', lastName: 'Nombre inválido' });
    assert.deepEqual(apiFieldErrors({}), {});
  });
});
