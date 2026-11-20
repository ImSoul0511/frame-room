import { milestoneInputSchema } from '@frameroom/shared';
import type { Workspace } from '../../lib/types';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { post } from '../../lib/api';
import { Action, Feedback } from '../../components/ui';
export function ChecklistImport({ workspace: w }: { workspace: Workspace }) {
  const t = useStrings();
  const brief = w.briefs.find((item) => item.version === w.booking.agreedBriefVersion);
  const titles = brief?.content.checklist.map((title) => title.trim()).filter(Boolean) ?? [];
  const invalid = titles.some(
    (title) => !milestoneInputSchema.safeParse({ title, dueAt: null }).success,
  );
  const task = useTask(() => post<{ count: number }>(`/v1/shoot-rooms/${w.room!.id}/checklist`));
  if (!titles.length) return null;
  return (
    <div className="checklist-import">
      <p>{t.tools.checklistHint}</p>
      <Action
        secondary
        pending={task.isPending}
        disabled={invalid || w.room?.status !== 'open'}
        onClick={() => task.mutate()}
      >
        {t.tools.importChecklist}
      </Action>
      {invalid ? <p role="status">{t.tools.checklistLength}</p> : null}
      <Feedback
        error={task.error}
        success={task.data ? `${task.data.count} ${t.tools.tasksAdded}` : null}
      />
    </div>
  );
}
