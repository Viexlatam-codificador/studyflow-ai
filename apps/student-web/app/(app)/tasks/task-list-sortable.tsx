"use client";

import { useState, useTransition } from "react";
import { Reorder, useDragControls } from "framer-motion";
import type { TaskWithSubject } from "@/lib/data/tasks";
import { rankByPriority, rankByManualOrder } from "@/lib/task-sort";
import { reorderTasks } from "@/lib/actions/tasks";
import { TaskCard } from "@/components/task-card";

type SortMode = "auto" | "manual";

export function TaskListSortable({ tasks }: { tasks: TaskWithSubject[] }) {
  const [mode, setMode] = useState<SortMode>("auto");
  const [manualOrder, setManualOrder] = useState<TaskWithSubject[]>(() => rankByManualOrder(tasks));
  const [isPending, startTransition] = useTransition();

  const autoOrder = rankByPriority(tasks);

  function handleReorder(next: TaskWithSubject[]) {
    setManualOrder(next);
    startTransition(() => reorderTasks(next.map((t) => t.id)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ModeButton active={mode === "auto"} onClick={() => setMode("auto")}>
          Automático (prioridad)
        </ModeButton>
        <ModeButton active={mode === "manual"} onClick={() => setMode("manual")}>
          Arrastra para ordenar
        </ModeButton>
        {isPending && <span className="text-xs text-foreground/40">Guardando orden…</span>}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-foreground/50">
          Aún no tienes tareas. Crea una arriba o usa el botón + para capturarla con IA.
        </p>
      ) : mode === "auto" ? (
        <div className="flex flex-col gap-2">
          {autoOrder.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      ) : (
        <Reorder.Group axis="y" values={manualOrder} onReorder={handleReorder} className="flex flex-col gap-2">
          {manualOrder.map((t) => (
            <DraggableTaskRow key={t.id} task={t} />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "brand-gradient text-white" : "border border-border text-foreground/60"
      }`}
    >
      {children}
    </button>
  );
}

function DraggableTaskRow({ task }: { task: TaskWithSubject }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}
      className="flex items-center gap-2"
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        className="shrink-0 cursor-grab touch-none px-1 text-foreground/30 active:cursor-grabbing"
        aria-label="Arrastrar para reordenar"
      >
        ⠿
      </button>
      <div className="flex-1">
        <TaskCard task={task} />
      </div>
    </Reorder.Item>
  );
}
