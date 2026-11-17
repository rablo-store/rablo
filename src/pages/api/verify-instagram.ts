export const prerender = false;
import type { APIRoute } from 'astro';
import { verifyBioCode } from '../../lib/instagramBioCheck';
import { requestInstagramReview } from '../../lib/brands';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any)?.user;
    const supabase = (locals as any)?.supabase;

    const body = await request.json().catch(() => ({}));
    const { brandId, handle, code } = body;

    if (!brandId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing brandId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Call bio check helper
    const result = await verifyBioCode(handle, code);

    if (result.status === 'verified') {
      // If automated check verified bio, update is_verified
      if (supabase) {
        await supabase
          .from('brands')
          .update({
            is_verified: true,
            verified_at: new Date().toISOString(),
            verification_requested_at: new Date().toISOString(),
          })
          .eq('id', brandId);
      }

      return new Response(JSON.stringify({ success: true, verified: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If automated check is unavailable or pending manual check, queue for admin review
    const reviewRes = await requestInstagramReview(brandId);

    return new Response(
      JSON.stringify({
        success: reviewRes.success,
        status: result.status,
        queuedForReview: true,
        message:
          result.message ||
          "We've queued your store for review. Our curation team will verify your Instagram bio shortly.",
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Verification request failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

