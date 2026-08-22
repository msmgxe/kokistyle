# Arranque seguro — plantilla para la próxima aplicación

> Escrito el **22 ago 2026**, después de rehacer el modelo de acceso de Luxaris Design en cuatro
> fases. Todo lo que hay aquí es una lección pagada: cada punto corresponde a algo que hubo que
> arreglar en producción, con la app ya funcionando y con datos de clientes dentro.
>
> **Cómo usarlo:** la parte 1 se pega tal cual al empezar un proyecto con un asistente de IA. Las
> partes 2 y 3 explican el porqué, para poder decidir cuándo apartarse de la receta.

---

## Parte 1 · El prompt

Copiar desde aquí hasta el final de la parte 1.

---

Vamos a construir **[NOMBRE]**, una aplicación **[Next.js App Router + TypeScript + Supabase +
Vercel]** para **[QUÉ HACE Y PARA QUIÉN]**. Manejará **[QUÉ DATOS SENSIBLES: datos de clientes,
precios, márgenes, documentos…]**.

Antes de escribir la primera línea de producto, quiero que dejes montada esta base. No es opcional
ni "para después": añadirla más tarde cuesta diez veces más y obliga a migrar datos en caliente.

### Identidad y autorización

1. **La autorización vive en el servidor, nunca en la interfaz.** Ocultar un botón no es seguridad.
   Toda decisión de permiso se toma en Postgres (RLS) o en una ruta de API verificada en servidor.
2. **La clave pública del cliente no puede ser una llave maestra.** Si el navegador habla directo con
   la base, cada consulta debe llevar identidad: un JWT con el rol y el alcance del usuario. Sin eso,
   las políticas sólo pueden decir "todos pueden todo" o "nadie puede nada".
3. **RLS activado en todas las tablas desde la primera migración**, con políticas reales. Nunca una
   política `FOR ALL TO anon USING (true)` "mientras desarrollo": eso se queda para siempre.
4. **Una política por comando.** `FOR ALL` con un `USING` permisivo también autoriza `DELETE`: quien
   puede ver, puede borrar.
5. **Las credenciales se guardan con hash** (scrypt o Argon2id — `node:crypto` basta, sin
   dependencias). Nunca en claro, ni "temporalmente".
6. **Rate limit por IP desde el día uno** en login, recuperación de credenciales, correo, IA y
   cualquier ruta que cueste dinero.

### Datos y archivos

7. **RLS filtra filas, no columnas.** Lo que no todos pueden ver —costos, márgenes, tarifas— va en
   **otra tabla**, no en otra columna de la misma fila. Decidirlo al diseñar el esquema, no después.
8. **Los archivos privados en un bucket privado**, servidos con URLs firmadas de vida corta. Un
   bucket público no sólo sirve los archivos: **permite enumerarlos** si `storage.objects` deja
   listar. Separar desde el principio lo público (imágenes de marketing) de lo privado (documentos y
   fotos de clientes).
9. **En la base se guardan referencias, no URLs.** Una URL firmada caduca; una URL pública guardada
   es una fuga permanente. Guardar la ruta y firmar al mostrar.

### Rutas de API

10. **Toda ruta que gaste dinero o mande correo exige sesión.** Un relay de correo abierto se
    convierte en spam desde tu dominio en cuestión de horas.
11. **Un único punto que resuelve la identidad** (`resolveSession()` o equivalente) y que valida
    todo: firma, expiración y revocación. Si esa lógica está copiada en tres rutas, dos estarán mal.
12. **El actor de una auditoría lo pone el servidor**, derivado de la sesión. Un registro donde el
    cliente dice quién actúa no es un registro.
13. **Nunca un valor de respaldo hardcodeado** para una credencial (`config?.pin ?? "1234"`). Si falta
    la configuración, se deniega. Ese valor acaba en el historial de git para siempre.

### Calidad, desde el commit uno

14. **CI antes que la primera funcionalidad**: tipos, pruebas y lint en cada push. Añadirlo con
    40 archivos ya escritos significa empezar con cientos de errores y apagarlo.
15. **Pruebas donde está el riesgo**, no porcentaje de cobertura: cálculos de dinero, generación de
    documentos, y autenticación frente a manipulación, expiración y escalada de rol.
16. **Migraciones versionadas y numeradas** en el repo, cada una con su comprobación y su marcha
    atrás. **El archivo de esquema no es la fuente de verdad** en cuanto alguien toca el dashboard:
    consultar siempre el catálogo real de la base antes de diseñar un cambio.
17. **Variables de entorno documentadas** en el README con su propósito y dónde se obtienen, y
    marcadas como sensibles las que lo sean.

### Cómo quiero que trabajes

18. **Verificar la función completa, no el endpoint.** Recorrer UI → API → base → vuelta. Si dos
    flujos "hacen lo mismo" (subir una foto de galería y subir una portada), son flujos distintos y
    cada uno necesita su prueba.
19. **Nunca probar escrituras destructivas contra datos en vivo.** Para eso: transacción con
    `ROLLBACK`, o una copia.
20. **Cambios por lotes pequeños y verificables**, cada uno con su marcha atrás. Nada de "lo cambio
    todo y vemos".
21. **Decir qué falta y qué queda a medias.** Un informe que dice "listo" cuando falta el último paso
    es peor que no tener informe.

---

## Parte 2 · Por qué cada punto — lo que costó aprenderlo

| Regla | Qué pasó en Luxaris |
|---|---|
| Autorización en servidor | Los permisos vivían en `tab_access` del navegador. Cualquiera con la clave pública leía proyectos, clientes, presupuestos, pagos y márgenes desde la consola. |
| Identidad en cada consulta | Toda la Fase 2 (siete lotes de SQL) existió sólo para poder darle identidad al navegador. Con el diseño correcto de origen, habrían sido cero lotes. |
| Una política por comando | Un `FOR ALL` con `USING` permisivo habría dejado a un cliente **borrar sus propios pagos**. Se detectó al escribir la política, no en producción — por suerte. |
| Credenciales con hash | Los PINes estaban en claro y `app_users` se consultaba desde el navegador: cualquiera con la clave pública los leía todos. |
| Rate limit | Con 4 dígitos y sin límite, el espacio entero (10.000) se recorre en horas. Probando dos PINes al azar contra la API acerté el de una colaboradora al segundo intento. |
| Columnas sensibles en otra tabla | `cost` y `profit` vivían junto al precio del cliente. RLS no filtra columnas: hubo que crear `estimate_item_costs` y migrar datos con la app en marcha. |
| Bucket privado | El bucket público permitía **listar carpeta por carpeta** y descargar sin credenciales. Bajé una foto de obra de 147 KB sin ninguna clave. |
| Referencias, no URLs | La migración de archivos tuvo tres correcciones seguidas porque las URLs guardadas traían query (`?v=…`) y porque las portadas vivían en otro flujo. |
| Rutas de pago con sesión | `/api/estimate/send-email` aceptaba destinatario, asunto y adjunto de cualquiera: spam desde la cuenta de la empresa. Tres rutas de IA facturables estaban igual. |
| Un solo `resolveSession()` | Tres rutas validaban revocación pero **no expiración**: un token caducado seguía abriendo el CMS. |
| Auditoría del servidor | `activity_log` aceptaba que el navegador dijera quién hizo cada cosa. |
| Sin valor de respaldo | Un PIN hardcodeado como fallback estaba en **tres** rutas — y una de ellas permitía cambiar el PIN real y el correo de recuperación. Toma de control completa. Sigue en el historial de git. |
| CI desde el principio | Se añadió con 47 errores de lint ya dentro. Hubo que inventar un trinquete para no bloquear el trabajo. |
| Pruebas donde está el riesgo | Un carácter pegado desde Word rompía el PDF entero durante meses. La prueba que lo detecta cabe en diez líneas. |
| El esquema no es la verdad | El primer script de RLS se generó desde `schema.sql` y **se saltó 12 tablas** cuyas políticas se habían creado en el dashboard. Habría apagado el panel. |

---

## Parte 3 · Orden de montaje recomendado

Para una aplicación nueva, en este orden, antes de la primera funcionalidad de producto:

1. **Esquema con RLS activado y políticas reales.** Aunque al principio sólo exista el rol admin.
2. **Identidad**: login → sesión de servidor firmada → token con rol y alcance para el cliente.
3. **Dos buckets** desde el minuto uno: público para marketing, privado para todo lo demás.
4. **`resolveSession()` y `rateLimit()`** antes de la primera ruta de API.
5. **CI con tipos, pruebas y lint** antes de la primera pantalla.
6. **Un script de verificación de aislamiento** —impersonar cada rol en una transacción con
   `ROLLBACK` y contar lo que ve— antes de tener usuarios reales. Es la prueba que dice si el modelo
   funciona, y se escribe en veinte minutos.

Con eso, lo que en Luxaris fueron cuatro fases y tres días de migraciones en caliente son un par de
horas al empezar.
