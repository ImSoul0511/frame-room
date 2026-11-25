-- Existing objects remain readable while the media:webp command converts their bytes.
update storage.buckets set allowed_mime_types = array['image/webp'] where id = 'deliveries';
