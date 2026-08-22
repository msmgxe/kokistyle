-- ══════════════════════════════════════════════════════════════════════════
-- FASE 2 · PASO 5B — Bucket privado para lo que es de los clientes
-- ══════════════════════════════════════════════════════════════════════════
-- El paso 5A cortó el catálogo: ya nadie puede descubrir qué archivos existen.
-- Pero quien tenga una URL vieja la sigue abriendo, porque el bucket es
-- público y la descarga directa no pasa por políticas.
--
-- Aquí nace `luxaris-privado`: sin acceso público, sólo con enlaces firmados
-- que caducan. Se mudan las fotos de obra y los adjuntos de notas. El bucket
-- viejo se queda con lo que de verdad es público: las imágenes de la landing
-- y la herramienta de AI Design.

-- ── El bucket ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('luxaris-privado', 'luxaris-privado', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ── Quién entra: sólo sesión iniciada, y nunca anon ────────────────────────
DROP POLICY IF EXISTS lux_privado_session ON storage.objects;
CREATE POLICY lux_privado_session ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'luxaris-privado')
  WITH CHECK (bucket_id = 'luxaris-privado');

-- ── Comprobación ───────────────────────────────────────────────────────────
select id, public from storage.buckets order by id;
-- ⬆ `luxaris-privado` debe salir con public = false.

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
-- ⬆ Tres políticas: la del panel sobre kokistyle-files, la de subida anónima
--   a design-leads, y esta nueva del bucket privado. Ninguna con rol `public`.

-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS
-- ══════════════════════════════════════════════════════════════════════════
-- Ojo: si ya se migraron archivos, volver atrás exige devolverlos al bucket
-- público y reescribir las referencias `priv:` de la base.
-- DROP POLICY IF EXISTS lux_privado_session ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'luxaris-privado';
