import type { CreativeProject } from '@frameroom/shared';
import type { Transaction } from './database.js';
import { ApiError } from '../lib/errors.js';

const projection = 'p.*, b.id as booking_id';
export async function findProject(
  tx: Transaction,
  id: string,
  lock = false,
): Promise<CreativeProject> {
  const row = await tx.optional<CreativeProject>(
    `select ${projection} from creative_projects p left join bookings b on b.project_id=p.id where p.id=$1 and private.can_read_project(p.id)${lock ? ' for update of p' : ''}`,
    [id],
  );
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'project_not_found');
  return row;
}
export function listProjects(tx: Transaction) {
  return tx.rows<CreativeProject>(
    `select ${projection} from creative_projects p left join bookings b on b.project_id=p.id where private.can_read_project(p.id) order by p.updated_at desc,p.id limit 100`,
  );
}
export function insertProject(tx: Transaction, userId: string, title: string, idea: string) {
  return tx.one<CreativeProject>(
    'insert into creative_projects(owner_id,title,idea) values($1,$2,$3) returning *,null::uuid as booking_id',
    [userId, title, idea],
  );
}
