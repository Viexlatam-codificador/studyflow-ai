# Estado de desarrollo

## 2026-10-19

- **Estado:** primera versión local del tutor MCP; no desplegada.
- **Servidor:** nueva Edge Function `studyflow-mcp` autenticada con OAuth 2.1
  de Supabase. Todas las consultas se ejecutan como el alumno y respetan RLS.
- **Tutoría:** cinco herramientas de solo lectura entregan perfil, carga próxima,
  plan activo, evidencia y un encargo pedagógico personalizado para GPT, Gemini
  u otro cliente compatible.
- **Adaptación:** conserva separadas las preferencias declaradas, la percepción
  del alumno y las comprobaciones. Exige evidencia repetida, evita etiquetas de
  aprendizaje fijas y deja las adaptaciones bajo control del estudiante.
- **Interfaz:** se agregó la pantalla de consentimiento `/oauth/consent`, la
  decisión segura de aprobar o negar y el retorno al consentimiento después de
  iniciar sesión.
- **Costo inicial:** StudyFlow no llama una API de IA; el modelo conectado por el
  alumno realiza la tutoría y el MCP aporta la memoria académica.
- **Activación pendiente:** habilitar OAuth Server y registro dinámico en el
  proyecto Supabase, confirmar firma JWT asimétrica, desplegar la función y
  publicar la interfaz en Netlify. Instrucciones en `docs/mcp-tutor.md`.
- **Comprobaciones:** typecheck y lint de `student-web` aprobados; build de
  producción con Webpack aprobado; 58 pruebas de `academic-core` aprobadas.
  La Edge Function no se ejecutó localmente porque este equipo aún no tiene
  Deno ni Supabase CLI instalados.

## 2026-10-11

- **Estado:** cambios locales; no publicados.
- **Recuperación:** proyecto copiado desde `/Volumes/Macbook Air/Trabajos/studyflow-ai`
  a `~/Desktop/Trabajos/studyflow-ai`. El pendrive no fue modificado.
- **Cambio principal:** el flujo asistido de planificación permite elegir
  ChatGPT o Gemini. ChatGPT aparece seleccionado cuando el alumno todavía no
  tiene una preferencia guardada; elegir un proveedor conserva la preferencia
  existente en Supabase.
- **Privacidad:** StudyFlow genera un contexto editable y el alumno lo copia al
  proveedor. No se solicitan credenciales ni se presenta el enlace externo como
  una conexión automática. Toda propuesta vuelve al mismo proceso de validación,
  revisión y confirmación antes de modificar el plan.
- **Interfaz:** la landing, el centro de estudio, el perfil y las etiquetas del
  plan ahora describen el flujo como ChatGPT/Gemini o IA externa.
- **Comprobaciones:** typecheck completo aprobado; 58 pruebas de
  `academic-core` aprobadas; lint de `student-web` aprobado; build de producción
  de `student-web` aprobado con Webpack. Turbopack no pudo ejecutarse en el
  entorno restringido porque su proceso CSS intentó abrir un puerto interno.
- **Siguiente paso:** revisar visualmente con una cuenta de prueba y, si se
  aprueba, publicar mediante el flujo Netlify existente.
