import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { csvTemplateContent, STUDENT_TEMPLATE, TEACHER_TEMPLATE } from '../src/pages/super/components/csvTemplates.ts';

describe('plantillas CSV de usuarios', () => {
  it('genera columnas Excel separadas y conserva la fila de ejemplo', () => {
    const content = csvTemplateContent(STUDENT_TEMPLATE);
    const [separator, ...rows] = content.slice(1).trimEnd().split('\r\n');

    assert.ok(content.startsWith('\uFEFF'));
    assert.equal(separator, 'sep=;');
    assert.deepEqual(rows[0].split(';'), STUDENT_TEMPLATE.headers.map(value => `"${value}"`));
    assert.deepEqual(rows[1].split(';'), STUDENT_TEMPLATE.exampleRows[0].map(value => `"${value}"`));
    assert.equal(rows[1].split(';').length, rows[0].split(';').length);
  });

  it('mantiene la plantilla docente sin registros de ejemplo', () => {
    const [, ...rows] = csvTemplateContent(TEACHER_TEMPLATE).slice(1).trimEnd().split('\r\n');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].split(';').length, TEACHER_TEMPLATE.headers.length);
  });
});
