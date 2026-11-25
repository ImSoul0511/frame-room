import type { Portfolio } from '../../lib/types';
import { MediaCard } from './MediaCard';

export function PortfolioCard({ portfolio, edit }: { portfolio: Portfolio; edit?: boolean }) {
  return (
    <MediaCard
      portfolio={portfolio}
      title={portfolio.title}
      description={portfolio.description}
      image={portfolio.coverUrl}
      edit={edit}
    />
  );
}
