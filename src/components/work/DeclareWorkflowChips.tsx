import {
  DECLARED_TASK_CLASSES,
  DECLARED_TASK_CLASS_LABELS,
  DECLARE_WORKFLOW_HINT,
  DECLARE_WORKFLOW_TITLE,
  PROCESS_STEPS,
  PROCESS_STEP_LABELS,
  type ProcessStep,
  type WorkflowDeclaration,
} from "@/lib/declared-work";

const chipClass = (on: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs transition-colors ${
    on
      ? "border-accent bg-accent-soft text-foreground"
      : "border-border bg-card text-muted-foreground hover:text-foreground"
  }`;

/** The compact chip row inside the mapping flow. Pre-filled from context. */
export function DeclareWorkflowChips({
  value,
  onChange,
}: {
  value: WorkflowDeclaration;
  onChange: (next: WorkflowDeclaration) => void;
}) {
  function toggle(step: ProcessStep) {
    const on = value.process_steps.includes(step);
    const next = on
      ? value.process_steps.filter((s) => s !== step)
      : PROCESS_STEPS.filter((s) => s === step || value.process_steps.includes(s));
    onChange({ ...value, process_steps: [...next] });
  }

  return (
    <div
      data-testid="declare-workflow"
      className="space-y-2 rounded-[var(--radius)] border border-border bg-card px-3 py-3"
    >
      <div>
        <p className="text-sm font-medium text-foreground">{DECLARE_WORKFLOW_TITLE}</p>
        <p className="text-xs text-muted-foreground">{DECLARE_WORKFLOW_HINT}</p>
      </div>
      <div className="flex flex-wrap gap-1.5" data-testid="declare-process-steps">
        {PROCESS_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            aria-pressed={value.process_steps.includes(step)}
            data-testid={`declare-process-step-${step}`}
            onClick={() => toggle(step)}
            className={chipClass(value.process_steps.includes(step))}
          >
            {PROCESS_STEP_LABELS[step]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" data-testid="declare-task-class">
        {DECLARED_TASK_CLASSES.map((task) => (
          <button
            key={task}
            type="button"
            aria-pressed={value.task_class === task}
            data-testid={`declare-task-class-${task}`}
            onClick={() => onChange({ ...value, task_class: task })}
            className={chipClass(value.task_class === task)}
          >
            {DECLARED_TASK_CLASS_LABELS[task]}
          </button>
        ))}
      </div>
    </div>
  );
}
