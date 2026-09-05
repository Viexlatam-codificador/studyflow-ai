# Datos demo

`supabase/seed/seed.sql` crea una institución, carrera, semestre y
asignaturas ficticias ("Institución Demo" / "Ingeniería en Marketing
Digital") para que el onboarding y los selectores tengan algo con qué
poblarse en desarrollo.

No incluye tareas de ejemplo porque `tasks.user_id` referencia una fila
real de `auth.users`, que no existe hasta que alguien se registra. En vez
de eso, la idea (pendiente de implementar) es un botón "Cargar datos demo"
en `apps/student-web` disponible solo para cuentas recién creadas, que
inserte 4-6 tareas de ejemplo sobre las asignaturas demo usando el
`user_id` de la sesión actual — así no hay que tocar RLS ni usar el
service_role client desde el cliente.
