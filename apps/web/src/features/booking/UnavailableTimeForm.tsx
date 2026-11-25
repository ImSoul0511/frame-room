import { useState } from 'react';
import { blockInputSchema } from '@frameroom/shared';
import {
  Action,
  DateField,
  Feedback,
  Field,
  Form,
  Modal,
  QueryState,
  Select,
} from '../../components/ui';
import { post } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import type { Resource, Studio } from '../../lib/types';

export function UnavailableTimeForm({
  date,
  personal,
  manager,
  onClose,
}: {
  date: string;
  personal: boolean;
  manager: boolean;
  onClose: () => void;
}) {
  const t = useStrings();
  const [start, setStart] = useState(`${date}T09:00`);
  const [end, setEnd] = useState(`${date}T10:00`);
  const [label, setLabel] = useState('');
  const [studioId, setStudio] = useState('');
  const [resourceId, setResource] = useState('');
  const studios = useApi<Studio[]>('/v1/me/studios', manager);
  const resources = useApi<Resource[]>(`/v1/studios/${studioId}/resources`, Boolean(studioId));
  const create = useTask(async () => {
    const input = blockInputSchema.parse({
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      label,
      ...(resourceId ? { resourceId } : {}),
    });
    await post('/v1/me/schedule/blocks', input);
  });
  const canSubmit = studioId ? Boolean(resourceId) : personal;
  return (
    <Modal
      title={t.studio.blocks}
      onClose={() => {
        if (!create.isPending) onClose();
      }}
    >
      <Form onSubmit={() => create.mutate(undefined, { onSuccess: onClose })}>
        <Field label={t.studio.label} value={label} onChange={setLabel} />
        {manager ? (
          <>
            <QueryState query={studios} />
            <Select
              label={t.nav.studio}
              value={studioId}
              onChange={(id) => {
                setStudio(id);
                setResource('');
              }}
            >
              <option value="">{personal ? t.portfolio.own : '—'}</option>
              {studios.data
                ?.filter((studio) => studio.role === 'manager')
                .map((studio) => (
                  <option key={studio.id} value={studio.id}>
                    {studio.name}
                  </option>
                ))}
            </Select>
          </>
        ) : null}
        {studioId ? (
          <>
            <QueryState
              query={resources}
              empty={resources.isSuccess && !resources.data.some((resource) => resource.isActive)}
            />
            <Select label={t.booking.resources} value={resourceId} onChange={setResource} required>
              <option value="">—</option>
              {resources.data
                ?.filter((resource) => resource.isActive)
                .map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
            </Select>
          </>
        ) : null}
        <div className="two-col">
          <DateField label={t.booking.start} value={start} onChange={setStart} />
          <DateField label={t.booking.end} value={end} onChange={setEnd} />
        </div>
        <Feedback error={create.error} />
        <Action type="submit" disabled={!canSubmit} pending={create.isPending}>
          {t.studio.newBlock}
        </Action>
      </Form>
    </Modal>
  );
}
