# StudyFlow AI — Mobile (Flutter)

**Estado: no implementado.** Este directorio existe para respetar la
estructura del monorepo (`docs/architecture/overview.md`), pero el
Flutter CLI no está disponible en el entorno donde se generó Fase 1 del
proyecto, así que no se pudo `flutter create` ni verificar que compile —
generar código Dart no verificable sería peor que documentar el plan.

## Qué hay que hacer para arrancar esto (Fase 3)

```bash
flutter create --org ai.studyflow --project-name studyflow_mobile .
```

Luego:

1. Agregar `supabase_flutter` y apuntar a las mismas variables de entorno
   que las apps web (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   — mismos valores, nombres pueden diferir en Dart).
2. Portar los tipos de `packages/shared/src/*.ts` a modelos Dart
   equivalentes (o generarlos desde el esquema Supabase).
3. Portar el motor de prioridad (`packages/academic-core`) — es lógica
   pura sin dependencias de Node, se traduce 1:1.
4. Bottom navigation: Hoy / Semana / Tareas / Estudiar / IA (igual que
   `apps/student-web/app/(app)/layout.tsx`), botón flotante "+" → Inbox.
5. Push notifications: Firebase Cloud Messaging (Android) + APNs (iOS) —
   ver `notifications`/`notification_preferences` en el esquema Supabase,
   ya listas para consumir desde mobile.
6. Widgets nativos (Android + WidgetKit en iOS) — Fase 3 tardía, después de
   que la app base funcione.
7. Captura de audio ("Lo dijo el profesor") con aviso de consentimiento
   explícito antes de grabar — nunca grabación oculta (principio no
   negociable del spec de producto).

## Por qué no un scaffold "fake"

Escribir `.dart` a mano sin poder compilarlo ni correr `flutter analyze`
tiene alto riesgo de quedar con errores de sintaxis o APIs desactualizadas
sin que nadie lo note hasta Fase 3. Mejor dejarlo bien documentado y
generarlo con el CLI real cuando se retome este trabajo.
