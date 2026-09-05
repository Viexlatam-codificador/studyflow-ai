# Pricing y posicionamiento

Posicionamiento: **Smart Academic Operating System**.
Frase principal: *"Tu estudio, organizado por IA."*

## Planes (implementados en `supabase/seed/seed.sql` → tabla `plans`)

| Plan | Precio | Incluye |
|---|---|---|
| Free | $0 | Asignaturas, horario, tareas manuales, calendario, alertas básicas |
| Pro | $9.99/mes ($89.99/año) | + IA (Inbox, tutor, flashcards, quizzes), planificador inteligente, análisis de documentos |
| Campus | Cotización institucional | Licenciamiento por institución, analíticas agregadas |

Estos precios son un punto de partida razonable, no una decisión de
pricing validada con mercado — revisar antes de cobrar de verdad.

## Nota

Ningún proveedor de pago real está conectado todavía
(`BILLING_PROVIDER=mock` en `.env.example`) — ver
`packages/integrations/src/billing-provider.ts`. No hacer afirmaciones de
"cobro automático" hasta integrar Stripe con credenciales reales.
