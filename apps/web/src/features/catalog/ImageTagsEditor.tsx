import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type { Image, Portfolio, Tag } from '../../lib/types';
import { patch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useStrings } from '../../lib/i18n';
import { Action, Feedback, Modal } from '../../components/ui';
import { TagPicker } from './TagPicker';

export function ImageTagsEditor({ image, tags }: { image: Image; tags: Tag[] }) {
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const { id } = useParams();
  const { session } = useAuth();
  const client = useQueryClient();
  const queryKey = ['api', session?.user.id ?? 'public', `/v1/me/portfolios/${id}`];
  const save = useMutation({
    mutationFn: (tagIds: string[]) => patch(`/v1/portfolio-images/${image.id}/tags`, { tagIds }),
    onMutate: async (tagIds) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<{ portfolio: Portfolio; images: Image[] }>(queryKey);
      const optimisticTags = tags.filter((tag) => tagIds.includes(tag.id));
      client.setQueryData<{ portfolio: Portfolio; images: Image[] }>(
        queryKey,
        (data) =>
          data && {
            ...data,
            images: data.images.map((item) =>
              item.id === image.id ? { ...item, tags: optimisticTags } : item,
            ),
          },
      );
      return { previous, optimisticTags };
    },
    onError: (_error, _tagIds, context) => {
      client.setQueryData<{ portfolio: Portfolio; images: Image[] }>(
        queryKey,
        (data) =>
          data && {
            ...data,
            images: data.images.map((item) =>
              item.id === image.id &&
              JSON.stringify(item.tags?.map((tag) => tag.id)) ===
                JSON.stringify(context?.optimisticTags.map((tag) => tag.id))
                ? {
                    ...item,
                    tags: context?.previous?.images.find((old) => old.id === image.id)?.tags,
                  }
                : item,
            ),
          },
      );
    },
    onSuccess: () => setOpen(false),
    onSettled: () => client.invalidateQueries({ queryKey }),
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
        <Modal
          title={t.design.editTags}
          onClose={() => {
            if (!save.isPending) setOpen(false);
          }}
        >
          <TagPicker
            tags={tags}
            selected={selected}
            onChange={setSelected}
            disabled={save.isPending}
          />
          <Feedback error={save.error} />
          <Action
            pending={save.isPending}
            disabled={selected.length > 20}
            onClick={() => save.mutate(selected)}
          >
            {t.save}
          </Action>
        </Modal>
      ) : null}
    </>
  );
}
