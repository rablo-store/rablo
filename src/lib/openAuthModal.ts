/**
 * RIJLO — Open Auth Modal Dispatcher
 * Extracted helper so client islands or product cards can trigger the auth modal
 * without importing the heavy AuthModal.tsx component.
 */

export interface AuthModalDetail {
  targetUrl?: string;
  creatorName?: string;
  productName?: string;
}

export function openInstagramAuthModal(detail: AuthModalDetail) {
  if (typeof window !== 'undefined') {
    let canonical = detail.targetUrl;
    if (canonical) {
      try {
        localStorage.setItem('rablo:pending_ig_redirect', canonical);
        sessionStorage.setItem('rablo:pending_ig_redirect', canonical);
        document.cookie = `rablo_pending_ig=${encodeURIComponent(canonical)}; path=/; max-age=3600; SameSite=Lax`;
        if (detail.creatorName) {
          localStorage.setItem('rablo:pending_creator_name', detail.creatorName);
          sessionStorage.setItem('rablo:pending_creator_name', detail.creatorName);
          document.cookie = `rablo_pending_creator=${encodeURIComponent(detail.creatorName)}; path=/; max-age=3600; SameSite=Lax`;
        }
      } catch {}
    }
    window.dispatchEvent(
      new CustomEvent('rablo:open-auth-modal', { detail: { ...detail, targetUrl: canonical } })
    );
  }
}

