import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CreativeProject, Service } from '@frameroom/shared';
import { useApi, useTask } from '../../lib/hooks';
import { post, currency } from '../../lib/api';
import { Action, Area, DateField, Feedback, Field, Form, Select } from '../../components/ui';
import { useStrings } from '../../lib/i18n';

export function BookingForm({ service }: { service: Service }) {
  const t = useStrings();

  const [params] = useSearchParams();
  const [projectId, setProject] = useState(params.get('project') ?? '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [addOns, setAddOns] = useState<string[]>([]);
  const nav = useNavigate();
  const projects = useApi<CreativeProject[]>('/v1/creative-projects');
  const extras = useApi<{ id: string; name: string; price: number }[]>(
    `/v1/services/${service.id}/add-ons`,
  );
  const task = useTask(async () => {
    let id = projectId;
    if (!id) {
      const created = await post<CreativeProject>('/v1/creative-projects', { title: name, idea });
      id = created.id;
      setProject(id);
    }
    if (!start || !end) throw new Error(t.booking.dateRequired);
    const b = await post<{ id: string }>('/v1/bookings', {
      serviceId: service.id,
      projectId: id,
      scheduledStart: new Date(start).toISOString(),
      scheduledEnd: new Date(end).toISOString(),
      addOnIds: addOns,
      note,
    });
    nav(`/bookings/${b.id}`);
  });
  return (
    <Form onSubmit={() => task.mutate()}>
      <Select label={t.booking.project} value={projectId} onChange={setProject}>
        <option value="">{t.project.new}</option>
        {projects.data
          ?.filter((p) => !p.bookingId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
      </Select>
      {!projectId ? (
        <>
          <Field label={t.project.name} value={name} onChange={setName} required />
          <Area label={t.project.idea} value={idea} onChange={setIdea} />
        </>
      ) : null}
      <div className="two-col">
        <DateField label={t.booking.start} value={start} onChange={setStart} />
        <DateField label={t.booking.end} value={end} onChange={setEnd} />
      </div>
      {extras.data?.map((extra) => (
        <label key={extra.id} className="checkbox-row">
          <input
            type="checkbox"
            checked={addOns.includes(extra.id)}
            onChange={(e) =>
              setAddOns(
                e.target.checked ? [...addOns, extra.id] : addOns.filter((v) => v !== extra.id),
              )
            }
          />
          {extra.name} (+{currency(extra.price)})
        </label>
      ))}
      <Area label={t.booking.note} value={note} onChange={setNote} />
      <Feedback error={task.error ?? projects.error} />
      <Action type="submit" pending={task.isPending}>
        {t.booking.request}
      </Action>
    </Form>
  );
}
