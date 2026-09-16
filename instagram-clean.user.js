
// ==UserScript==
// @name         Instagram Clean
// @namespace    instagram-clean
// @version      1.1
// @description  Entfernt Reels und Explore, öffnet den Following-Feed und blendet bereits gesehene Beiträge aus.
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const FOLLOWING = 'https://www.instagram.com/?variant=following';
  const SEEN_POSTS_KEY = 'instagram-clean-seen-posts-v1';
  const REQUIRED_VISIBILITY = 0.65;
  const REQUIRED_VISIBLE_TIME = 1400;
  const MAX_SAVED_POSTS = 5000;

  const seenPosts = loadSeenPosts();
  const observedPosts = new Set();
  const visibleRatios = new WeakMap();
  const visibilityTimers = new WeakMap();
  const newlySeenPosts = new WeakSet();

  function loadSeenPosts() {
    try {
      const saved = JSON.parse(localStorage.getItem(SEEN_POSTS_KEY) || '{}');

      if (!saved || Array.isArray(saved) || typeof saved !== 'object') {
        return new Map();
      }

      return new Map(
        Object.entries(saved).filter(([, timestamp]) =>
          Number.isFinite(timestamp)
        )
      );
    } catch (_) {
      return new Map();
    }
  }

  function saveSeenPosts() {
    try {
      const newestPosts = [...seenPosts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_SAVED_POSTS);

      seenPosts.clear();
      newestPosts.forEach(([postId, timestamp]) => {
        seenPosts.set(postId, timestamp);
      });

      localStorage.setItem(
        SEEN_POSTS_KEY,
        JSON.stringify(Object.fromEntries(newestPosts))
      );
    } catch (_) {
      // Das Script funktioniert weiter, auch wenn lokaler Speicher blockiert ist.
    }
  }

  function isFollowingFeed() {
    const url = new URL(location.href);
    return url.pathname === '/' && url.searchParams.get('variant') === 'following';
  }

  function getPostId(post) {
    const permalink = post.querySelector('a[href^="/p/"]');
    if (!permalink) return null;

    const match = new URL(permalink.href, location.origin)
      .pathname
      .match(/^\/p\/([^/]+)/);

    return match ? match[1] : null;
  }

  function cancelVisibilityTimer(post) {
    const timer = visibilityTimers.get(post);
    if (timer) clearTimeout(timer);
    visibilityTimers.delete(post);
  }

  function rememberPost(post) {
    const postId = getPostId(post);
    if (!postId || seenPosts.has(postId)) return;

    newlySeenPosts.add(post);
    seenPosts.set(postId, Date.now());
    saveSeenPosts();
  }

  function startVisibilityTimer(post) {
    if (visibilityTimers.has(post)) return;

    const timer = setTimeout(() => {
      visibilityTimers.delete(post);

      if (
        !document.hidden &&
        isFollowingFeed() &&
        visibleRatios.get(post) >= REQUIRED_VISIBILITY
      ) {
        rememberPost(post);
      }
    }, REQUIRED_VISIBLE_TIME);

    visibilityTimers.set(post, timer);
  }

  const postObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const post = entry.target;
      visibleRatios.set(post, entry.intersectionRatio);

      if (
        !document.hidden &&
        isFollowingFeed() &&
        entry.isIntersecting &&
        entry.intersectionRatio >= REQUIRED_VISIBILITY
      ) {
        startVisibilityTimer(post);
      } else {
        cancelVisibilityTimer(post);
      }
    });
  }, {
    threshold: [0, REQUIRED_VISIBILITY, 1]
  });

  function hidePost(post) {
    if (post.dataset.instagramCleanSeen === 'true') return;

    post.dataset.instagramCleanSeen = 'true';
    cancelVisibilityTimer(post);
    postObserver.unobserve(post);
    observedPosts.delete(post);
  }

  function watchPosts() {
    observedPosts.forEach(post => {
      if (!post.isConnected || !isFollowingFeed()) {
        cancelVisibilityTimer(post);
        postObserver.unobserve(post);
        observedPosts.delete(post);
      }
    });

    if (!isFollowingFeed()) return;

    document.querySelectorAll('article').forEach(post => {
      const postId = getPostId(post);
      if (!postId) return;

      if (seenPosts.has(postId) && !newlySeenPosts.has(post)) {
        hidePost(post);
        return;
      }

      if (!observedPosts.has(post)) {
        observedPosts.add(post);
        postObserver.observe(post);
      }
    });
  }

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

    watchPosts();
  }

  const style = document.createElement('style');
  style.textContent = `
    article[data-instagram-clean-seen="true"] {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  redirect();
  clean();

  new MutationObserver(() => {
    redirect();
    clean();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener('visibilitychange', () => {
    observedPosts.forEach(post => {
      cancelVisibilityTimer(post);

      if (!document.hidden) {
        postObserver.unobserve(post);
        postObserver.observe(post);
      }
    });
  });

})();
