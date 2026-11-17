/**
 * RIJLO / RABLO — Instagram Bio Code Verification Helper
 *
 * Notice: Automated bio checking is currently gated behind the feature flag below.
 * Meta App Review for Instagram Login / Graph API is currently pending.
 * When approved and INSTAGRAM_AUTO_VERIFY is enabled, this module may connect
 * to Instagram Login or public bio inspection via an authorized server endpoint.
 *
 * Security constraint:
 * When enabled, automated bio checking may ONLY verify ownership (setting is_verified = true)
 * through a secure server-side route. It must NEVER alter approval_status.
 */

export const INSTAGRAM_AUTO_VERIFY = false;

export interface BioVerificationResult {
  status: 'unavailable' | 'verified' | 'not_found' | 'error';
  message?: string;
}

/**
 * Checks if the specified verification code is present in the Instagram bio for @handle.
 * Returns { status: 'unavailable' } while INSTAGRAM_AUTO_VERIFY is false.
 */
export async function verifyBioCode(
  _handle: string,
  _code: string
): Promise<BioVerificationResult> {
  // Gated behind feature flag: do not call Instagram or any unofficial endpoint
  if (!INSTAGRAM_AUTO_VERIFY) {
    return {
      status: 'unavailable',
      message:
        'Automated bio verification is currently unavailable pending Meta App Review. Your submission will be reviewed manually by the curation team.',
    };
  }

  // Future implementation once Meta App Review is approved:
  // May connect to Instagram Login to verify user's bio content.
  return {
    status: 'unavailable',
    message: 'Automated bio verification is not yet active.',
  };
}

