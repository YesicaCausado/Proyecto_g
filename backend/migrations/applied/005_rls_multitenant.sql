-- =============================================================
-- NeuroLearn AI — Migración 005: RLS multi-tenant (Row Level Security)
-- PENDIENTE del modelo de seguridad:
--   "RLS de Supabase ⚠️ No aplicado: el aislamiento multi-tenant depende
--    solo de filtros en backend, no de políticas de fila en la DB"
-- Ejecutar en: Supabase → SQL Editor → New query → Run (una sola vez).
-- Es idempotente.
--
-- ⚠️ IMPORTANTE (leer antes de ejecutar)
-- ------------------------------------------------------------------
-- La API FastAPI se conecta a Supabase mediante el rol de servicio
-- (service_role / postgres), que tiene BYPASSRLS y por tanto NO le
-- aplican las políticas. Este script SÍ protege el acceso vía PostgREST
-- (roles `authenticated` / `anon`, p. ej. si el frontend usa supabase-js).
--
-- Para que las políticas protejan TAMBIÉN las consultas del backend:
--   1. Cree un rol de BD dedicado (p. ej. `app_api`) SIN BYPASSRLS y
--      sin pertenencia a `postgres`, y úselo en DATABASE_URL.
--   2. O enrute las consultas multi-tenant a través de PostgREST.
--
-- La política asume que el JWT de Supabase Auth incluye el claim
-- `institution_id`. Configure ese claim custom en Supabase Auth
-- (Dashboard → Authentication → Hooks / Custom claims) o rellene el
-- usuario real que hace la petición mediante `auth.jwt()->>'sub'`
-- buscando su fila en `users`.
-- =============================================================

-- ─── 0. Función auxiliar: institution_id del usuario autenticado ─────────────
-- Devuelve el institution_id del usuario que hace la petición (a partir del
-- claim custom `institution_id` del JWT de Supabase Auth).
CREATE OR REPLACE FUNCTION public.current_institution_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NULLIF((auth.jwt() ->> 'institution_id'), '')::bigint
$$;

-- ------------------------------------------------------------------
-- 1. institutions
--    Solo los que pertenecen a la institución del usuario logueado.
-- ------------------------------------------------------------------
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institutions_select_own" ON public.institutions;
CREATE POLICY "institutions_select_own"
    ON public.institutions
    FOR SELECT
    USING (current_institution_id() = id);

DROP POLICY IF EXISTS "institutions_admin_manage" ON public.institutions;
-- Los admins globales (rol admin) pueden gestionar todas las instituciones.
CREATE POLICY "institutions_admin_manage"
    ON public.institutions
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ------------------------------------------------------------------
-- 2. users — Aislamiento por institución: cada usuario ve/edita su
--    institución y los usuarios de SU institución.
-- ------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Un usuario puede leer su propio perfil.
DROP POLICY IF EXISTS "users_select_self" ON public.users;
CREATE POLICY "users_select_self"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);   -- sub == id (se asume que user.id == auth.users.id)

-- Un usuario dentro de una institución puede ver a los usuarios de su
-- institución (pas clave para paneles de profesor/super-profesor).
DROP POLICY IF EXISTS "users_select_institution" ON public.users;
CREATE POLICY "users_select_institution"
    ON public.users
    FOR SELECT
    USING (
        institution_id = current_institution_id()
        AND current_institution_id() IS NOT NULL
    );

-- Admin global puede gestionar todos los usuarios.
DROP POLICY IF EXISTS "users_admin_manage" ON public.users;
CREATE POLICY "users_admin_manage"
    ON public.users
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ------------------------------------------------------------------
-- 3. classrooms — cada profesor gestiona sus clases; el super-profesor
--    ve las de su institución.
-- ------------------------------------------------------------------
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classrooms_teacher_manage" ON public.classrooms;
CREATE POLICY "classrooms_teacher_manage"
    ON public.classrooms
    FOR ALL
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "classrooms_institution_read" ON public.classrooms;
CREATE POLICY "classrooms_institution_read"
    ON public.classrooms
    FOR SELECT
    USING (
        -- Un super-profesor o profesor lee las clases de su institución a
        -- través del profesor que las creó (join por institution).
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = classrooms.teacher_id
              AND u.institution_id = current_institution_id()
        )
        AND current_institution_id() IS NOT NULL
    );

-- ------------------------------------------------------------------
-- 4. expert_bots — gestión por creador; lectura dentro de institución
--    y bots públicos.
-- ------------------------------------------------------------------
ALTER TABLE public.expert_bots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expert_bots_creator_manage" ON public.expert_bots;
CREATE POLICY "expert_bots_creator_manage"
    ON public.expert_bots
    FOR ALL
    USING (creator_id = auth.uid())
    WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "expert_bots_public_visible" ON public.expert_bots;
CREATE POLICY "expert_bots_public_visible"
    ON public.expert_bots
    FOR SELECT
    USING (is_public = TRUE);

DROP POLICY IF EXISTS "expert_bots_institution_read" ON public.expert_bots;
CREATE POLICY "expert_bots_institution_read"
    ON public.expert_bots
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = expert_bots.creator_id
              AND u.institution_id = current_institution_id()
        )
        AND current_institution_id() IS NOT NULL
    );

-- ------------------------------------------------------------------
-- 5. enrollments — el estudiante lee/gestiona sus inscripciones y el
--    profesor las de su clase.
-- ------------------------------------------------------------------
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enrollments_student_manage" ON public.enrollments;
CREATE POLICY "enrollments_student_manage"
    ON public.enrollments
    FOR ALL
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "enrollments_classroom_teacher" ON public.enrollments;
CREATE POLICY "enrollments_classroom_teacher"
    ON public.enrollments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.classrooms c
            WHERE c.id = enrollments.classroom_id
              AND c.teacher_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------
-- Verificación final: listar tablas con RLS habilitado.
-- ------------------------------------------------------------------
SELECT
    c.relname AS tabla,
    c.relrowsecurity AS rls_habilitado,
    c.relforcerowsecurity AS rls_forzado
FROM pg_class c
WHERE c.relname IN ('institutions','users','classrooms','expert_bots','enrollments')
  AND c.relkind = 'r'
ORDER BY c.relname;