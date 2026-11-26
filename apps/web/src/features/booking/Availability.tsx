import { useState } from 'react';
import { Action, Feedback, NumberField, QueryState } from '../../components/ui';
import { patch } from '../../lib/api';
import { useApi, useTask } from '../../lib/hooks';
import { useLanguage, useStrings } from '../../lib/i18n';

type ProviderType = 'photographer' | 'studio';
export type AvailableSlot = { start: string; end: string; available: boolean };
const endpoint = (type: ProviderType, id: string) =>
  `/v1/${type === 'photographer' ? 'photographers' : 'studios'}/${id}`;

export function AvailabilitySetting({ type, id }: { type: ProviderType; id: string }) {
  const t = useStrings();
  const path = `${endpoint(type, id)}/availability-setting`;
  const setting = useApi<{ availabilityPublic: boolean }>(path);
  const update = useTask((enabled: boolean) => patch(path, { availabilityPublic: enabled }));
  return (
    <section className="panel">
      <h2>{t.workspaceUi.publicCalendar}</h2>
      <p>{t.workspaceUi.publicCalendarHelp}</p>
      <QueryState query={setting} />
      {setting.data && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={setting.data.availabilityPublic}
            disabled={update.isPending}
            onChange={(event) => update.mutate(event.target.checked)}
          />
          {t.workspaceUi.publicCalendar}
        </label>
      )}
      <Feedback error={update.error} />
    </section>
  );
}

export function Availability({
  type,
  id,
  onBook,
  onAsk,
}: {
  type: ProviderType;
  id: string;
  onBook?: (slot: AvailableSlot) => void;
  onAsk: (slot?: AvailableSlot) => void;
}) {
  const t = useStrings();
  const { language } = useLanguage();
  const [crew, setCrew] = useState(1);
  const query = useApi<{ availabilityPublic: boolean; slots: AvailableSlot[] }>(
    `${endpoint(type, id)}/availability?crew=${Math.min(20, Math.max(1, crew))}`,
  );
  const timeZone = 'Asia/Ho_Chi_Minh';
  const date = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone,
  });
  const time = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  return (
    <section className="profile-section">
      <h2>{t.workspaceUi.availabilityTitle}</h2>
      <QueryState query={query} />
      {query.data?.availabilityPublic === false && (
        <>
          <p className="muted">
            {type === 'photographer'
              ? t.workspaceUi.photographerCalendarPrivate
              : t.workspaceUi.studioCalendarPrivate}
          </p>
          <Action secondary onClick={() => onAsk()}>
            {t.workspaceUi.privateCalendar}
          </Action>
        </>
      )}
      {query.data?.availabilityPublic && (
        <>
          {type === 'studio' && (
            <NumberField label={t.photographer} min={1} max={20} value={crew} onChange={setCrew} />
          )}
          <p className="muted">UTC+7</p>
          <ul className="availability-slots">
            {query.data.slots.map((slot) => (
              <li key={slot.start} className="row wrap">
                <span>
                  {date.format(new Date(slot.start))} · {time.format(new Date(slot.start))}–
                  {time.format(new Date(slot.end))}
                </span>
                {slot.available ? (
                  <>
                    {onBook && (
                      <Action secondary onClick={() => onBook(slot)}>
                        {t.provider.book}
                      </Action>
                    )}
                    <Action secondary onClick={() => onAsk(slot)}>
                      {t.workspaceUi.askAboutSlot}
                    </Action>
                  </>
                ) : (
                  <span className="muted">{t.errors.slot_overlap}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
