"use client";

import type { AdminUserRow } from "@/lib/data/users";

function toCsv(users: AdminUserRow[]): string {
  const header = ["nombre", "correo", "roles", "plan", "fecha_registro"];
  const rows = users.map((u) => [
    u.name ?? "",
    u.email,
    u.roles.join("|") || "STUDENT_FREE",
    u.planKey,
    u.createdAt,
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map((v) => escape(String(v))).join(",")).join("\n");
}

export function ExportUsersButton({ users }: { users: AdminUserRow[] }) {
  function handleExport() {
    const csv = toCsv(users);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `studyflow-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-card"
    >
      Descargar CSV
    </button>
  );
}
