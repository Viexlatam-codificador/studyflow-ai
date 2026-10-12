# Estado de desarrollo

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
