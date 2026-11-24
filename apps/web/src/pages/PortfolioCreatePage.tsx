import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { portfolioInputSchema } from '@frameroom/shared';
import {
  Action,
  Area,
  Feedback,
  Field,
  Form,
  GenreSelect,
  PageHeading,
  QueryState,
  Select,
} from '../components/ui';
import { post } from '../lib/api';
import { useApi, useTask } from '../lib/hooks';
import { useStrings } from '../lib/i18n';
import type { Portfolio, Studio } from '../lib/types';

export function PortfolioCreatePage() {
  const t = useStrings();
  const navigate = useNavigate();
  const studios = useApi<Studio[]>('/v1/me/studios');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('portrait');
  const [studio, setStudio] = useState('');
  const create = useTask(async () => {
    const input = portfolioInputSchema.parse({ title, description, genre, status: 'draft' });
    const portfolio = await post<Portfolio>(
      studio ? `/v1/studios/${studio}/portfolios` : '/v1/portfolios',
      input,
    );
    navigate(`/portfolios/${portfolio.id}?edit=1`);
  });

  return (
    <>
      <PageHeading
        title={t.portfolio.new}
        action={
          <Link className="button-link" to="/portfolio">
            {t.back}
          </Link>
        }
      />
      {studios.isPending || studios.error ? <QueryState query={studios} /> : null}
      {studios.isSuccess ? (
        <section className="portfolio-create-panel">
          <Form
            onSubmit={() => {
              if (!create.isPending && title.trim()) create.mutate();
            }}
          >
            <Field label={t.portfolio.name} value={title} onChange={setTitle} required />
            <Area label={t.portfolio.description} value={description} onChange={setDescription} />
            <GenreSelect value={genre} onChange={setGenre} />
            <Select label={t.nav.studio} value={studio} onChange={setStudio}>
              <option value="">{t.portfolio.own}</option>
              {studios.data
                .filter((item) => item.role === 'manager')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
            <Feedback error={create.error} />
            <Action type="submit" pending={create.isPending} disabled={!title.trim()}>
              {t.create}
            </Action>
          </Form>
        </section>
      ) : null}
    </>
  );
}
