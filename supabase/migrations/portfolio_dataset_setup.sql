-- FrameRoom demo portfolio, tag, and gallery setup.
-- Idempotent. Removes unused columns from earlier drafts and keeps the existing tag/image relations.
-- Run only after reviewing that the target is the intended Supabase project.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.portfolios') IS NULL
     OR to_regclass('public.photographers') IS NULL
     OR to_regclass('public.portfolio_images') IS NULL
     OR to_regclass('public.tags') IS NULL
     OR to_regclass('public.image_tags') IS NULL
     OR to_regclass('public.gallery_images') IS NULL THEN
    RAISE EXCEPTION 'Expected FrameRoom portfolio, tag, and gallery tables were not found';
  END IF;
END;
$$;

-- Remove unused draft columns. Original image tags are stored through tags + image_tags instead.
ALTER TABLE public.portfolio_images
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS collected_at,
  DROP COLUMN IF EXISTS license_note,
  DROP COLUMN IF EXISTS original_tags,
  DROP COLUMN IF EXISTS source_provider,
  DROP COLUMN IF EXISTS source_asset_id,
  DROP COLUMN IF EXISTS source_page_url,
  DROP COLUMN IF EXISTS source_author,
  DROP COLUMN IF EXISTS source_author_url,
  DROP COLUMN IF EXISTS license_code,
  DROP COLUMN IF EXISTS license_url,
  DROP COLUMN IF EXISTS content_sha256,
  DROP COLUMN IF EXISTS source_tags;

ALTER TABLE public.image_tags
  DROP COLUMN IF EXISTS assignment_scope;

ALTER TABLE public.tags
  DROP COLUMN IF EXISTS parent_id,
  DROP COLUMN IF EXISTS is_seed;

ALTER TABLE public.gallery_images
  DROP COLUMN IF EXISTS similarity_group_source,
  DROP COLUMN IF EXISTS similarity_group_model,
  DROP COLUMN IF EXISTS similarity_group_confidence;

-- Stable keys make the importer idempotent and let demo portfolios be identified safely.
ALTER TABLE public.portfolios
  DROP COLUMN IF EXISTS is_demo;

ALTER TABLE public.photographers
  DROP COLUMN IF EXISTS is_demo;

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS dataset_key text;

CREATE UNIQUE INDEX IF NOT EXISTS portfolios_dataset_key_uidx
  ON public.portfolios (dataset_key);

-- Keep the existing TagKind enum for compatibility, and add a more useful searchable category.
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS name_vi text,
  ADD COLUMN IF NOT EXISTS definition_en text,
  ADD COLUMN IF NOT EXISTS definition_vi text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.tags
SET category = CASE kind::text
  WHEN 'tone' THEN 'color_tone'
  WHEN 'setting' THEN 'setting'
  ELSE 'mood'
END
WHERE category IS NULL;

ALTER TABLE public.tags
  ALTER COLUMN category SET DEFAULT 'mood',
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_category_check;
ALTER TABLE public.tags
  ADD CONSTRAINT tags_category_check CHECK (category IN (
    'genre', 'subject', 'setting', 'lighting', 'color_tone',
    'mood', 'composition', 'style', 'editing', 'styling', 'source'
  ));

CREATE INDEX IF NOT EXISTS tags_category_slug_idx
  ON public.tags (category, slug);
CREATE INDEX IF NOT EXISTS tags_aliases_gin_idx
  ON public.tags USING gin (aliases);

DO $$
DECLARE
  source_check record;
BEGIN
  FOR source_check IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.image_tags'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source%'
      AND pg_get_constraintdef(oid) ILIKE '%manual%'
  LOOP
    EXECUTE format('ALTER TABLE public.image_tags DROP CONSTRAINT %I', source_check.conname);
  END LOOP;
  ALTER TABLE public.image_tags
    ADD CONSTRAINT image_tags_source_check CHECK (source IN ('manual', 'ai', 'metadata'));
END;
$$;

-- A stable order and optional similarity key support grouped booking proofing.
ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS similarity_group_key text;

CREATE INDEX IF NOT EXISTS gallery_images_group_order_idx
  ON public.gallery_images (gallery_id, similarity_group_key, sort_order);

-- Portfolio images are public demo content; set the importer bucket to the expected upload limits.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-images',
  'portfolio-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- kind remains the legacy API grouping (tone / setting / mood).
-- category and aliases carry the detailed bilingual taxonomy for future search and labeling.
WITH seed(slug, name, kind_name, category, name_vi, definition_en, definition_vi, aliases) AS (
  VALUES
    ('portrait', 'Portrait', 'setting', 'genre', 'Chân dung', 'A portrait-focused photographic genre.', 'Thể loại tập trung vào chân dung.', 'headshot|portrait photography'),
    ('fashion', 'Fashion', 'setting', 'genre', 'Thời trang', 'Fashion, lookbook, or style-led photography.', 'Ảnh thời trang, lookbook hoặc tập trung vào phong cách.', 'editorial fashion|lookbook'),
    ('wedding', 'Wedding', 'setting', 'genre', 'Ảnh cưới', 'Wedding-day or wedding-editorial photography.', 'Ảnh ngày cưới hoặc ảnh cưới theo hướng editorial.', 'bridal|marriage'),
    ('family', 'Family', 'setting', 'genre', 'Gia đình', 'Family and group portrait photography.', 'Ảnh chân dung gia đình hoặc nhóm.', 'family portrait'),
    ('product', 'Product', 'setting', 'genre', 'Sản phẩm', 'Photography focused on a product or commercial object.', 'Ảnh tập trung vào sản phẩm hoặc vật thể thương mại.', 'product photo|still life'),
    ('food', 'Food', 'setting', 'genre', 'Ẩm thực', 'Food, drink, or culinary editorial photography.', 'Ảnh món ăn, đồ uống hoặc editorial ẩm thực.', 'food photo|culinary'),
    ('event', 'Event', 'setting', 'genre', 'Sự kiện', 'Event, performance, or documentary coverage.', 'Ảnh sự kiện, trình diễn hoặc phóng sự.', 'live event|concert'),
    ('cosplay', 'Cosplay', 'setting', 'genre', 'Cosplay', 'Costume and character interpretation photography.', 'Ảnh hóa trang và diễn giải nhân vật.', 'costume portrait|character photography'),

    ('person', 'Person', 'setting', 'subject', 'Con người', 'A person is the main visible subject.', 'Con người là chủ thể chính trong ảnh.', 'people|human subject'),
    ('couple', 'Couple', 'setting', 'subject', 'Cặp đôi', 'Two people presented as a couple or pair.', 'Hai người được thể hiện như một cặp đôi hoặc một cặp.', 'pair|duo'),
    ('group', 'Group', 'setting', 'subject', 'Nhóm người', 'Three or more people are visible together.', 'Có từ ba người trở lên xuất hiện cùng nhau.', 'team|group portrait'),
    ('product-subject', 'Product subject', 'setting', 'subject', 'Chủ thể sản phẩm', 'A commercial product is the main visible subject.', 'Sản phẩm thương mại là chủ thể chính trong ảnh.', 'object|merchandise'),
    ('food-subject', 'Food subject', 'setting', 'subject', 'Chủ thể món ăn', 'Prepared food or drink is the main visible subject.', 'Món ăn hoặc đồ uống là chủ thể chính trong ảnh.', 'dish|beverage'),
    ('landscape-subject', 'Landscape subject', 'setting', 'subject', 'Cảnh quan', 'A landscape or natural environment is the main subject.', 'Cảnh quan hoặc môi trường tự nhiên là chủ thể chính.', 'scenery|landscape'),
    ('pet', 'Pet', 'setting', 'subject', 'Thú cưng', 'A companion animal is a visible subject.', 'Động vật nuôi xuất hiện như một chủ thể.', 'companion animal'),

    ('studio', 'Studio', 'setting', 'setting', 'Studio', 'A controlled indoor photo studio.', 'Không gian studio trong nhà có kiểm soát.', 'photo studio|backdrop'),
    ('outdoor', 'Outdoor', 'setting', 'setting', 'Ngoài trời', 'The image was made in an outdoor environment.', 'Ảnh được chụp trong môi trường ngoài trời.', 'outside|open air'),
    ('nature', 'Nature', 'setting', 'setting', 'Thiên nhiên', 'Natural scenery or vegetation is visibly important.', 'Cảnh quan hoặc cây cối tự nhiên là yếu tố nổi bật.', 'natural setting|greenery'),
    ('urban', 'Urban', 'setting', 'setting', 'Đô thị', 'A built-up city environment is visible.', 'Có thể thấy bối cảnh đô thị xây dựng.', 'city|built environment'),
    ('home', 'Home', 'setting', 'setting', 'Không gian nhà', 'A domestic interior or home-like setting.', 'Không gian nội thất gia đình hoặc bối cảnh giống nhà.', 'domestic|interior'),
    ('garden', 'Garden', 'setting', 'setting', 'Vườn', 'A garden or landscaped green space is visible.', 'Có thể thấy khu vườn hoặc không gian xanh được quy hoạch.', 'green space|park garden'),
    ('beach', 'Beach', 'setting', 'setting', 'Bãi biển', 'A shoreline or beach environment is visible.', 'Có thể thấy bờ biển hoặc bãi biển.', 'seaside|shore'),
    ('forest', 'Forest', 'setting', 'setting', 'Rừng', 'A wooded or forest environment is visible.', 'Có thể thấy bối cảnh nhiều cây hoặc rừng.', 'woodland|woods'),
    ('street', 'Street', 'setting', 'setting', 'Đường phố', 'A public street or sidewalk is central to the scene.', 'Đường phố hoặc vỉa hè là phần chính của khung cảnh.', 'sidewalk|street scene'),

    ('natural-light', 'Natural light', 'tone', 'lighting', 'Ánh sáng tự nhiên', 'Daylight is the primary light source.', 'Ánh sáng ban ngày là nguồn sáng chính.', 'daylight|available light|ánh sáng trời'),
    ('soft-window-light', 'Soft window light', 'tone', 'lighting', 'Ánh sáng cửa sổ mềm', 'Soft daylight enters through a nearby window.', 'Ánh sáng ban ngày dịu đi qua cửa sổ gần đó.', 'window light|soft daylight|ánh sáng cửa sổ'),
    ('diffused-light', 'Diffused light', 'tone', 'lighting', 'Ánh sáng tán xạ', 'Light is softened by clouds, diffusion, or a large source.', 'Ánh sáng được làm mềm bởi mây, vật tán sáng hoặc nguồn sáng lớn.', 'overcast light|soft light'),
    ('golden-hour', 'Golden hour', 'tone', 'lighting', 'Giờ vàng', 'Warm directional light near sunrise or sunset.', 'Ánh sáng định hướng ấm vào gần lúc bình minh hoặc hoàng hôn.', 'sunset light|sunrise light|hoàng hôn'),
    ('harsh-sun', 'Harsh sun', 'tone', 'lighting', 'Nắng gắt', 'Direct sun creates hard-edged shadows or bright highlights.', 'Nắng trực tiếp tạo bóng cứng hoặc vùng sáng mạnh.', 'direct sunlight|hard sunlight'),
    ('backlit', 'Backlit', 'tone', 'lighting', 'Ngược sáng', 'The main light is behind the subject or toward the camera.', 'Nguồn sáng chính ở phía sau chủ thể hoặc hướng về máy ảnh.', 'backlight|rim light'),
    ('low-key', 'Low-key lighting', 'tone', 'lighting', 'Ánh sáng low-key', 'A deliberately dark lighting setup with limited bright areas.', 'Bố cục ánh sáng chủ ý tối với ít vùng sáng.', 'low key|dark lighting|tối'),
    ('high-key', 'High-key lighting', 'tone', 'lighting', 'Ánh sáng high-key', 'A bright setup with light backgrounds and gentle shadows.', 'Bố cục sáng, nền sáng và bóng đổ nhẹ.', 'high key|bright lighting'),
    ('flash', 'Flash light', 'tone', 'lighting', 'Ánh sáng flash', 'An on-camera or off-camera flash is visibly influential.', 'Ánh sáng flash gắn máy hoặc rời ảnh hưởng rõ đến ảnh.', 'strobe|speedlight'),
    ('neon', 'Neon light', 'tone', 'lighting', 'Ánh sáng neon', 'Colored neon or sign light shapes the image.', 'Đèn neon hoặc ánh sáng biển hiệu màu tạo hình cho ảnh.', 'neon glow|colored practical light'),

    ('bright', 'Bright', 'tone', 'color_tone', 'Sáng', 'Overall exposure and palette feel bright.', 'Độ sáng và bảng màu tổng thể tạo cảm giác sáng.', 'light|airy|high brightness|tươi sáng'),
    ('dark', 'Dark', 'tone', 'color_tone', 'Tối', 'The frame has a generally dark tonal presentation.', 'Khung hình có cách thể hiện sắc độ nhìn chung tối.', 'deep tones|low brightness'),
    ('warm', 'Warm tones', 'tone', 'color_tone', 'Tông ấm', 'Yellow, orange, or red hues are prominent.', 'Sắc vàng, cam hoặc đỏ nổi bật.', 'warm color|ấm màu'),
    ('cool', 'Cool tones', 'tone', 'color_tone', 'Tông lạnh', 'Blue, cyan, or cool green hues are prominent.', 'Sắc xanh lam, cyan hoặc xanh lạnh nổi bật.', 'cool color|lạnh màu'),
    ('neutral', 'Neutral tones', 'tone', 'color_tone', 'Tông trung tính', 'Low-chroma whites, grays, blacks, or natural neutrals dominate.', 'Trắng, xám, đen hoặc màu trung tính tự nhiên ít bão hòa chiếm ưu thế.', 'neutral palette|beige neutral'),
    ('pastel', 'Pastel', 'tone', 'color_tone', 'Pastel', 'Light colors with gentle saturation dominate.', 'Màu sáng với độ bão hòa dịu chiếm ưu thế.', 'soft pastel|phấn nhẹ'),
    ('earthy', 'Earthy', 'tone', 'color_tone', 'Tông đất', 'Muted browns, ochres, olives, or natural greens dominate.', 'Nâu, vàng đất, olive hoặc xanh tự nhiên ít bão hòa chiếm ưu thế.', 'earth tones|organic palette'),
    ('vivid', 'Vivid', 'tone', 'color_tone', 'Rực rỡ', 'Strong, saturated colors are a defining feature.', 'Màu sắc đậm và bão hòa là đặc điểm nổi bật.', 'saturated|bold color'),
    ('muted', 'Muted / matte', 'tone', 'color_tone', 'Màu trầm / đục', 'Low-saturation or lifted-matte colors create a subdued look.', 'Màu ít bão hòa hoặc đen được nâng tạo cảm giác trầm, đục.', 'desaturated|matte color|đục|trầm màu'),
    ('monochrome', 'Monochrome', 'tone', 'color_tone', 'Đơn sắc', 'Black-and-white or a nearly single-hue palette.', 'Ảnh đen trắng hoặc gần như chỉ dùng một sắc độ.', 'black and white|grayscale'),
    ('high-contrast', 'High contrast', 'tone', 'color_tone', 'Tương phản cao', 'Strong separation between highlights, midtones, and shadows.', 'Vùng sáng, trung gian và vùng tối tách biệt mạnh.', 'crisp contrast|hard contrast'),
    ('soft-tones', 'Soft tones', 'tone', 'color_tone', 'Sắc độ mềm', 'Gentle tonal transitions and restrained contrast.', 'Chuyển sắc độ nhẹ và tương phản tiết chế.', 'low contrast|gentle tones'),

    ('romantic', 'Romantic', 'mood', 'mood', 'Lãng mạn', 'The image suggests tenderness, affection, or romance.', 'Ảnh gợi sự dịu dàng, tình cảm hoặc lãng mạn.', 'loving|tender'),
    ('dreamy', 'Dreamy', 'mood', 'mood', 'Mơ màng', 'Soft, atmospheric qualities create an unreal or dreamlike mood.', 'Đặc điểm mềm và giàu không khí tạo cảm giác mơ màng.', 'ethereal|whimsical'),
    ('calm', 'Calm', 'mood', 'mood', 'Bình yên', 'The image feels quiet, unhurried, or restful.', 'Ảnh tạo cảm giác yên tĩnh, thong thả hoặc thư thái.', 'peaceful|serene'),
    ('joyful', 'Joyful', 'mood', 'mood', 'Vui tươi', 'Expressions or action convey visible happiness.', 'Biểu cảm hoặc chuyển động thể hiện niềm vui rõ ràng.', 'happy|cheerful'),
    ('playful', 'Playful', 'mood', 'mood', 'Tinh nghịch', 'The image conveys spontaneity, fun, or lighthearted play.', 'Ảnh gợi sự ngẫu hứng, vui đùa hoặc nhẹ nhàng.', 'fun|whimsical'),
    ('dramatic', 'Dramatic', 'mood', 'mood', 'Kịch tính', 'Lighting, gesture, or framing creates tension or drama.', 'Ánh sáng, cử chỉ hoặc khung hình tạo cảm giác kịch tính.', 'theatrical|intense'),
    ('moody', 'Moody', 'mood', 'mood', 'Trầm', 'A subdued, introspective, or emotionally atmospheric presentation.', 'Cách thể hiện trầm, hướng nội hoặc giàu không khí cảm xúc.', 'introspective|brooding|deep mood|trầm cảm xúc'),
    ('confident', 'Confident', 'mood', 'mood', 'Tự tin', 'Pose or expression projects confidence and presence.', 'Tư thế hoặc biểu cảm thể hiện sự tự tin và hiện diện.', 'bold|assured'),
    ('nostalgic', 'Nostalgic', 'mood', 'mood', 'Hoài niệm', 'The palette, subject, or treatment recalls an earlier era or memory.', 'Bảng màu, chủ thể hoặc cách xử lý gợi một thời kỳ hay ký ức.', 'retro feeling|memory-like'),
    ('intimate', 'Intimate', 'mood', 'mood', 'Thân mật', 'Close framing or interaction creates a personal feeling.', 'Khung hình gần hoặc tương tác tạo cảm giác riêng tư, gần gũi.', 'personal|close connection'),
    ('fresh', 'Fresh', 'mood', 'mood', 'Tươi mới', 'The image feels lively, light, and visually refreshing.', 'Ảnh tạo cảm giác sinh động, nhẹ và mới mẻ.', 'lively|fresh-looking|tươi'),
    ('elegant', 'Elegant', 'mood', 'mood', 'Thanh lịch', 'Refined styling or composition creates a graceful impression.', 'Phong cách hoặc bố cục tinh tế tạo ấn tượng duyên dáng.', 'graceful|refined'),

    ('close-up', 'Close-up', 'setting', 'composition', 'Cận cảnh', 'The subject fills much of the frame at close range.', 'Chủ thể chiếm phần lớn khung hình ở khoảng cách gần.', 'close crop|tight framing'),
    ('half-body', 'Half-body', 'setting', 'composition', 'Bán thân', 'The frame shows a person from around the waist or chest upward.', 'Khung hình lấy người từ khoảng thắt lưng hoặc ngực trở lên.', 'waist-up|bust shot'),
    ('full-body', 'Full-body', 'setting', 'composition', 'Toàn thân', 'A person is framed from head to toe.', 'Người được lấy trọn từ đầu đến chân.', 'head-to-toe|full length'),
    ('wide-shot', 'Wide shot', 'setting', 'composition', 'Toàn cảnh', 'The setting occupies substantial space around the subject.', 'Bối cảnh chiếm diện tích đáng kể xung quanh chủ thể.', 'environmental shot|wide framing'),
    ('negative-space', 'Negative space', 'setting', 'composition', 'Khoảng trống', 'Open space around the subject is an important compositional element.', 'Khoảng trống quanh chủ thể là yếu tố bố cục quan trọng.', 'open space|minimal composition'),
    ('candid', 'Candid', 'setting', 'composition', 'Tự nhiên / bắt khoảnh khắc', 'The subject appears unposed or engaged in a spontaneous moment.', 'Chủ thể có vẻ không tạo dáng hoặc đang ở khoảnh khắc ngẫu nhiên.', 'unposed|in the moment|bắt khoảnh khắc'),
    ('posed', 'Posed', 'setting', 'composition', 'Tạo dáng', 'The subject appears deliberately arranged for the camera.', 'Chủ thể được sắp đặt hoặc tạo dáng có chủ ý trước máy ảnh.', 'directed pose|arranged'),

    ('editorial', 'Editorial', 'mood', 'style', 'Editorial', 'A concept-led image with deliberate fashion or magazine styling.', 'Ảnh theo concept với tạo hình thời trang hoặc tạp chí có chủ ý.', 'magazine|fashion editorial'),
    ('documentary', 'Documentary', 'mood', 'style', 'Tư liệu / documentary', 'An observational style that emphasizes an unfolding scene.', 'Phong cách quan sát, nhấn mạnh khung cảnh đang diễn ra.', 'reportage|observational'),
    ('lifestyle', 'Lifestyle', 'mood', 'style', 'Lifestyle', 'A staged or candid view of everyday life and use.', 'Cách thể hiện có sắp đặt hoặc tự nhiên về đời sống thường ngày.', 'everyday life|real life'),
    ('cinematic', 'Cinematic', 'mood', 'style', 'Điện ảnh', 'Framing, lighting, or grading evokes a film still.', 'Khung hình, ánh sáng hoặc màu gợi một khuôn hình điện ảnh.', 'film still|movie-like'),
    ('minimal', 'Minimal', 'mood', 'style', 'Tối giản', 'Few visual elements and restrained styling dominate.', 'Ít yếu tố thị giác và tạo hình tiết chế chiếm ưu thế.', 'minimalist|simple'),
    ('commercial', 'Commercial', 'mood', 'style', 'Thương mại', 'The image is designed to clearly present a product or service.', 'Ảnh được thiết kế để trình bày sản phẩm hoặc dịch vụ rõ ràng.', 'advertising|brand image'),
    ('glam', 'Glam', 'mood', 'styling', 'Glam', 'Polished, high-impact styling with a glamorous finish.', 'Tạo hình chỉn chu, nổi bật và mang sắc thái quyến rũ.', 'glamorous|slay|sắc sảo|lộng lẫy'),
    ('slay', 'Slay', 'mood', 'styling', 'Slay / cá tính', 'Colloquial label for a striking, self-assured, high-impact look.', 'Nhãn khẩu ngữ cho tạo hình nổi bật, tự tin và có sức hút.', 'glam|confident glam|sắc sảo|chất'),

    ('clean', 'Clean', 'tone', 'editing', 'Clean', 'A clear, uncluttered treatment with controlled color and detail.', 'Cách xử lý rõ, gọn, kiểm soát màu và chi tiết.', 'crisp|polished|sạch'),
    ('natural-skin', 'Natural skin', 'tone', 'editing', 'Da tự nhiên', 'Skin texture and color remain natural-looking.', 'Kết cấu và màu da được giữ tự nhiên.', 'skin texture|true-to-skin'),
    ('matte', 'Matte', 'tone', 'editing', 'Matte', 'Highlights and blacks have a softened, low-gloss treatment.', 'Vùng sáng và vùng tối được xử lý mềm, ít bóng.', 'matte finish|lifted blacks'),
    ('film-grain', 'Film grain', 'tone', 'editing', 'Hạt phim', 'Visible grain or grain-like texture is part of the treatment.', 'Hạt phim hoặc kết cấu tương tự được giữ lại có chủ ý.', 'analog grain|texture'),
    ('crisp', 'Crisp detail', 'tone', 'editing', 'Chi tiết sắc nét', 'Edges and fine details appear sharply defined.', 'Đường biên và chi tiết nhỏ được thể hiện rõ nét.', 'sharp|defined detail'),
    ('soft-focus', 'Soft focus', 'tone', 'editing', 'Lấy nét mềm', 'Focus or diffusion is intentionally gentle rather than crisp.', 'Lấy nét hoặc tán sáng được làm dịu thay vì sắc nét.', 'diffused focus|soft image'),
    ('glow', 'Glow', 'tone', 'editing', 'Glow', 'Highlights bloom or create a luminous halo.', 'Vùng sáng loang nhẹ hoặc tạo quầng phát sáng.', 'bloom|halation'),
    ('hazy', 'Hazy', 'tone', 'editing', 'Mờ sương', 'Low contrast or atmospheric haze softens the frame.', 'Tương phản thấp hoặc lớp sương không khí làm mềm khung hình.', 'misty|atmospheric haze')
)
INSERT INTO public.tags (
  slug, name, kind, category, name_vi, definition_en, definition_vi, aliases
)
SELECT
  seed.slug,
  seed.name,
  seed.kind_name::public.tag_kind,
  seed.category,
  seed.name_vi,
  seed.definition_en,
  seed.definition_vi,
  CASE WHEN seed.aliases = '' THEN '{}'::text[] ELSE string_to_array(seed.aliases, '|') END
FROM seed
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  category = EXCLUDED.category,
  name_vi = EXCLUDED.name_vi,
  definition_en = EXCLUDED.definition_en,
  definition_vi = EXCLUDED.definition_vi,
  aliases = EXCLUDED.aliases;

COMMIT;
