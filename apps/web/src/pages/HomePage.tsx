import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useQuery } from '@tanstack/react-query';

import { env } from '../lib/env';
import { fetchHealth } from '../lib/health';
import { strings } from '../strings';

export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(env.VITE_API_URL, signal),
    refetchInterval: 30000,
  });
  const message = health.isError
    ? strings.unavailable
    : health.isPending
      ? strings.pending
      : strings.connected;
  return (
    <main>
      <Stack gap={6} align="start">
        <Text className="eyebrow">{strings.eyebrow}</Text>
        <Card maxWidth={680} elevation="low">
          <Stack gap={4} align="start">
            <Heading level={1}>{strings.title}</Heading>
            <Text>{strings.introduction}</Text>
            <div
              role="status"
              aria-live="polite"
              data-health={health.isError ? 'error' : health.isPending ? 'loading' : 'success'}
            >
              <Text>{message}</Text>
            </div>
            <Button
              variant="primary"
              label={strings.retry}
              isDisabled={health.isFetching}
              onClick={() => {
                void health.refetch();
              }}
            />
          </Stack>
        </Card>
      </Stack>
    </main>
  );
}
