-- 1. Vector Index (HNSW) tăng tốc tìm kiếm ảnh tương tự trên image_embeddings
create index idx_image_embeddings_hnsw
  on public.image_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- 2. Partial Index cho reviews giúp view public.providers tính rating_avg & review_count nhanh hơn
create index idx_reviews_photographer_active
  on public.reviews(photographer_id)
  where photographer_id is not null and not is_hidden and deleted_at is null;

create index idx_reviews_studio_active
  on public.reviews(studio_id)
  where studio_id is not null and not is_hidden and deleted_at is null;

-- 3. Index cho schedule_entries theo booking_id (tăng tốc reserve_booking & frameroom_transition)
create index idx_schedule_entries_booking
  on public.schedule_entries(booking_id)
  where booking_id is not null;

-- 4. Index cho ai_usage theo (user_id, created_at) (tăng tốc kiểm tra giới hạn AI 24h)
create index idx_ai_usage_user_daily
  on public.ai_usage(user_id, created_at)
  where status <> 'released';

-- 5. Index cho các khóa ngoại hay dùng để JOIN / lọc dữ liệu
create index idx_gallery_images_gallery on public.gallery_images(gallery_id);
create index idx_deliveries_booking_round on public.deliveries(booking_id, selection_round);
create index idx_service_add_ons_service on public.service_add_ons(service_id);
create index idx_booking_add_ons_addon on public.booking_add_ons(add_on_id);

-- 6. Tối ưu RLS Policy: bọc (select auth.uid()) để Postgres chỉ đánh giá 1 lần mỗi truy vấn
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists roles_read on public.user_roles;
create policy roles_read on public.user_roles
  for select
  using (user_id = (select auth.uid()));