import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import {
  genres,
  initialBookingInputSchema,
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

export function BookingForm({ service, project }: { service: Service; project?: CreativeProject }) {
  const t = useStrings();

  const [projectId, setProject] = useState(project?.id ?? '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState(project?.title ?? '');
  const [idea, setIdea] = useState(project?.brief?.concept ?? project?.idea ?? '');
  const [scope, setScope] = useState({
    genre: service.genre,
    locationType: '' as '' | 'outdoor' | 'indoor' | 'studio',
    location: '',
    people: 1,
    photoCount: service.photoCount,
    retouchedCount: service.retouchedCount,
    revisionLimit: service.revisionLimit ?? 2,
    budget: service.price,
    crew: '',
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
  );
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
  const startInvalid =
    !start || !Number.isFinite(Date.parse(start)) || Date.parse(start) <= submittedAt;
  const endInvalid =
    !end || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start);
  const submit = () => {
    if (task.isPending || reference.isPending) return;
    const time = Date.now();
    setSubmittedAt(time);
    const toIso = (value: string) => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.toISOString() : '';
    };
    const parsed = initialBookingInputSchema.safeParse({
      serviceId: service.id,
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
        requirements: { ...scope, notes: note },
      },
    });
    const labels: Record<string, string> = {
      scheduledStart: t.booking.start,
      scheduledEnd: t.booking.end,
      note: t.booking.note,
      'brief.title': t.project.name,
      'brief.concept': t.workspaceUi.concept,
      'brief.requirements.genre': t.workspaceUi.genre,
      'brief.requirements.locationType': t.workspaceUi.locationType,
      'brief.requirements.location': t.workspaceUi.location,
      'brief.requirements.people': t.workspaceUi.people,
      'brief.requirements.photoCount': t.workspaceUi.photos,
      'brief.requirements.retouchedCount': t.workspaceUi.retouched,
      'brief.requirements.revisionLimit': t.workspaceUi.revisions,
      'brief.requirements.budget': t.workspaceUi.budget,
      'brief.requirements.crew': t.workspaceUi.crew,
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
    if (!start || !Number.isFinite(Date.parse(start)) || Date.parse(start) <= time)
      errors.push(t.booking.start);
    if (!end || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start))
      errors.push(t.booking.end);
    if (start && end && Date.parse(end) - Date.parse(start) > 86400000)
      errors.push(t.errors.invalid_interval);
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
        {service.description} · {currency(service.price)}
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
        <Select
          label={t.workspaceUi.genre}
          value={scope.genre}
          onChange={(value) => set('genre', value as Service['genre'])}
        >
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {t.genreLabels[genre]}
            </option>
          ))}
        </Select>
        <Select
          label={t.workspaceUi.locationType}
          value={scope.locationType}
          onChange={(value) => set('locationType', value as typeof scope.locationType)}
          error={submittedAt && !scope.locationType ? t.booking.locationRequired : undefined}
        >
          <option value="">—</option>
          <option value="outdoor">{t.workspaceUi.outdoor}</option>
          <option value="indoor">{t.workspaceUi.indoor}</option>
          <option value="studio">{t.workspaceUi.studioLocation}</option>
        </Select>
        <Field
          label={t.workspaceUi.location}
          value={scope.location}
          onChange={(value) => set('location', value)}
        />
        <NumberField
          label={t.workspaceUi.people}
          value={scope.people}
          min={1}
          onChange={(value) => set('people', value)}
        />
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
        <NumberField
          label={t.workspaceUi.photos}
          value={scope.photoCount}
          onChange={(value) => set('photoCount', value)}
        />
        <NumberField
          label={t.workspaceUi.retouched}
          value={scope.retouchedCount}
          onChange={(value) => set('retouchedCount', value)}
        />
        <NumberField
          label={t.workspaceUi.revisions}
          value={scope.revisionLimit}
          onChange={(value) => set('revisionLimit', value)}
        />
        <NumberField
          label={t.workspaceUi.budget}
          value={scope.budget}
          onChange={(value) => set('budget', value)}
        />
      </div>
      <Area
        label={t.workspaceUi.crew}
        value={scope.crew}
        onChange={(value) => set('crew', value)}
      />
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
      <Area label={t.booking.note} value={note} onChange={setNote} />
      <Feedback error={task.error ?? reference.error ?? projects.error ?? extras.error} />
      <Action type="submit" pending={task.isPending} disabled={reference.isPending}>
        {t.booking.request}
      </Action>
    </Form>
  );
}
