// Cookie consent + Google Analytics, opt-in only (Quebec Law 25: tracking is OFF by default).
// GA is not loaded at all until the visitor clicks "Accept". The choice is kept for 12 months,
// and any element with [data-consent-open] reopens the banner so visitors can change their mind.
(() => {
  const GA_ID = 'G-2M2Y33Q43E';
  const KEY = 'lr-consent';
  const MAX_AGE = 365 * 24 * 3600 * 1000;
  const fr = (document.documentElement.lang || '').startsWith('fr');

  const T = fr ? {
    title: 'Témoins et statistiques',
    body: 'Avec votre accord, nous utilisons Google Analytics pour mesurer la fréquentation du site de façon anonyme. Aucun témoin publicitaire. Vous pouvez changer d’avis en tout temps.',
    more: 'Politique de confidentialité', moreHref: '/fr/confidentialite/',
    accept: 'Accepter', refuse: 'Refuser', label: 'Consentement aux témoins',
  } : {
    title: 'Cookies & analytics',
    body: 'With your permission, we use Google Analytics to measure visits to this site anonymously. No advertising cookies. You can change your mind at any time.',
    more: 'Privacy policy', moreHref: '/privacy/',
    accept: 'Accept', refuse: 'Decline', label: 'Cookie consent',
  };

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && Date.now() - v.t < MAX_AGE ? v.c : null;
    } catch { return null; }
  };
  const save = c => { try { localStorage.setItem(KEY, JSON.stringify({ c, t: Date.now() })); } catch {} };

  let loaded = false;
  const loadGA = () => {
    if (loaded) return; loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: 395 * 24 * 3600 });
    const s = document.createElement('script');
    s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
  };
  const stopGA = () => {
    window[`ga-disable-${GA_ID}`] = true;
    if (window.gtag) gtag('consent', 'update', { analytics_storage: 'denied' });
    // Remove GA cookies already set on this domain.
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga/.test(n)).forEach(n => {
      for (const d of ['', location.hostname, '.' + location.hostname.replace(/^www\./, '')]) {
        document.cookie = `${n}=; Max-Age=0; path=/${d ? '; domain=' + d : ''}`;
      }
    });
  };

  const css = `
.cc{position:fixed;z-index:1000;left:16px;right:16px;bottom:16px;max-width:440px;margin-left:auto;background:#fff;color:#0B1B3F;
border:1px solid #E3E9F5;border-radius:16px;box-shadow:0 18px 50px rgba(11,27,63,.18);padding:1.25rem 1.25rem 1.1rem;
font:400 .92rem/1.5 "Plus Jakarta Sans",system-ui,sans-serif;transform:translateY(12px);opacity:0;transition:.25s ease}
.cc.on{transform:none;opacity:1}
.cc h2{font:700 1rem/1.3 "Plus Jakarta Sans",system-ui,sans-serif;margin:0 0 .35rem;color:#0B1B3F;letter-spacing:0}
.cc p{margin:0 0 .9rem;color:#5B6B8A}
.cc a{color:#1D4ED8}
.cc .cc-row{display:flex;gap:.6rem}
.cc button{flex:1;font:700 .92rem/1 "Plus Jakarta Sans",system-ui,sans-serif;padding:.8em 1em;border-radius:999px;cursor:pointer;border:1px solid #1D4ED8}
.cc .cc-yes{background:#1D4ED8;color:#fff}
.cc .cc-no{background:#fff;color:#1D4ED8}
.cc button:hover{filter:brightness(.95)}
@media (prefers-reduced-motion:reduce){.cc{transition:none}}`;

  let box;
  const show = () => {
    if (!box) {
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      box = document.createElement('div');
      box.className = 'cc'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', T.label);
      box.innerHTML = `<h2>${T.title}</h2><p>${T.body} <a href="${T.moreHref}">${T.more}</a></p>
<div class="cc-row"><button type="button" class="cc-no">${T.refuse}</button><button type="button" class="cc-yes">${T.accept}</button></div>`;
      box.querySelector('.cc-yes').onclick = () => { save('granted'); hide(); loadGA(); };
      box.querySelector('.cc-no').onclick = () => { save('denied'); hide(); stopGA(); };
      document.body.appendChild(box);
    }
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('on'));
  };
  const hide = () => { box.classList.remove('on'); setTimeout(() => { box.hidden = true; }, 250); };

  const start = () => {
    const c = read();
    if (c === 'granted') loadGA();
    else if (c === null) show();
    document.addEventListener('click', e => {
      if (e.target.closest('[data-consent-open]')) { e.preventDefault(); show(); }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
