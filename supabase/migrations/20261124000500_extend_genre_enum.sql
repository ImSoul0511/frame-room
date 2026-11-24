-- Align fresh installations with genre values already present on Cloud.
alter type public.genre add value if not exists 'drink';
alter type public.genre add value if not exists 'yearbook';
alter type public.genre add value if not exists 'outdoor';
alter type public.genre add value if not exists 'tet_holiday';
