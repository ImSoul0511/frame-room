import { Action, Feedback } from '../../components/ui';
import { api, RequestError, supabase } from '../../lib/api';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';

export function MessageAttachment({ messageId }: { messageId: string }) {
  const t = useStrings();
  const download = useTask(async () => {
    const { bucket, storagePath } = await api<{ bucket: string; storagePath: string }>(
      `/v1/conversation-messages/${messageId}/file`,
    );
    if (!supabase) throw new RequestError(503, 'storage_not_configured');
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !data) throw new RequestError(404, 'not_found');
    const blob = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = blob;
    link.download = storagePath.split('/').at(-1) ?? 'reference.webp';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blob), 1000);
  });
  return (
    <>
      <Action secondary pending={download.isPending} onClick={() => download.mutate()}>
        {t.project.reference}
      </Action>
      <Feedback error={download.error} />
    </>
  );
}
