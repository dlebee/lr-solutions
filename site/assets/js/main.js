(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const FR = document.documentElement.lang.startsWith('fr');
  const L = FR ? {
    channels: ['Salle · Table 4', 'En ligne · Cueillette 18 h 30', 'Appli de livraison', 'Borne · Pour emporter', 'Salle · Table 9', 'En ligne · Livraison', 'Traiteur · 40 pers.'],
    kds: '→ Cuisine', now: '6 sites · à l’instant', ago: s => `6 sites · il y a ${s} s`,
    invalid: 'Veuillez indiquer votre nom, un courriel valide et un message.',
    human: 'Veuillez compléter la vérification ci-dessus.',
    sending: 'Envoi en cours…',
    ok: 'Merci, votre message est en route. Nous répondrons en un jour ouvrable.',
    fail: 'Nous n’avons pas pu envoyer votre message.', retry: ' Vous pouvez réessayer dans un instant.',
  } : {
    channels: ['Dine-in · Table 4', 'Online · Pickup 6:30', 'Delivery app', 'Kiosk · To go', 'Dine-in · Table 9', 'Online · Delivery', 'Catering · 40 pax'],
    kds: '→ KDS', now: '6 sites · just now', ago: s => `6 sites · ${s}s ago`,
    invalid: 'Please add your name, a valid email and a message.',
    human: 'Please complete the human check above.',
    sending: 'Sending…',
    ok: "Thanks, your message is on its way. We'll reply within one business day.",
    fail: 'Something went wrong.', retry: ' You can try again in a moment.',
  };

  // Year
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  // Sticky header border
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  // Logo / "#top" links: scroll to the very top (the sticky header itself is never "above" the viewport)
  document.querySelectorAll('a[href="#top"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState(null, '', location.pathname + location.search);
  }));

  // Mobile nav
  const toggle = $('.nav-toggle'), links = $('#nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.addEventListener('click', e => {
    if (e.target.closest('a')) { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
  });

  // Reveal on scroll (staggered within each group)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('in'));
  } else {
    reveals.forEach(el => {
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
      el.style.setProperty('--d', (sibs.indexOf(el) * 0.08) + 's');
    });
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(el => io.observe(el));
  }

  // Parallax: data-speed = scroll factor, data-depth = mouse drift (px)
  if (!reduce) {
    const layers = [...document.querySelectorAll('[data-speed]')].map(el => ({
      el, speed: parseFloat(el.dataset.speed) || 0, depth: parseFloat(el.dataset.depth) || 0,
      host: el.closest('section') || document.body,
    }));
    let mx = 0, my = 0, tx = 0, ty = 0, ticking = false;
    const render = () => {
      tx += (mx - tx) * 0.08; ty += (my - ty) * 0.08;
      const vh = innerHeight;
      for (const l of layers) {
        const r = l.host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const progress = -r.top; // px scrolled past the section top
        const y = progress * l.speed + ty * l.depth;
        const x = tx * l.depth;
        l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
      ticking = Math.abs(mx - tx) > 0.001 || Math.abs(my - ty) > 0.001;
      if (ticking) requestAnimationFrame(render);
    };
    const kick = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick);
    if (matchMedia('(pointer: fine)').matches) {
      addEventListener('mousemove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; kick(); }, { passive: true });
    }
    kick();
  }

  // Hero live UI: entrance, rotating order tickets, sync timer
  const hero = $('.hero');
  if (hero) {
    requestAnimationFrame(() => setTimeout(() => hero.classList.add('ready'), 150));
    const list = $('#tickets'), sync = $('#sync-time');
    const channels = L.channels;
    let n = 1042, secs = 0, ci = 0;
    if (list && !reduce) {
      setInterval(() => {
        if (document.hidden) return;
        const li = document.createElement('li');
        li.className = 'new';
        li.innerHTML = `<b>#${++n}</b><span>${channels[ci++ % channels.length]}</span><em>${L.kds}</em>`;
        list.prepend(li);
        while (list.children.length > 4) list.lastElementChild.remove();
        secs = 0; if (sync) sync.textContent = L.now;
      }, 3200);
      setInterval(() => { secs++; if (sync && secs > 1) sync.textContent = L.ago(secs); }, 1000);
    }
  }

  // Contact form
  const form = $('#contact-form');
  if (!form) return;
  const status = $('#form-status'), btn = form.querySelector('button[type=submit]');
  const setStatus = (msg, kind = '') => { status.textContent = msg; status.className = 'form-status ' + kind; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name?.trim() || !data.message?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) {
      setStatus(L.invalid, 'err'); return;
    }
    const token = data['cf-turnstile-response'];
    if (!token) { setStatus(L.human, 'err'); return; }

    btn.disabled = true; setStatus(L.sending);
    try {
      const endpoint = location.hostname === 'localhost' ? 'http://localhost:8787/contact' : form.dataset.endpoint;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error((!FR && out.error) || L.fail);
      if (window.gtag) gtag('event', 'generate_lead', { form_id: 'contact', enquiry_type: data.type || '' });
      form.reset();
      setStatus(L.ok, 'ok');
    } catch (err) {
      setStatus((FR ? L.fail : err.message) + L.retry, 'err');
    } finally {
      btn.disabled = false;
      if (window.turnstile) window.turnstile.reset();
    }
  });
})();
