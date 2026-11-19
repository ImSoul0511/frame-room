import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const task = useTask(async () => {
    if (!start || !end || Date.parse(start) <= Date.now() || Date.parse(end) <= Date.parse(start))
      throw new RequestError(422, 'invalid_interval');
    const input = initialBookingInputSchema.parse({
      serviceId: service.id,
      projectId: projectId || undefined,
      scheduledStart: new Date(start).toISOString(),
      scheduledEnd: new Date(end).toISOString(),
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
    const content = JSON.stringify(input);
    if (lastSubmission.current?.content !== content)
      lastSubmission.current = { key: crypto.randomUUID(), content };
    const b = await post<{ id: string }>('/v1/booking-requests', input, lastSubmission.current.key);
    nav(`/bookings/${b.id}`);
  });
  const startInvalid = !start || Date.parse(start) <= submittedAt;
  const endInvalid = !end || Date.parse(end) <= Date.parse(start);
  const submit = () => {
    if (task.isPending || reference.isPending) return;
    const time = Date.now();
    setSubmittedAt(time);
    if (name.trim() && idea.trim() && scope.locationType && Date.parse(start) > time && !endInvalid)
      task.mutate();
  };
  return (
    <Form onSubmit={submit}>
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
        label={t.demo.concept}
        value={idea}
        onChange={setIdea}
        required
        error={submittedAt && !idea.trim() ? t.booking.conceptRequired : undefined}
      />
      <div className="two-col">
        <Select
          label={t.demo.genre}
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
          label={t.demo.locationType}
          value={scope.locationType}
          onChange={(value) => set('locationType', value as typeof scope.locationType)}
          error={submittedAt && !scope.locationType ? t.booking.locationRequired : undefined}
        >
          <option value="">—</option>
          <option value="outdoor">{t.demo.outdoor}</option>
          <option value="indoor">{t.demo.indoor}</option>
          <option value="studio">{t.demo.studioLocation}</option>
        </Select>
        <Field
          label={t.demo.location}
          value={scope.location}
          onChange={(value) => set('location', value)}
        />
        <NumberField
          label={t.demo.people}
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
          label={t.demo.photos}
          value={scope.photoCount}
          onChange={(value) => set('photoCount', value)}
        />
        <NumberField
          label={t.demo.retouched}
          value={scope.retouchedCount}
          onChange={(value) => set('retouchedCount', value)}
        />
        <NumberField
          label={t.demo.revisions}
          value={scope.revisionLimit}
          onChange={(value) => set('revisionLimit', value)}
        />
        <NumberField
          label={t.demo.budget}
          value={scope.budget}
          onChange={(value) => set('budget', value)}
        />
      </div>
      <Area label={t.demo.crew} value={scope.crew} onChange={(value) => set('crew', value)} />
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
