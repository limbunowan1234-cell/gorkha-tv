// Bottom mobile nav — same "render into a placeholder div" pattern as
// js/auth.js's initAuthNav(), just for the phone-only tab bar instead of the
// sign-in widget. Hidden above 700px via CSS (see .mobile-nav in style.css).

const TABS = [
  {
    href: '/',
    label: 'Home',
    match: (path) => path === '/' || path === '/index.html',
    icon: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  },
  {
    href: '/shorts',
    label: 'Shorts',
    match: (path) => path.startsWith('/shorts'),
    icon: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/>',
  },
  {
    href: '/pages/search.html',
    label: 'Search',
    match: (path) => path.includes('/search'),
    icon: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  },
  {
    href: '/pages/edit-profile.html',
    label: 'Profile',
    match: (path) => path.includes('/edit-profile'),
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  },
];

export function initMobileNav() {
  const root = document.getElementById('mobile-nav-root');
  if (!root) return;

  // A <div>, not <nav> — the site's global `nav { position: sticky; top: 0;
  // height: 64px; ... }` element-selector rule (for the top bar) would
  // otherwise also match a second <nav> here and fight the fixed-to-bottom
  // positioning below, since it sets `top`/`height` that this class doesn't.
  const path = window.location.pathname;
  root.innerHTML = `
    <div class="mobile-nav" role="navigation" aria-label="Mobile navigation">
      <div class="mobile-nav-inner">
        ${TABS.map(
          (tab) => `
          <a href="${tab.href}" class="mobile-nav-item${tab.match(path) ? ' active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${tab.icon}</svg>
            <span>${tab.label}</span>
          </a>`
        ).join('')}
      </div>
    </div>`;
}

initMobileNav();
