import type { Profile, photographerInputSchema, profileInputSchema } from '@frameroom/shared';
import type { z } from 'zod';

import { ApiError } from '../lib/errors.js';
import type { Transaction } from '../repositories/database.js';
import * as profiles from '../repositories/profiles.js';
import type { OwnPhotographer } from '../schemas/own-photographer.js';

type ProfileInput = z.output<typeof profileInputSchema>;
type PhotographerInput = z.output<typeof photographerInputSchema>;

const profileRequired = () => new ApiError(404, 'NOT_FOUND', 'profile_required');

/** Read-only: a missing profile is reported, never created implicitly. */
export async function getOwnProfile(tx: Transaction, userId: string): Promise<Profile> {
  const profile = await profiles.findProfile(tx, userId);
  if (!profile) throw profileRequired();
  return profile;
}

/**
 * Creates the caller's profile. A retry by the same user returns the existing profile and
 * ignores the new input, so a lost response cannot rename the account.
 */
export async function createOwnProfile(
  tx: Transaction,
  userId: string,
  input: ProfileInput,
): Promise<{ profile: Profile; created: boolean }> {
  await profiles.lockUser(tx, userId);
  const existing = await profiles.findProfile(tx, userId);
  if (existing) return { profile: existing, created: false };
  // A competing normalized username raises a unique violation, mapped to 409 user_name_taken.
  await profiles.insertProfile(tx, userId, input);
  return { profile: await getOwnProfile(tx, userId), created: true };
}

export async function updateOwnProfile(
  tx: Transaction,
  userId: string,
  input: ProfileInput,
): Promise<Profile> {
  if (!(await profiles.updateProfile(tx, userId, input))) throw profileRequired();
  return getOwnProfile(tx, userId);
}

export async function getOwnPhotographer(
  tx: Transaction,
  userId: string,
): Promise<OwnPhotographer | null> {
  return (await profiles.findPhotographer(tx, userId)) ?? null;
}

export async function createOwnPhotographer(
  tx: Transaction,
  userId: string,
  input: PhotographerInput,
): Promise<OwnPhotographer> {
  await getOwnProfile(tx, userId);
  // A second row for the same user violates the unique user_id and maps to 409.
  return profiles.insertPhotographer(tx, userId, input);
}

export async function updateOwnPhotographer(
  tx: Transaction,
  userId: string,
  input: PhotographerInput,
): Promise<OwnPhotographer> {
  const photographer = await profiles.updatePhotographer(tx, userId, input);
  if (!photographer) throw new ApiError(404, 'NOT_FOUND', 'not_found');
  return photographer;
}
