# Contributing to StudyFlow AI

## Branching

Trabajar siempre en ramas, nunca directo a `main`:

- `feat/<nombre-corto>` — funcionalidad nueva
- `fix/<nombre-corto>` — corrección de bug
- `chore/<nombre-corto>` — mantenimiento, dependencias, config

## Commits

Commits pequeños y descriptivos, en inglés, formato imperativo:

```
feat: add task priority engine
fix: correct RLS policy on course_materials
chore: bump next to 16.3.3
```

## Antes de abrir un PR

```bash
npm run lint
npm run typecheck
npm run build
```

Si tocaste `supabase/migrations/`, agrega una migración nueva (nunca edites
una ya mergeada) y actualiza `supabase/policies/README.md` si cambiaste RLS.

## Principios no negociables (resumen)

- Nunca hardcodear secretos — todo vía variables de entorno (`.env.example`
  siempre actualizado).
- Toda tabla nueva lleva RLS desde el primer commit.
- Ninguna integración institucional se simula como si fuera real — si falta
  autorización/credencial, se documenta en `docs/duoc-integration/` y se
  sigue construyendo el resto del sistema.
- El rol `OWNER` está protegido en base de datos (triggers), no solo en la
  app — no lo debilites "para probar algo rápido".
