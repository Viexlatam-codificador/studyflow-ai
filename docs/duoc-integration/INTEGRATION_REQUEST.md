# Solicitud de integración técnica — Blackboard REST API

StudyFlow AI **nunca** se conecta a un LMS institucional sin autorización
explícita. Este documento describe qué se necesita, técnicamente, para
activar la sincronización con Blackboard Learn (usado por Duoc UC y otras
instituciones).

## Qué se necesita de la institución (TI/Blackboard admin)

1. **Registro de la aplicación** en el REST API Framework de Blackboard
   Learn (Building Blocks / Developer Portal del cliente institucional).
2. **Client ID + Client Secret** (OAuth 2.0, flujo de 3 patas / "3LO" —
   `authorization_code`), con scope de lectura sobre:
   - Content (materiales de curso)
   - Announcements
   - Courses / Course Memberships
   - Gradebook (solo lectura, opcional en una primera fase)
3. **URL base** del entorno Blackboard (`https://<host>/learn/api/public/v1`).
4. **Redirect URI autorizada**: `https://app.studyflow.ai/api/integrations/blackboard/callback`
   (o el dominio de staging correspondiente).
5. Confirmación de que el consentimiento de datos de estudiantes cumple con
   la normativa institucional aplicable (FERPA-equivalente local / Ley de
   Protección de Datos Personales de Chile).

## Qué NO necesitamos

- Credenciales de estudiantes individuales (nunca se piden ni se guardan
  contraseñas institucionales — principio no negociable #4 del spec).
- Acceso de escritura al LMS en esta fase.

## Estado actual del adaptador

`packages/integrations/src/integration-provider.ts` implementa
`BlackboardIntegrationProvider` con el flujo OAuth (`getAuthorizationUrl`,
`exchangeCodeForToken`) ya escrito contra la REST API real de Blackboard,
pero **deshabilitado por diseño** (`isConfigured()` retorna `false`)
mientras `BLACKBOARD_CLIENT_ID` / `BLACKBOARD_CLIENT_SECRET` /
`BLACKBOARD_BASE_URL` no estén en el entorno. `fetchTaskCandidates` está
intencionalmente sin implementar — se completa una vez que exista acceso
real para poder probar contra el API verdadero en vez de adivinar su forma.

Mientras tanto, StudyFlow funciona 100% vía captura manual, StudyFlow
Inbox, documentos subidos por el estudiante, y (Fase 4) integraciones de
correo/calendario autorizadas individualmente por el usuario.
