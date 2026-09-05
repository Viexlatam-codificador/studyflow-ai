# Notas — Next.js 16

`create-next-app@latest` instaló Next.js **16.3.3**, más nuevo que el
conocimiento de entrenamiento del modelo. Cambios relevantes verificados
contra `node_modules/next/dist/docs/` antes de escribir código:

## Middleware → Proxy

Next.js 16 renombró "Middleware" a **"Proxy"**. El archivo ahora es
`proxy.ts` (no `middleware.ts`) en la raíz de cada app, y exporta una
función `proxy()` (o default export) en vez de `middleware()`. La
funcionalidad es idéntica (se ejecuta antes de completar el request,
mismo `matcher`, mismo acceso a cookies/headers).

Ambas apps (`apps/student-web/proxy.ts`, `apps/admin-web/proxy.ts`) usan
esto para refrescar la sesión de Supabase y hacer un check optimista de
autenticación/rol — la autorización real sigue viviendo en RLS.

## Cache Components

Next.js 16 introduce "Cache Components" (`cacheComponents` en
`next.config.ts`) como paradigma opcional de cacheo más agresivo. **No
está activado** en este proyecto (`next.config.ts` no lo declara), así que
el comportamiento de renderizado dinámico es el clásico: cualquier ruta
que llame a una API dinámica (`cookies()`, `headers()`, lectura de sesión)
se renderiza dinámicamente por defecto, sin configuración adicional. Si en
el futuro se activa `cacheComponents`, revisar
`docs/app/guides/authentication-with-cache-components.md` dentro de
`node_modules/next/dist/docs/` antes de tocar rutas autenticadas.

## Zod v4

Se usa Zod v4 (`z.email()`, `{ error: "..." }` en vez de `{ message: "..." }`,
`z.flattenError()` en vez del método `.flatten()`). Ver
`apps/student-web/lib/actions/auth.ts` como referencia.
