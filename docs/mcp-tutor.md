# Tutor MCP de StudyFlow

## Qué resuelve

`studyflow-mcp` permite conectar ChatGPT, Claude u otro cliente compatible con
MCP a la cuenta existente de StudyFlow. El modelo pone la conversación y la
explicación; StudyFlow aporta contexto académico y memoria comprobable. Así no
se necesita pagar una API de IA desde la aplicación en esta primera etapa.

La adaptación usa tres fuentes separadas:

1. preferencias que el alumno declaró;
2. comprensión y dificultad que reportó al terminar una sesión;
3. resultados de comprobaciones breves.

No asigna etiquetas fijas como “visual” o “auditivo”. Una preferencia solo se
mantiene mientras la evidencia muestre que ayuda, y los cambios se presentan
como propuestas que el alumno puede aceptar o rechazar.

## Herramientas iniciales

- `get_student_learning_context`: perfil y confianza declarada por asignatura.
- `list_upcoming_academic_work`: carga próxima y prioridades.
- `get_active_study_plan`: bloques del plan semanal.
- `get_learning_evidence`: sesiones recientes y adaptaciones propuestas.
- `build_personalized_tutoring_brief`: protocolo de tutoría para un tema y un
  tiempo disponible.

Todas son de solo lectura. La IA conectada no puede crear, editar ni borrar
datos de StudyFlow en esta etapa.

## Método de tutoría

El encargo generado sigue una secuencia observable: diagnóstico corto, intento
del alumno, pistas graduales, explicación paso a paso, localización del error,
ejercicio nuevo sin ayuda y revisión posterior de retención. Resolver con ayuda
no se considera automáticamente dominio.

## Activación

Requisitos actuales de Supabase:

1. usar una clave de firma JWT asimétrica (ES256 o RS256);
2. activar **Authentication > OAuth Server**;
3. usar `/oauth/consent` como Authorization Path;
4. activar registro dinámico de clientes y revisar periódicamente los clientes
   registrados;
5. confirmar que Site URL apunta a `https://studyflow-ai-188.netlify.app`;
6. desplegar `studyflow-mcp` con Supabase CLI 2.117.0 o posterior.

La URL pública será:

`https://<project-ref>.supabase.co/functions/v1/studyflow-mcp`

Para dominios personalizados, definir `MCP_AUTH_ISSUER` con el issuer real de
Supabase Auth. La función usa el cliente autenticado y todas sus consultas pasan
por las políticas RLS existentes.

## Evolución prevista

La siguiente versión puede registrar respuestas y comprobaciones desde el MCP,
pero solo con una herramienta de escritura claramente marcada, confirmación del
alumno y políticas RLS específicas. No debe guardar conversaciones completas ni
inferencias psicológicas; basta con evidencia académica mínima y revisable.
