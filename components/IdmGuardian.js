'use client';

import { useEffect } from 'react';

/**
 * IdmGuardian
 * Globally intercepts, suppresses, and purges Internet Download Manager (IDM)
 * and all 3rd-party downloader extension injections across all pages.
 */
export default function IdmGuardian() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Inject aggressive CSS shield into document.head
    const styleId = 'idm-annihilation-shield';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        /* Global IDM & Downloader Suppression */
        *[id*="idm" i]:not(.vactions *):not(.vcard *):not([class*="actionBtn"]):not([class*="vinfo"]):not([class*="vsub"]),
        *[class*="idm" i]:not(.vactions *):not(.vcard *):not([class*="actionBtn"]):not([class*="vinfo"]):not([class*="vsub"]),
        *[title*="idm" i],
        *[aria-label*="idm" i],
        *[id*="downloader-panel" i],
        *[class*="downloader-panel" i],
        *[class*="download-helper" i],
        *[id*="fvd-" i],
        *[class*="fvd-" i],
        embed[type*="idm" i],
        object[type*="idm" i],
        iframe[src*="chrome-extension://" i][src*="idm" i],
        iframe[src*="moz-extension://" i][src*="idm" i],
        div[id^="idm_"],
        div[class^="idm_"],
        #idm_panel,
        .idm_panel,
        #idm-panel,
        .idm-panel,
        #idm_panel_container,
        #idm_editor_overlay,
        .idm_context_menu,
        *[title*="download this video" i],
        *[title*="download video from this page" i],
        *[title*="download with idm" i] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          max-width: 0 !important;
          max-height: 0 !important;
          position: absolute !important;
          left: -99999px !important;
          top: -99999px !important;
          z-index: -99999 !important;
          clip: rect(0,0,0,0) !important;
          overflow: hidden !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    const purgeIdmElements = () => {
      try {
        // 1. Selector-based eradication
        const matched = document.querySelectorAll(
          '[id*="idm" i], [class*="idm" i], [title*="idm" i], [aria-label*="idm" i], ' +
          '[id*="downloader-panel" i], [class*="downloader-panel" i], [id*="fvd-" i], ' +
          'embed[type*="idm" i], object[type*="idm" i], iframe[src*="extension://" i][src*="idm" i], ' +
          '#idm_panel, .idm_panel, #idm-panel, .idm-panel, #idm_panel_container'
        );

        matched.forEach((el) => {
          // Preserve our platform's own UI elements
          if (
            el.closest?.('.vactions') ||
            el.closest?.('.video-actions-bar') ||
            el.closest?.('.custom-player-container') ||
            el.closest?.('.edit-tags-action-btn') ||
            el.closest?.('.vip-btn') ||
            el.closest?.('.vcard')
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

        // 2. Eradicate injected floating elements containing IDM text
        // (e.g. "Download video from this page", "Download with IDM", etc.)
        const candidates = document.querySelectorAll('div, span, button, p, a, table, iframe');
        for (let i = 0; i < candidates.length; i++) {
          const el = candidates[i];
          if (
            el.closest?.('.vactions') ||
            el.closest?.('.video-actions-bar') ||
            el.closest?.('.custom-player-container') ||
            el.closest?.('.vcard') ||
            el.closest?.('.player-viewport') ||
            el.closest?.('.related-grid')
          ) {
            continue;
          }

          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (
            text.includes('download video from this page') ||
            text.includes('download with idm') ||
            text.includes('download this video') ||
            (text.includes('download all') && (text.includes('video') || text.includes('file') || text.includes('mb') || text.includes('.mp4'))) ||
            text.includes('idm integration module') ||
            text.includes('internet download manager')
          ) {
            try {
              // Find the topmost container injected outside normal body hierarchy
              let topContainer = el;
              while (
                topContainer.parentElement &&
                topContainer.parentElement !== document.body &&
                topContainer.parentElement !== document.documentElement
              ) {
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
    const interval = setInterval(purgeIdmElements, 80);

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
