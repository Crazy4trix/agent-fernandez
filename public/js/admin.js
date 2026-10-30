// Admin enhancements: confirm destructive actions and resize photos in the browser before upload.
document.documentElement.classList.replace('no-js', 'js');

document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    if (!window.confirm(form.dataset.confirm)) e.preventDefault();
  });
});

const WIDTHS = [640, 1200, 2000];

function supportsWebp() {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.toDataURL('image/webp').startsWith('data:image/webp');
}

async function encode(bitmap, width, type) {
  const scale = Math.min(1, width / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.8));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(binary);
}

const input = document.querySelector('[data-upload]');
if (input) {
  const section = input.closest('[data-listing]');
  const status = section.querySelector('.upload-status');
  const csrf = document.querySelector('[data-csrf]').dataset.csrf;
  const webp = supportsWebp();
  const type = webp ? 'image/webp' : 'image/jpeg';

  input.addEventListener('change', async () => {
    const files = [...input.files];
    if (!files.length) return;
    let done = 0;
    const failed = [];
    for (const file of files) {
      status.textContent = `Preparing ${done + 1} of ${files.length}: ${file.name}`;
      try {
        if (!file.type.startsWith('image/')) throw new Error('not an image');
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const images = {};
        for (const w of WIDTHS) {
          // Skip sizes larger than the original, but always keep the smallest.
          if (w === WIDTHS[0] || bitmap.width >= w * 0.9) images[w] = await encode(bitmap, w, type);
        }
        status.textContent = `Uploading ${done + 1} of ${files.length}: ${file.name}`;
        const res = await fetch(`/admin/listings/${section.dataset.listing}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf },
          body: JSON.stringify({ ext: webp ? 'webp' : 'jpg', alt: '', images }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error((data.errors && data.errors._form) || `status ${res.status}`);
        done++;
      } catch (err) {
        failed.push(`${file.name} (${err.message})`);
      }
    }
    if (failed.length) {
      status.textContent = `${done} uploaded. These didn’t upload: ${failed.join(', ')}.`;
    } else {
      status.textContent = `${done} uploaded. Refreshing…`;
      window.location.href = `${window.location.pathname}?done=photo#photos-title`;
    }
  });
}
