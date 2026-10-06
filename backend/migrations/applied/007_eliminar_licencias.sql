-- ================================================================
-- NeuroLearn IA — Migración 007
-- Eliminar el modelo de licencias (planes Básica / Premium / Pro)
-- Fecha: 6 de octubre de 2026
-- ================================================================
--
-- CONTEXTO
--   NeuroLearn ya no tiene licencias: el acceso depende solo del rol del
--   usuario (app/core/permissions.py). Las únicas estructuras de BD que
--   existían exclusivamente para las licencias son dos columnas de
--   `institutions`:
--     - license_type  (creada en 001_b2b_schema.sql y en app/db/migrate.py)
--     - expiry_date   (creada en app/db/migrate.py)
--   No hay tablas de licencias, planes ni suscripciones.
--   `institutions.is_active` SE CONSERVA: el Administrador la usa para
--   desactivar una institución completa (no es parte del modelo de licencias).
--   El índice sobre license_type, si existe, se elimina junto con la columna.
--
-- ORDEN OBLIGATORIO
--   1. Desplegar primero el código sin licencias (el backend ya no lee ni
--      escribe estas columnas). Si se ejecuta antes, la versión anterior del
--      backend fallaría al consultar `institutions`.
--   2. (Recomendado) Respaldar los datos históricos ejecutando y guardando
--      el resultado de:
--
--        SELECT id, name, dane_code, license_type, expiry_date
--        FROM institutions
--        ORDER BY id;
--
--   3. Ejecutar este archivo en Supabase → SQL Editor.
--   4. Mover este archivo a migrations/applied/ y hacer commit
--      ("chore(db): migración 007 - eliminar licencias").
--
-- Idempotente: puede ejecutarse más de una vez sin error.
-- ================================================================

BEGIN;

ALTER TABLE institutions DROP COLUMN IF EXISTS license_type;
ALTER TABLE institutions DROP COLUMN IF EXISTS expiry_date;

COMMIT;

-- Verificación: no debe devolver filas.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'institutions'
  AND column_name IN ('license_type', 'expiry_date');
