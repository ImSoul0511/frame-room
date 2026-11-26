import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import {
  initialBookingInputSchema,
  type PrivateQuote,
  type CreativeProject,
  type Service,
} from '@frameroom/shared';
import { useApi, useTask } from '../../lib/hooks';
import { post, currency, upload, RequestError } from '../../lib/api';
import {
  Action,
  Area,
  DateField,
  Feedback,
  Field,
  FilePicker,
  Form,
  NumberField,
  Select,
} from '../../components/ui';
import { useStrings } from '../../lib/i18n';

function shootTime(value: string) {
  return Date.parse(value ? `${value}+07:00` : '');
}

export function BookingForm({
  service,
  project,
  quote,
  slot,
}: {
  service: Pick<
    Service,
    | 'name'
    | 'description'
    | 'genre'
    | 'photoCount'
    | 'retouchedCount'
    | 'revisionLimit'
    | 'price'
    | 'billingUnit'
  > & { id?: string };
  project?: CreativeProject;
  quote?: PrivateQuote;
  slot?: { start: string; end: string };
}) {
  const t = useStrings();

  const [projectId, setProject] = useState(project?.id ?? '');
  const [start, setStart] = useState(slot?.start ?? '');
  const [end, setEnd] = useState(slot?.end ?? '');
  const [quantity, setQuantity] = useState(quote?.terms.quantity ?? 1);
  const [deliveryDue, setDeliveryDue] = useState('');
  const [highlightsDue, setHighlightsDue] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState(project?.title ?? '');
  const [idea, setIdea] = useState(project?.brief?.concept ?? project?.idea ?? '');
  const [scope, setScope] = useState({
    genre: service.genre,
    people: 1,
    photoCount: service.photoCount,
    retouchedCount: service.retouchedCount,
    revisionLimit: service.revisionLimit ?? 2,
    budget: service.price,
    referencePaths: project?.referencePaths ?? [],
  });
  const [addOns, setAddOns] = useState<string[]>([]);
  const [submittedAt, setSubmittedAt] = useState(0);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const errorSummary = useRef<HTMLDivElement>(null);
  const lastSubmission = useRef<{ key: string; content: string } | null>(null);
  const nav = useNavigate();
  const projects = useApi<CreativeProject[]>('/v1/creative-projects');
  const extras = useApi<{ id: string; name: string; price: number }[]>(
    `/v1/services/${service.id}/add-ons`,
    Boolean(service.id && !quote),
  );
  const total =
    service.price * quantity +
    (extras.data ?? [])
      .filter((extra) => addOns.includes(extra.id))
      .reduce((sum, extra) => sum + extra.price, 0);
  const hasAttendance = ['event', 'yearbook', 'wedding', 'family'].includes(service.genre);
  const hasHighlights = ['event', 'yearbook'].includes(service.genre);
  const reference = useTask(async (file: File) => {
    const result = await upload(file, 'brief-references');
    setScope((current) => ({
      ...current,
      referencePaths: [...current.referencePaths, result.storagePath],
    }));
  });
  const set = <Key extends keyof typeof scope>(key: Key, value: (typeof scope)[Key]) =>
    setScope((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    if (invalidFields.length) errorSummary.current?.focus();
  }, [invalidFields]);
  const task = useTask(async (input: z.output<typeof initialBookingInputSchema>) => {
    if (Date.parse(input.scheduledStart) <= Date.now())
      throw new RequestError(422, 'invalid_interval');
    const content = JSON.stringify(input);
    if (lastSubmission.current?.content !== content)
      lastSubmission.current = { key: crypto.randomUUID(), content };
    const b = await post<{ id: string }>('/v1/booking-requests', input, lastSubmission.current.key);
    nav(`/bookings/${b.id}`);
  });
  const startInvalid = !Number.isFinite(shootTime(start)) || shootTime(start) <= submittedAt;
  const endInvalid = !Number.isFinite(shootTime(end)) || shootTime(end) <= shootTime(start);
  const submit = () => {
    if (task.isPending || reference.isPending) return;
    const time = Date.now();
    setSubmittedAt(time);
    const toIso = (value: string) => {
      const date = new Date(shootTime(value));
      return Number.isFinite(date.getTime()) ? date.toISOString() : '';
    };
    const parsed = initialBookingInputSchema.safeParse({
      serviceId: quote ? undefined : service.id,
      quoteId: quote?.id,
      quantity,
      projectId: projectId || undefined,
      scheduledStart: toIso(start),
      scheduledEnd: toIso(end),
      addOnIds: addOns,
      note,
      brief: {
        title: name,
        concept: idea,
        shotList: [],
        lighting: [],
        checklist: [],
        milestones: [],
        requirements: {
          ...scope,
          notes: note,
          budget: total,
          photoCount: scope.photoCount * quantity,
          retouchedCount: scope.retouchedCount * quantity,
          deliveryDueAt: toIso(deliveryDue) || undefined,
          highlightsDueAt: toIso(highlightsDue) || undefined,
        },
      },
    });
    const labels: Record<string, string> = {
      scheduledStart: t.booking.start,
      quantity: t.workspaceUi.quantity,
      scheduledEnd: t.booking.end,
      note: t.booking.note,
      'brief.title': t.project.name,
      'brief.concept': t.workspaceUi.concept,
      'brief.requirements.genre': t.workspaceUi.genre,
      'brief.requirements.people': t.workspaceUi.people,
      'brief.requirements.photoCount': t.workspaceUi.photos,
      'brief.requirements.retouchedCount': t.workspaceUi.retouched,
      'brief.requirements.revisionLimit': t.workspaceUi.revisions,
      'brief.requirements.budget': t.workspaceUi.budget,
      'brief.requirements.notes': t.booking.note,
      'brief.requirements.referencePaths': t.project.reference,
    };
    const errors = parsed.success
      ? []
      : parsed.error.issues.map((issue) => {
          const path = issue.path.join('.');
          if (path === 'brief.requirements.retouchedCount' && issue.code === 'custom')
            return t.booking.retouchedExceedsPhotos;
          return (
            labels[path] ?? labels[issue.path.slice(0, -1).join('.')] ?? t.errors.invalid_input
          );
        });
    if (!Number.isFinite(shootTime(start)) || shootTime(start) <= time)
      errors.push(t.booking.start);
    if (!Number.isFinite(shootTime(end)) || shootTime(end) <= shootTime(start))
      errors.push(t.booking.end);
    if (shootTime(end) - shootTime(start) > 86400000) errors.push(t.errors.invalid_interval);
    if (deliveryDue && shootTime(deliveryDue) < shootTime(end))
      errors.push(t.workspaceUi.deliveryDue);
    if (
      highlightsDue &&
      (shootTime(highlightsDue) < shootTime(end) ||
        shootTime(highlightsDue) > shootTime(deliveryDue))
    )
      errors.push(t.workspaceUi.highlightsDue);
    if (errors.length || !parsed.success) {
      setInvalidFields([...new Set(errors)]);
      return;
    }
    setInvalidFields([]);
    task.mutate(parsed.data);
  };
  return (
    <Form onSubmit={submit} noValidate>
      {invalidFields.length ? (
        <div ref={errorSummary} tabIndex={-1} role="alert" className="notice error">
          {t.errors.invalid_input} {invalidFields.join(', ')}.
        </div>
      ) : null}
      <p>
        {service.description} · {currency(service.price)} /{' '}
        {t.workspaceUi[`unit_${service.billingUnit ?? 'package'}`]}
      </p>
      {quote ? (
        <p>
          {t.workspaceUi.quantity} · {quantity}
        </p>
      ) : (
        <NumberField
          label={t.workspaceUi.quantity}
          value={quantity}
          min={1}
          max={1000}
          onChange={setQuantity}
        />
      )}
      <p>
        <strong>
          {t.workspaceUi.estimate} · {currency(total)}
        </strong>
      </p>
      <p>
        {t.studio.photos} · {scope.photoCount * quantity} · {t.studio.retouched} ·{' '}
        {scope.retouchedCount * quantity}
      </p>
      <Select
        label={t.booking.project}
        value={projectId}
        onChange={(id) => {
          setProject(id);
          const project = projects.data?.find((entry) => entry.id === id);
          if (project) {
            setName(project.title);
            setIdea(project.idea);
            set('referencePaths', project.referencePaths);
          }
        }}
      >
        <option value="">{t.project.new}</option>
        {projects.data
          ?.filter((p) => !p.bookingId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
      </Select>
      <Field
        label={t.project.name}
        value={name}
        onChange={setName}
        required
        error={submittedAt && !name.trim() ? t.booking.titleRequired : undefined}
      />
      <Field
        label={t.workspaceUi.concept}
        value={idea}
        onChange={setIdea}
        required
        error={submittedAt && !idea.trim() ? t.booking.conceptRequired : undefined}
      />
      <div className="two-col">
        {hasAttendance && (
          <NumberField
            label={t.workspaceUi.shootSize}
            value={scope.people}
            min={1}
            onChange={(value) => set('people', value)}
          />
        )}
        <DateField
          label={t.booking.start}
          value={start}
          onChange={setStart}
          required={false}
          error={submittedAt && startInvalid ? t.booking.futureStartRequired : undefined}
        />
        <DateField
          label={t.booking.end}
          value={end}
          onChange={setEnd}
          required={false}
          error={submittedAt && endInvalid ? t.errors.invalid_interval : undefined}
        />
      </div>
      <div className="two-col">
        <DateField
          label={t.workspaceUi.deliveryDue}
          value={deliveryDue}
          onChange={setDeliveryDue}
          required={false}
        />
        {hasHighlights && (
          <DateField
            label={t.workspaceUi.highlightsDue}
            value={highlightsDue}
            onChange={setHighlightsDue}
            required={false}
          />
        )}
      </div>
      <p className="muted">UTC+7</p>
      <FilePicker
        label={t.project.addReference}
        onFile={(file) => reference.mutate(file)}
        disabled={reference.isPending || scope.referencePaths.length >= 12}
      />
      {scope.referencePaths.map((path, index) => (
        <div className="row between" key={path}>
          <span>
            {t.project.reference} {index + 1}
          </span>
          <Action
            secondary
            onClick={() =>
              set(
                'referencePaths',
                scope.referencePaths.filter((item) => item !== path),
              )
            }
          >
            {t.delete}
          </Action>
        </div>
      ))}
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
      <Area label={t.workspaceUi.deliveryNote} value={note} onChange={setNote} />
      <Feedback error={task.error ?? reference.error ?? projects.error ?? extras.error} />
      <Action type="submit" pending={task.isPending} disabled={reference.isPending}>
        {t.booking.request}
      </Action>
    </Form>
  );
}
