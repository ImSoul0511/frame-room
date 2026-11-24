-- Keep existing public portfolio URLs available while clients migrate to the API proxy.
update storage.buckets set public=true where id='portfolio-images';
