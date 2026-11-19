import { useState } from 'react';
import { Action, Area, Feedback, Form, Modal, Select } from '../../components/ui';
import { useStrings } from '../../lib/i18n';
import { useDemo, useDemoTask } from './DemoContext';
import { isPhotographer } from './permissions';
import type { DemoReport } from './types';

export function DemoReportButton({
  targetType,
  targetId,
  title = '',
}: {
  targetType: DemoReport['targetType'];
  targetId: string;
  title?: string;
}) {
  const demo = useDemo();
  const t = useStrings();
  const task = useDemoTask();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('copyright');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  if (demo.role !== 'client' && !isPhotographer(demo.role)) return null;
  return (
    <>
      <button
        className="text-button report-link"
        onClick={() => {
          setOpen(true);
          setSent(false);
          task.clear();
        }}
      >
        {t.demo.report}
      </button>
      {open ? (
        <Modal title={t.demo.report} onClose={() => setOpen(false)}>
          <Form
            onSubmit={() => {
              if (
                task.execute({
                  type: 'report',
                  id: crypto.randomUUID(),
                  target: targetId,
                  targetType,
                  title: title || targetId,
                  reason,
                  details,
                })
              )
                setSent(true);
            }}
          >
            <p className="muted">{title}</p>
            <Select label={t.demo.reportReason} value={reason} onChange={setReason}>
              {Object.entries(t.reportReasons).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </Select>
            <Area label={t.demo.details} value={details} onChange={setDetails} />
            <Feedback error={task.error} success={sent ? t.demo.reportSent : null} />
            <Action type="submit" disabled={sent}>
              {t.demo.report}
            </Action>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
