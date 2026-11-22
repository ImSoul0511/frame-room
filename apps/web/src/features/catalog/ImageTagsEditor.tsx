import { useState } from 'react';
import type { Image, Tag } from '../../lib/types';
import { patch } from '../../lib/api';
import { useTask } from '../../lib/hooks';
import { useStrings } from '../../lib/i18n';
import { Action, Feedback, Modal } from '../../components/ui';
import { TagPicker } from './TagPicker';

export function ImageTagsEditor({ image, tags }: { image: Image; tags: Tag[] }) {
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const save = useTask(async () => {
    await patch(`/v1/portfolio-images/${image.id}/tags`, { tagIds: selected });
    setOpen(false);
  });
  return (
    <>
      <button
        className="text-button"
        onClick={() => {
          setSelected(image.tags?.map((tag) => tag.id) ?? []);
          setOpen(true);
        }}
      >
        {t.design.editTags}
      </button>
      {open ? (
        <Modal title={t.design.editTags} onClose={() => setOpen(false)}>
          <TagPicker tags={tags} selected={selected} onChange={setSelected} />
          <Feedback error={save.error} />
          <Action
            pending={save.isPending}
            disabled={selected.length > 20}
            onClick={() => save.mutate()}
          >
            {t.save}
          </Action>
        </Modal>
      ) : null}
    </>
  );
}
