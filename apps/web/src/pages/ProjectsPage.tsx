import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CreativeProject } from '@frameroom/shared';
import { post } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import {
  Action,
  Area,
  Feedback,
  Field,
  Form,
  Modal,
  PageHeading,
  QueryState,
} from '../components/ui';

export function ProjectsPage() {
  const t = useStrings();
  const projects = useApi<CreativeProject[]>('/v1/creative-projects');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const navigate = useNavigate();
  const create = useTask(async () => {
    const p = await post<CreativeProject>('/v1/creative-projects', { title, idea });
    navigate(`/projects/${p.id}`);
  });
  return (
    <>
      <PageHeading
        title={t.project.title}
        subtitle={t.project.subtitle}
        action={<Action onClick={() => setOpen(true)}>{t.project.new}</Action>}
      />
      <QueryState query={projects} empty={projects.data?.length === 0} />
      <div className="project-grid">
        {projects.data?.map((p, i) => (
          <Link className="project-card" key={p.id} to={`/projects/${p.id}`}>
            <div className={`project-art art-${i % 3}`}>
              <span>0{i + 1}</span>
              <i>↗</i>
            </div>
            <div className="project-card-body">
              <span className="eyebrow">{p.bookingId ? t.booking.room : t.project.overview}</span>
              <h2>{p.title}</h2>
              <p>{p.idea}</p>
            </div>
          </Link>
        ))}
      </div>
      {open ? (
        <Modal title={t.project.new} onClose={() => setOpen(false)}>
          <Form onSubmit={() => create.mutate()}>
            <Field label={t.project.name} value={title} onChange={setTitle} required />
            <Area
              label={t.project.idea}
              value={idea}
              onChange={setIdea}
              placeholder={t.project.placeholder}
            />
            <Feedback error={create.error} />
            <Action type="submit" pending={create.isPending}>
              {t.project.create}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
