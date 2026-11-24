import { TextArea } from '@astryxdesign/core/TextArea';
import { Action, Feedback, FilePicker } from '../../components/ui';
import { useStrings } from '../../lib/i18n';

export function MessageComposer({
  text,
  attachment,
  isSending,
  isUploading,
  error,
  onTextChange,
  onRemoveAttachment,
  onFile,
  onSubmit,
}: {
  text: string;
  attachment: string | null;
  isSending: boolean;
  isUploading: boolean;
  error: Error | null;
  onTextChange: (value: string) => void;
  onRemoveAttachment: () => void;
  onFile: (image: File) => void;
  onSubmit: () => void;
}) {
  const t = useStrings();
  return (
    <form
      className="messenger-composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLTextAreaElement &&
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          onSubmit();
        }
      }}
    >
      <TextArea
        label={t.booking.messages}
        isLabelHidden
        isDisabled={isSending}
        rows={2}
        value={text}
        onChange={onTextChange}
        placeholder={t.messaging.typeMessage}
        containerClassName="messenger-composer-field"
        controlClassName="messenger-composer-control"
      />
      <small className="messenger-composer-hint">{t.messaging.enterToSend}</small>
      {attachment ? (
        <div className="messenger-attachment-ready">
          <span>{t.explore.referenceReady}</span>
          <button
            className="messenger-remove-attachment"
            type="button"
            onClick={onRemoveAttachment}
          >
            {t.delete}
          </button>
        </div>
      ) : null}
      <div className="messenger-composer-actions">
        <FilePicker
          label={t.project.addReference}
          onFile={onFile}
          disabled={isUploading || isSending}
        />
        <Action
          type="submit"
          pending={isSending}
          disabled={isUploading || (!text.trim() && !attachment)}
        >
          {t.booking.send}
        </Action>
      </div>
      <Feedback error={error} />
    </form>
  );
}
