// ==UserScript==
// @name         Instagram Clean
// @namespace    instagram-clean
// @version      1.0
// @description  Entfernt Reels und Explore und öffnet möglichst den Following-Feed.
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const FOLLOWING = 'https://www.instagram.com/?variant=following';

  function redirect() {
    const path = location.pathname;

    if (
      path.startsWith('/reel/') ||
      path.startsWith('/reels') ||
      path.startsWith('/explore')
    ) {
      location.replace(FOLLOWING);
      return;
    }

    const params = new URL(location.href).searchParams;

    if (
      path === '/' &&
      params.get('variant') !== 'following'
    ) {
      location.replace(FOLLOWING);
    }
  }

  function clean() {
    document.querySelectorAll(
      'a[href^="/reel/"], a[href^="/reels"], a[href^="/explore"]'
    ).forEach(el => {
      el.style.display = 'none';

      const p = el.parentElement;
      if (p) p.style.display = 'none';
    });
  }

  redirect();
  clean();

  new MutationObserver(() => {
    redirect();
    clean();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

})();
