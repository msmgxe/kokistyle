-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 5A — Cerrar el catálogo del Storage
-- ══════════════════════════════════════════════════════════════════════════
-- Hoy, con sólo la clave pública, cualquiera puede:
--   1. listar las carpetas del bucket  (design-leads, notes, project-photos, site…)
--   2. listar los proyectos dentro de project-photos
--   3. listar los archivos de cada proyecto
--   4. descargarlos sin ninguna credencial
-- Comprobado: una foto de obra se descarga entera con un GET anónimo.
--
-- Este paso corta el paso 1-3: sin listado, no hay forma de descubrir qué
-- archivos existen. Los enlaces públicos que ya usa la landing siguen
-- funcionando, porque en un bucket público la descarga directa no pasa por
-- estas políticas.
--
-- NO es la solución completa: quien ya tenga una URL la seguirá abriendo. Eso
-- se arregla en el paso 5B (bucket privado + URLs firmadas), que es una
-- migración de archivos y toca varias pantallas.

-- ── Lo que hay ahora, para el registro ─────────────────────────────────────
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- ── Fuera todo lo que dé acceso público o anónimo ──────────────────────────
-- Incluye las políticas del rol `public`, que abarca a anon y a authenticated:
-- justo debajo se recrea el acceso del panel de forma explícita.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    RAISE NOTICE 'retirada: %', r.policyname;
  END LOOP;
END $$;

-- ── El panel: sesión iniciada, acceso completo al bucket ───────────────────
DROP POLICY IF EXISTS lux_files_session ON storage.objects;
CREATE POLICY lux_files_session ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'kokistyle-files')
  WITH CHECK (bucket_id = 'kokistyle-files');

-- ── La web pública: sólo subir la foto del AI Design, y sólo ahí ───────────
-- El visitante sube su foto a design-leads/<prospecto>/… No puede listar,
-- ni leer, ni borrar, ni escribir en ninguna otra carpeta.
DROP POLICY IF EXISTS lux_files_lead_upload ON storage.objects;
CREATE POLICY lux_files_lead_upload ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'kokistyle-files'
    AND (storage.foldername(name))[1] = 'design-leads'
  );

-- ── Comprobación ───────────────────────────────────────────────────────────
-- Esperado: sólo estas dos políticas. Nada con rol `public`.
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS
-- ══════════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS lux_files_session ON storage.objects;
-- DROP POLICY IF EXISTS lux_files_lead_upload ON storage.objects;
-- CREATE POLICY lux_files_open ON storage.objects FOR ALL TO anon, authenticated
--   USING (bucket_id = 'kokistyle-files') WITH CHECK (bucket_id = 'kokistyle-files');
