import { z } from 'zod';

const photographerSchema = z.object({
  id: z.string().uuid(),
  is_hidden: z.boolean(),
  display_name: z.string().optional(),
});
const personSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  user_name: z.string(),
  avatar_path: z.string().nullable().optional(),
  photographers: z.union([photographerSchema, z.array(photographerSchema)]).nullable(),
});

export function parsePeople(value: unknown) {
  const result = z.array(personSchema).safeParse(value);
  if (!result.success) return null;
  return result.data.map((person) => {
    const photographers = Array.isArray(person.photographers)
      ? person.photographers
      : person.photographers
        ? [person.photographers]
        : [];
    const photographer = photographers.find((item) => !item.is_hidden);
    return {
      id: person.id,
      displayName: photographer?.display_name ?? person.display_name,
      userName: person.user_name,
      avatarPath: person.avatar_path ?? null,
      photographerId: photographer?.id ?? null,
    };
  });
}
