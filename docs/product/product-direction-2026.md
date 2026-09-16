# Dirección de producto 2026

## Decisión

StudyFlow continuará como aplicación Next.js sobre Supabase. No se migrará
la aplicación del estudiante a WordPress.

WordPress puede incorporarse más adelante para el sitio público, artículos,
guías y páginas de captación si existe una necesidad editorial frecuente. No
será la fuente de verdad de usuarios, tareas, asignaturas, materiales ni
permisos.

## Por qué WordPress no mejora el núcleo del producto

StudyFlow es una aplicación privada y transaccional. Sus funciones centrales
dependen de datos relacionados por alumno, aislamiento mediante RLS,
reordenamiento y actualización rápida, almacenamiento privado, colaboración y
procesamiento de contenido. Llevar esas funciones a WordPress exigiría crear y
mantener un plugin propio, endpoints REST, reglas de capacidades, tablas
personalizadas y una estrategia adicional de autenticación.

Eso duplicaría responsabilidades que Supabase ya cubre. Los tipos de contenido
y la REST API de WordPress son útiles para contenido editorial, pero no
reemplazan el modelo relacional ni las políticas por fila necesarias en esta
aplicación.

La arquitectura objetivo es:

```text
Aplicación del estudiante (Next.js/PWA)
                |
                v
Supabase (Auth + Postgres + Storage + RLS)
                |
                v
Extracción por reglas -> proveedor de IA opcional

Sitio editorial WordPress (opcional en el futuro)
                |
                v
Contenido público y SEO; sin datos académicos privados
```

## Propuesta de valor

**StudyFlow convierte lo que te encargan en un plan claro para avanzar.**

La entrada puede ser una frase, una foto o una tarea creada manualmente. La
salida debe ser siempre una acción revisable con asignatura, fecha y prioridad.
Después, el producto responde una sola pregunta: **¿qué hago ahora?**

Esto diferencia a StudyFlow de un calendario genérico y evita depender de una
promesa amplia de “IA”. La extracción gratuita por reglas forma parte del
producto, no es una experiencia degradada. La IA mejora la interpretación y el
apoyo sobre materiales cuando está disponible.

## Usuario inicial

Estudiante de educación superior en Chile que recibe instrucciones dispersas
por la sala de clases, mensajes y fotografías, y que pierde fechas o no sabe
qué priorizar. Duoc UC es el primer contexto de uso y validación, pero no debe
aparecer como integración oficial ni como acceso al portal institucional.

## Recorrido principal

1. **Capturar:** escribir, fotografiar o crear rápidamente.
2. **Confirmar:** revisar asignatura, fecha, tipo y peso antes de guardar.
3. **Priorizar:** ver una recomendación principal y las siguientes acciones.
4. **Avanzar:** iniciar una sesión corta o abrir la tarea/material asociado.
5. **Cerrar:** completar la tarea y actualizar el calendario.

El dashboard debe mostrar este recorrido antes que métricas, planes de pago o
funciones secundarias.

## Alcance que se mantiene

- Inbox con confirmación humana.
- Tareas y evaluaciones con prioridad explicable.
- Calendario y feed ICS.
- Materiales compartidos por asignatura con permisos verificables.
- Colaboración mediante invitación y enlaces reales.
- PWA instalable.
- Extracción gratuita sin proveedor de IA.

## Alcance que no se promete todavía

- Tutor con fuentes hasta que el pipeline de extracción, recuperación y citas
  funcione de extremo a extremo.
- Plan Pro o precio mensual hasta que exista cobro y una ventaja pagada clara.
- Sincronización institucional automática.
- Integraciones Microsoft/Google que requieran aplicaciones OAuth aún no
  registradas.
- Aplicación móvil nativa mientras la PWA cubra el caso de uso principal.

## Próximas mejoras, en orden

### 1. Corregir promesa y activación

- Reescribir la landing alrededor de “captura, confirma y sabe qué hacer”.
- Mostrar una demostración real del Inbox y del dashboard.
- Quitar del área pública el precio y las funciones aún no disponibles.
- Reducir el onboarding a la información imprescindible; permitir completar el
  resto después.

### 2. Hacer que el hábito diario sea evidente

- Una acción principal en el dashboard: “Avanza esto ahora”.
- Captura accesible desde cualquier pantalla.
- Estado vacío con un ejemplo que el alumno pueda probar en menos de un minuto.
- Explicar por qué una tarea tiene prioridad y permitir corregir los datos.

### 3. Medir utilidad antes de ampliar funciones

Eventos mínimos, con datos agregados y sin guardar el contenido privado:

- registro completado;
- primera asignatura creada;
- primera captura confirmada;
- primera tarea completada;
- uso semanal del dashboard;
- retención a 7 y 28 días.

La métrica principal será el porcentaje de usuarios nuevos que confirman una
captura y completan una tarea durante sus primeros siete días.

### 4. Validar colaboración y materiales

Antes de construir RAG o nuevas integraciones, verificar que los alumnos
vuelvan por materiales compartidos y tareas grupales. Añadir reportes y
moderación simples si el uso real lo requiere.

### 5. Agregar IA donde produzca una mejora medible

La IA debe reducir correcciones al capturar una tarea o ayudar a responder con
citas sobre materiales. Si falla o no está configurada, el recorrido principal
debe seguir funcionando.

## Criterio para reconsiderar WordPress

Usar WordPress únicamente si publicar contenido se vuelve una operación
frecuente a cargo de personas no técnicas y el sitio público necesita un CMS.
En ese caso se desplegará en un subdominio o como CMS desacoplado y consumirá
solo contenido público. No compartirá credenciales ni almacenará datos
académicos privados.
