export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">No tienes acceso</h1>
        <p className="text-foreground/60">
          Tu cuenta no tiene un rol de staff en StudyFlow AI. Si crees que esto es un error, contacta
          al equipo Founder.
        </p>
      </div>
    </div>
  );
}
