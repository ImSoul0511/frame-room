import { post, RequestError, supabase } from '../../lib/api';
import { env } from '../../lib/env';

const chunkSize = 6 * 1024 * 1024;
type Ticket = { storagePath: string; token: string; mimeType: string };
export type DeliveryUpload = {
  file: File;
  ticket?: Ticket;
  uploadUrl?: URL;
  uploaded?: boolean;
};

export async function uploadDelivery(bookingId: string, transfer: DeliveryUpload) {
  const { file } = transfer;
  const path = `/v1/bookings/${bookingId}`;
  if (!supabase || !env.VITE_SUPABASE_URL) throw new RequestError(503, 'storage_not_configured');
  const ticket = (transfer.ticket ??= await post<Ticket>(`${path}/delivery-upload`, {
    fileName: file.name,
    size: file.size,
  }));
  if (!transfer.uploaded) {
    if (file.size > chunkSize) await uploadChunks(env.VITE_SUPABASE_URL, transfer, ticket);
    else {
      const { error } = await supabase.storage
        .from('deliveries')
        .uploadToSignedUrl(
          ticket.storagePath,
          ticket.token,
          file.slice(0, file.size, ticket.mimeType),
          { contentType: ticket.mimeType },
        );
      if (error) throw new RequestError(422, 'upload_failed');
    }
    transfer.uploaded = true;
  }
  return post(`${path}/deliveries`, {
    storagePath: ticket.storagePath,
    fileName: file.name,
    size: file.size,
  });
}

async function uploadChunks(base: string, transfer: DeliveryUpload, ticket: Ticket) {
  const { file } = transfer;
  const endpoint = new URL('/storage/v1/upload/resumable', base);
  if (/^[a-z0-9]+\.supabase\.co$/.test(endpoint.hostname))
    endpoint.hostname = endpoint.hostname.replace('.supabase.co', '.storage.supabase.co');
  const headers = { 'Tus-Resumable': '1.0.0', 'x-signature': ticket.token };
  let offset = 0;
  try {
    if (transfer.uploadUrl) {
      const status = await fetch(transfer.uploadUrl, { method: 'HEAD', headers });
      if ([401, 403, 404, 410].includes(status.status)) {
        transfer.uploadUrl = undefined;
        transfer.ticket = undefined;
        throw new RequestError(422, 'upload_failed');
      }
      const remoteOffset = status.headers.get('Upload-Offset');
      if (!status.ok || remoteOffset === null) throw new RequestError(422, 'upload_failed');
      offset = Number(remoteOffset);
    } else {
      const metadata = {
        bucketName: 'deliveries',
        objectName: ticket.storagePath,
        contentType: ticket.mimeType,
        cacheControl: '0',
      };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Upload-Length': String(file.size),
          'Upload-Metadata': Object.entries(metadata)
            .map(([key, value]) => `${key} ${btoa(value)}`)
            .join(','),
        },
      });
      const location = response.headers.get('Location');
      if (!response.ok || !location) throw new RequestError(422, 'upload_failed');
      const url = new URL(location, endpoint);
      if (url.origin !== endpoint.origin) throw new RequestError(422, 'upload_failed');
      transfer.uploadUrl = url;
    }
    if (!Number.isInteger(offset) || offset < 0 || offset > file.size)
      throw new RequestError(422, 'upload_failed');
    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const response = await fetch(transfer.uploadUrl, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: file.slice(offset, end),
      });
      if (!response.ok || Number(response.headers.get('Upload-Offset')) !== end)
        throw new RequestError(422, 'upload_failed');
      offset = end;
    }
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(422, 'upload_failed');
  }
}
