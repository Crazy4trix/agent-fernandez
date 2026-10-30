// Progressive enhancement only: every feature here works without JavaScript.
document.documentElement.classList.replace('no-js', 'js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Mobile menu ----------
function initMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  const set = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
    nav.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { set(false); toggle.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && e.target !== toggle) set(false);
  });
}

// ---------- Listing photo slides ----------
function initSlides(root) {
  const track = root.querySelector('.slides-track');
  const slides = [...root.querySelectorAll('.slide')];
  const current = root.querySelector('[data-current]');
  const [prev, next] = root.querySelectorAll('.slides-btn');
  if (!track || slides.length < 2) return;
  let index = 0;

  const update = (i) => {
    index = i;
    if (current) current.textContent = String(i + 1);
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
  };
  const go = (i) => {
    const target = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: slides[target].offsetLeft - track.offsetLeft, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    update(target);
  };

  root.querySelectorAll('.slides-btn').forEach((btn) => btn.addEventListener('click', () => go(index + Number(btn.dataset.dir))));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  });
  // Keep the counter in sync with touch swipes.
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) update(slides.indexOf(entry.target));
  }, { root: track, threshold: 0.6 });
  slides.forEach((s) => io.observe(s));
  update(0);
}

// ---------- Listing filters: update results in place ----------
function initFilters(form) {
  let controller;
  let latest = 0;
  const run = async () => {
    const params = new URLSearchParams(new FormData(form));
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    if (params.get('show') === 'available') params.delete('show');
    const query = params.toString();
    const request = ++latest;
    document.getElementById('results').setAttribute('aria-busy', 'true');
    controller?.abort();
    controller = new AbortController();
    try {
      const res = await fetch(`/listings?${query ? query + '&' : ''}partial=1`, { signal: controller.signal });
      if (!res.ok) throw new Error(String(res.status));
      const markup = await res.text();
      if (request !== latest) return;
      // Look the container up at swap time: an earlier swap may have replaced it.
      const swap = () => {
        if (request !== latest) return;
        document.getElementById('results').outerHTML = markup;
        const h1 = document.querySelector('.page-head h1');
        if (h1) h1.textContent = params.get('show') === 'sold' ? 'Recently sold' : 'Homes for sale';
      };
      if (document.startViewTransition && !reduceMotion.matches) document.startViewTransition(swap);
      else swap();
      history.replaceState(null, '', `/listings${query ? '?' + query : ''}`);
    } catch (err) {
      if (err.name !== 'AbortError') form.submit();
    }
  };
  form.addEventListener('change', run);
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
}

// ---------- Inquiry forms ----------
function clearErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((f) => {
    f.classList.remove('has-error');
    const control = f.querySelector('input, select, textarea');
    control.removeAttribute('aria-invalid');
    const err = f.querySelector('.error');
    err.hidden = true;
    err.textContent = '';
  });
  const alert = form.querySelector('.form-alert');
  if (alert) { alert.hidden = true; alert.textContent = ''; }
}

function showErrors(form, errors) {
  const alert = form.querySelector('.form-alert');
  const fieldErrors = Object.entries(errors).filter(([k]) => k !== '_form');
  let first = null;
  for (const [name, message] of fieldErrors) {
    const wrap = form.querySelector(`[data-field="${name}"]`);
    if (!wrap) continue;
    const control = wrap.querySelector('input, select, textarea');
    const err = wrap.querySelector('.error');
    wrap.classList.add('has-error');
    control.setAttribute('aria-invalid', 'true');
    const ids = new Set((control.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
    ids.add(err.id);
    control.setAttribute('aria-describedby', [...ids].join(' '));
    err.textContent = message;
    err.hidden = false;
    first ||= control;
  }
  if (alert) {
    const n = fieldErrors.length;
    alert.textContent = errors._form || `Check the ${n === 1 ? 'highlighted field' : `${n} highlighted fields`} and send again.`;
    alert.hidden = false;
  }
  (first || alert)?.focus?.();
  if (!first && alert) alert.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

function initInquiry(form) {
  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (button.getAttribute('aria-busy') === 'true') return;
    clearErrors(form);
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Sending…';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)),
      });
      const data = await res.json().catch(() => ({ ok: false, errors: { _form: 'The server didn’t respond as expected.' } }));
      if (data.ok) {
        const sent = form.parentElement.querySelector('.form-sent');
        form.hidden = true;
        sent.hidden = false;
        sent.focus();
      } else {
        showErrors(form, data.errors || { _form: 'The message wasn’t sent. Try again.' });
      }
    } catch {
      showErrors(form, { _form: 'The message wasn’t sent because the connection dropped. Check your connection and try again.' });
    } finally {
      button.removeAttribute('aria-busy');
      button.textContent = label;
    }
  });
}

initMenu();
document.querySelectorAll('[data-slides]').forEach(initSlides);
document.querySelectorAll('[data-filters]').forEach(initFilters);
document.querySelectorAll('[data-inquiry]').forEach(initInquiry);

// After a no-JS-style redirect (?sent=1), move focus to the confirmation.
document.querySelector('.form-sent:not([hidden])')?.focus();
