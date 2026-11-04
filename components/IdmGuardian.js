'use client';

import { useEffect } from 'react';

/**
 * IdmGuardian
 * Globally intercepts and annihilates Internet Download Manager (IDM)
 * and 3rd-party download extension DOM injections across all pages.
 */
export default function IdmGuardian() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const purgeIdmElements = () => {
      try {
        // 1. Selector-based eradication
        const matched = document.querySelectorAll(
          '[id*="idm" i], [class*="idm" i], [title*="idm" i], [aria-label*="idm" i], ' +
          '[id*="downloader-panel" i], [class*="downloader-panel" i], [id*="fvd-" i], ' +
          'embed[type*="idm" i], object[type*="idm" i], iframe[src*="chrome-extension://" i][src*="idm" i]'
        );

        matched.forEach((el) => {
          // Preserve our platform's own UI elements
          if (
            el.closest?.('.vactions') ||
            el.closest?.('.video-actions-bar') ||
            el.closest?.('.custom-player-container') ||
            el.closest?.('.edit-tags-action-btn') ||
            el.closest?.('.vip-btn')
          ) {
            return;
          }
          try {
            el.remove();
          } catch (_) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
          }
        });

        // 2. Text-content matching for floating IDM buttons / lists (e.g. "Download video from this page with IDM")
        const candidates = document.querySelectorAll('div, span, button, p, a, table');
        for (let i = 0; i < candidates.length; i++) {
          const el = candidates[i];
          if (
            el.closest?.('.vactions') ||
            el.closest?.('.video-actions-bar') ||
            el.closest?.('.custom-player-container') ||
            el.closest?.('.vcard') ||
            el.closest?.('.player-viewport')
          ) {
            continue;
          }
          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (
            text.includes('download video from this page') ||
            text.includes('download with idm') ||
            (text.includes('download all') && text.includes('mp4 file')) ||
            (text.startsWith('download all') && text.includes('mb')) ||
            (text.includes('idm integration module'))
          ) {
            try {
              // Find the topmost container that is not body/html
              let topContainer = el;
              while (topContainer.parentElement && topContainer.parentElement !== document.body && topContainer.parentElement !== document.documentElement) {
                topContainer = topContainer.parentElement;
              }
              topContainer.remove();
            } catch (_) {
              el.remove();
            }
          }
        }
      } catch (_) {}
    };

    purgeIdmElements();
    const interval = setInterval(purgeIdmElements, 150);

    const observer = new MutationObserver(() => {
      purgeIdmElements();
    });

    try {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'id', 'style'],
      });
    } catch (_) {}

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return null;
}
