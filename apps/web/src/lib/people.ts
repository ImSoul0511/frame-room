import { z } from 'zod';

const photographerSchema = z.object({ id: z.string().uuid(), is_hidden: z.boolean() });
const personSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  user_name: z.string(),
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
    return {
      id: person.id,
      displayName: person.display_name,
      userName: person.user_name,
      photographerId: photographers.find((photographer) => !photographer.is_hidden)?.id ?? null,
    };
  });
}
