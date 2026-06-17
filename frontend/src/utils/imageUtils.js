// Inserts Cloudinary on-the-fly transformation into a stored URL.
// Works for any image already on Cloudinary (new WebP uploads and old JPG/PNG images).
export function getThumbUrl(url, w = 400, h = 400) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill,f_webp,q_auto/`);
}

export function getFullUrl(url) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/w_1200,h_1200,c_limit,f_webp,q_auto/');
}
