import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Card, Heading, Stack, Text } from '@astryxdesign/core';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import './styles.css';

function App() {
  return (
    <Theme theme={neutralTheme}>
      <main>
        <Stack gap={6} align="start">
          <Text className="eyebrow">FrameRoom · Sprint 0</Text>
          <Card maxWidth={680} elevation="low">
            <Stack gap={4} align="start">
              <Heading level={1}>Khám phá. Cộng tác. Tạo nên câu chuyện.</Heading>
              <Text>Frontend foundation đã sẵn sàng với Astryx Design System.</Text>
              <Button variant="primary" label="Bắt đầu khám phá" />
            </Stack>
          </Card>
        </Stack>
      </main>
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
