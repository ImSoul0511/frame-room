import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Service } from '@frameroom/shared';
import type { Portfolio, Image, Tag } from '../lib/types';
import { api, post, patch, upload, currency } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import {
  Action,
  Feedback,
  Field,
  FilePicker,
  Modal,
  PageHeading,
  Provenance,
  QueryState,
  Select,
} from '../components/ui';
import { PhotographerForm, ServiceForm } from '../features/catalog/ProviderForms';
import { ReportButton } from './SettingsPage';
import { PhotoGallery } from '../features/profiles/PhotoGallery';
import { TagPicker } from '../features/catalog/TagPicker';
import { ImageTagsEditor } from '../features/catalog/ImageTagsEditor';
import { FittedImage } from '../components/FittedImage';

export function PortfolioPage() {
  const t = useStrings();
  const { profile } = useAuth();
  const list = useApi<Portfolio[]>('/v1/me/portfolios');
  const services = useApi<Service[]>('/v1/me/services');
  const [open, setOpen] = useState(false);
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
        action={
          <Link className="button-link dark" to="/portfolio/new">
            {t.portfolio.new}
          </Link>
        }
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
        <Action secondary onClick={() => setOpen(true)}>
          {t.studio.newService}
        </Action>
      </div>
      <QueryState
        query={services}
        empty={services.data?.every((s) => s.ownerType !== 'photographer')}
      />
      <div className="owned-service-grid">
        {services.data
          ?.filter((s) => s.ownerType === 'photographer')
          .map((s) => (
            <article className="owned-service-card" key={s.id}>
              <div className="owned-service-card-heading">
                <h3>{s.name}</h3>
                <span className="owned-service-status">
                  {s.isActive ? t.studio.active : t.studio.inactive}
                </span>
              </div>
              {s.description ? <p>{s.description}</p> : null}
              <div className="owned-service-details">
                <strong>{currency(s.price)}</strong>
                <span>
                  {t.studio.duration}: {s.durationMinutes}
                </span>
              </div>
              <Link className="button-link" to={`/portfolio/services/${s.id}/edit`}>
                {t.workspaceUi.edit}
              </Link>
            </article>
          ))}
      </div>
      {open ? (
        <Modal title={t.studio.newService} onClose={() => setOpen(false)}>
          <ServiceForm onDone={() => setOpen(false)} />
        </Modal>
      ) : null}
    </>
  );
}
export function PortfolioDetailPage() {
  const t = useStrings();
  const { id = '' } = useParams();
  const { profile, session } = useAuth();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const canEdit = Boolean(profile && params.get('edit') === '1');
  const detail = useApi<{ portfolio: Portfolio; images: Image[] }>(
    `/v1/${canEdit ? 'me/' : ''}portfolios/${id}`,
  );
  const availableTags = useApi<Tag[]>('/v1/tags', canEdit);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [credits, setCredits] = useState('');
  const [caption, setCaption] = useState('');
  const [provenance, setProvenance] = useState('captured');
  const [status, setStatus] = useState<'' | Portfolio['status']>('');
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const uploaded = useRef<{ file: File; storagePath: string } | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const nav = useNavigate();
  const uploadTask = useTask(async (file: File) => {
    const result =
      uploaded.current?.file === file
        ? uploaded.current
        : await upload(file, 'portfolio-images', id);
    uploaded.current = { file, storagePath: result.storagePath };
    return post(`/v1/portfolios/${id}/images`, {
      storagePath: result.storagePath,
      caption: caption || file.name,
      provenance,
      tagIds,
      crewCredits: credits,
    });
  });
  const update = useTask(async () => {
    const p = detail.data!.portfolio;
    const input = {
      title: p.title,
      description: p.description,
      genre: p.genre,
      status: status || p.status,
    };
    const key = ['api', session?.user.id ?? 'public', '/v1/me/portfolios'];
    await client.cancelQueries({ queryKey: key });
    const previous = client.getQueryData<Portfolio[]>(key)?.find((item) => item.id === id);
    client.setQueryData<Portfolio[]>(key, (items) =>
      items?.map((item) => (item.id === id ? { ...item, status: input.status } : item)),
    );
    try {
      await patch(`/v1/portfolios/${id}`, input);
    } catch (error) {
      client.setQueryData<Portfolio[]>(key, (items) =>
        items?.map((item) =>
          item.id === id && item.status === input.status && previous ? previous : item,
        ),
      );
      await client.invalidateQueries({ queryKey: key });
      throw error;
    }
  });
  const remove = useTask(async () => {
    await api(`/v1/portfolios/${id}`, { method: 'DELETE' });
    nav('/portfolio');
  });
  if (!detail.data) return <QueryState query={detail} />;
  const p = detail.data.portfolio;
  return (
    <>
      <PageHeading
        title={p.title}
        subtitle={p.description}
        action={canEdit ? null : <ReportButton targetType="portfolio" targetId={id} />}
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
              <Field label={t.workspaceUi.credits} value={credits} onChange={setCredits} />
              <QueryState query={availableTags} />
              <TagPicker tags={availableTags.data ?? []} selected={tagIds} onChange={setTagIds} />
              <FilePicker
                label={t.portfolio.upload}
                onFile={(file) => {
                  uploaded.current = null;
                  setPreview({ file, url: URL.createObjectURL(file) });
                  uploadTask.mutate(file, {
                    onSuccess: () => {
                      uploaded.current = null;
                      setPreview(null);
                    },
                  });
                }}
                disabled={uploadTask.isPending}
              />
              {preview ? (
                <figure>
                  <img
                    src={preview.url}
                    alt={preview.file.name}
                    style={{ maxWidth: '100%', maxHeight: 240 }}
                  />
                  <figcaption role="status">
                    {uploadTask.isError
                      ? t.messaging.imageUploadFailed
                      : t.messaging.imageUploading}
                  </figcaption>
                  {uploadTask.isError ? (
                    <Action
                      secondary
                      onClick={() =>
                        uploadTask.mutate(preview.file, {
                          onSuccess: () => {
                            uploaded.current = null;
                            setPreview(null);
                          },
                        })
                      }
                    >
                      {t.retry}
                    </Action>
                  ) : null}
                </figure>
              ) : null}
            </div>
            <div>
              <Select
                label={t.portfolio.status}
                value={status || p.status}
                onChange={(value) => setStatus(value as Portfolio['status'])}
              >
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
          <Feedback error={uploadTask.error ?? update.error ?? remove.error} />
        </section>
      ) : null}
      <div className="gallery-heading">
        <p className="eyebrow">{t.genreLabels[p.genre as keyof typeof t.genreLabels]}</p>
        <span className="muted">
          {detail.data.images.length} {t.profileUi.photos}
        </span>
      </div>
      {!canEdit ? (
        <PhotoGallery photos={detail.data.images} />
      ) : (
        <div className="moodboard">
          {detail.data.images.map((i) => (
            <figure key={i.id}>
              <FittedImage src={i.url} alt={i.caption || p.title} loading="lazy" decoding="async" />
              <figcaption>
                <Provenance value={i.provenance} />
                <p>{i.caption}</p>
                {i.crewCredits ? (
                  <p>
                    {t.workspaceUi.credits} · {i.crewCredits}
                  </p>
                ) : null}
                {i.tags?.length ? <p>{i.tags.map((tag) => tag.name).join(' · ')}</p> : null}
                <ImageTagsEditor image={i} tags={availableTags.data ?? []} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
