import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Service } from '@frameroom/shared';
import type { Portfolio, Image, Studio } from '../lib/types';
import { api, post, patch, upload, currency } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import {
  Action,
  Area,
  Feedback,
  Field,
  FilePicker,
  Form,
  GenreSelect,
  Modal,
  PageHeading,
  Provenance,
  QueryState,
  Select,
} from '../components/ui';
import { PhotographerForm, ServiceForm } from '../features/catalog/ProviderForms';
import { AddOnForm } from './StudioPage';
import { ReportButton } from './SettingsPage';

export function PortfolioPage() {
  const t = useStrings();
  const { profile } = useAuth();
  const list = useApi<Portfolio[]>('/v1/me/portfolios');
  const studios = useApi<Studio[]>('/v1/me/studios');
  const services = useApi<Service[]>('/v1/me/services');
  const [open, setOpen] = useState<'portfolio' | 'service' | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('portrait');
  const [studio, setStudio] = useState('');
  const nav = useNavigate();
  const create = useTask(async () => {
    const p = await post<Portfolio>(
      studio ? `/v1/studios/${studio}/portfolios` : '/v1/portfolios',
      { title, description, genre, status: 'draft' },
    );
    nav(`/portfolios/${p.id}?edit=1`);
  });
  if (!profile?.roles.includes('photographer'))
    return (
      <>
        <PageHeading title={t.portfolio.profile} />
        <div className="narrow-page">
          <PhotographerForm />
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        title={t.portfolio.title}
        subtitle={t.portfolio.subtitle}
        action={<Action onClick={() => setOpen('portfolio')}>{t.portfolio.new}</Action>}
      />
      <QueryState query={list} empty={list.data?.length === 0} />
      <div className="project-grid">
        {list.data?.map((p) => (
          <Link className="portfolio-summary" key={p.id} to={`/portfolios/${p.id}?edit=1`}>
            <span className="eyebrow">{t.portfolio[p.status]}</span>
            <h2>{p.title}</h2>
            <p>{p.description}</p>
            <span>{t.genreLabels[p.genre as keyof typeof t.genreLabels]} ↗</span>
          </Link>
        ))}
      </div>
      <div className="section-header">
        <h2>{t.portfolio.services}</h2>
        <Action secondary onClick={() => setOpen('service')}>
          {t.studio.newService}
        </Action>
      </div>
      {services.data
        ?.filter((s) => s.ownerType === 'photographer')
        .map((s) => (
          <div className="list-row" key={s.id}>
            <h3>{s.name}</h3>
            <span>{currency(s.price)}</span>
          </div>
        ))}
      <AddOnForm services={services.data?.filter((s) => s.ownerType === 'photographer') ?? []} />
      {open === 'service' ? (
        <Modal title={t.studio.newService} onClose={() => setOpen(null)}>
          <ServiceForm onDone={() => setOpen(null)} />
        </Modal>
      ) : open === 'portfolio' ? (
        <Modal title={t.portfolio.new} onClose={() => setOpen(null)}>
          <Form onSubmit={() => create.mutate()}>
            <Field label={t.portfolio.name} value={title} onChange={setTitle} />
            <Area label={t.portfolio.description} value={description} onChange={setDescription} />
            <GenreSelect value={genre} onChange={setGenre} />
            <Select label={t.nav.studio} value={studio} onChange={setStudio}>
              <option value="">{t.portfolio.own}</option>
              {studios.data
                ?.filter((s) => s.role === 'manager')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Feedback error={create.error} />
            <Action type="submit" pending={create.isPending}>
              {t.create}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
export function PortfolioDetailPage() {
  const t = useStrings();
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const detail = useApi<{ portfolio: Portfolio; images: Image[] }>(`/v1/portfolios/${id}`);
  const own = useApi<Portfolio[]>('/v1/me/portfolios', Boolean(profile));
  const [caption, setCaption] = useState('');
  const [provenance, setProvenance] = useState('captured');
  const [status, setStatus] = useState('');
  const nav = useNavigate();
  const uploadTask = useTask(async (file: File) => {
    const result = await upload(file, 'portfolio-images', id);
    return post(`/v1/portfolios/${id}/images`, {
      storagePath: result.storagePath,
      caption: caption || file.name,
      provenance,
    });
  });
  const update = useTask(async () => {
    const p = detail.data!.portfolio;
    await patch(`/v1/portfolios/${id}`, {
      title: p.title,
      description: p.description,
      genre: p.genre,
      status: status || p.status,
    });
  });
  const remove = useTask(async () => {
    await api(`/v1/portfolios/${id}`, { method: 'DELETE' });
    nav('/portfolio');
  });
  const index = useTask(async (imageId: string) => post(`/v1/portfolio-images/${imageId}/index`));
  if (!detail.data) return <QueryState query={detail} />;
  const p = detail.data.portfolio;
  const canEdit = own.data?.some((row) => row.id === id);
  return (
    <>
      <PageHeading
        title={p.title}
        subtitle={p.description}
        action={<ReportButton targetType="portfolio" targetId={id} />}
      />
      {canEdit ? (
        <section className="panel">
          <div className="two-col">
            <div>
              <Field label={t.portfolio.caption} value={caption} onChange={setCaption} />
              <Select label={t.portfolio.provenance} value={provenance} onChange={setProvenance}>
                <option value="captured">{t.project.captured}</option>
                <option value="manipulated">{t.project.manipulated}</option>
                <option value="ai_generated">{t.project.aiGenerated}</option>
              </Select>
              <FilePicker
                label={t.portfolio.upload}
                onFile={(file) => uploadTask.mutate(file)}
                disabled={uploadTask.isPending}
              />
            </div>
            <div>
              <Select label={t.portfolio.status} value={status || p.status} onChange={setStatus}>
                <option value="draft">{t.portfolio.draft}</option>
                <option value="published">{t.portfolio.published}</option>
              </Select>
              <div className="row wrap">
                <Action pending={update.isPending} onClick={() => update.mutate()}>
                  {t.save}
                </Action>
                <Action secondary pending={remove.isPending} onClick={() => remove.mutate()}>
                  {t.delete}
                </Action>
              </div>
            </div>
          </div>
          <Feedback error={uploadTask.error ?? update.error ?? remove.error ?? index.error} />
        </section>
      ) : null}
      <div className="moodboard">
        {detail.data.images.map((i) => (
          <figure key={i.id}>
            <img src={i.url} alt={i.caption || p.title} />
            <figcaption>
              <Provenance value={i.provenance} />
              <p>{i.caption}</p>
              {canEdit ? (
                <button
                  className="text-button"
                  disabled={index.isPending}
                  onClick={() => index.mutate(i.id)}
                >
                  ✧ {t.portfolio.index}
                </button>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
