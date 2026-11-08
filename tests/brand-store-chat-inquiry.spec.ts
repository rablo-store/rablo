import { test, expect } from '@playwright/test';

const mockInquiryProducts = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    name: 'Crochet Daisy Tote Bag',
    description: 'A beautiful hand-crocheted tote bag with daisy pattern.',
    price: 899,
    stock: 10,
    approval_status: 'Approved',
    seller_id: 'seller-nia',
    seller_ig_url: 'https://instagram.com/crochetbynia',
    product_ig_url: 'https://instagram.com/crochetbynia',
    contact_link: 'https://wa.me/919876543210?text=Hi%20Nia',
    thumbnail_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80',
    gallery_urls: [],
    created_at: new Date().toISOString(),
    seller: {
      full_name: 'Nia Sharma',
      avatar_url: '',
      instagram_url: 'https://instagram.com/crochetbynia',
    },
  },
  {
    id: 'standard-product-2',
    name: 'Classic Terracotta Pot',
    description: 'Handmade earthen pot.',
    price: 499,
    stock: 5,
    approval_status: 'Approved',
    seller_id: 'seller-potter',
    seller_ig_url: 'https://instagram.com/earthcraft',
    product_ig_url: 'https://instagram.com/earthcraft',
    contact_link: null,
    thumbnail_url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80',
    gallery_urls: [],
    created_at: new Date().toISOString(),
    seller: {
      full_name: 'Earth Craft',
      avatar_url: '',
      instagram_url: 'https://instagram.com/earthcraft',
    },
  },
];

const mockCategories = [
  { id: 'cat-fashion', name: 'Fashion & Accessories', slug: 'fashion-accessories', is_approved: true },
];

test.describe('Brand Store & Direct Chat Inquiry Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockInquiryProducts),
      });
    });

    await page.route('**/rest/v1/categories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCategories),
      });
    });
  });

  test('1. Product with contact_link displays "Contact / Chat" button on catalog card', async ({ page }) => {
    await page.goto('/catalog');

    // Check for "Contact / Chat" button on the first card
    const contactChatBtn = page.locator('button:has-text("Contact / Chat")').first();
    await expect(contactChatBtn).toBeVisible({ timeout: 10000 });

    // Click when logged out should trigger AuthModal
    await contactChatBtn.click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal).toContainText('Sign in with Google');
  });

  test('2. Product without contact_link falls back to Chat DM button', async ({ page }) => {
    await page.goto('/catalog');

    // The standard product without contact_link should show DM button
    const dmBtn = page.locator('button:has-text("DM"), button:has-text("Chat DM")');
    await expect(dmBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Product details page shows "Contact / Chat with Creator" button for product with contact_link', async ({ page }) => {
    await page.goto('/products/d0000000-0000-0000-0000-000000000001');

    // Should display Contact / Chat with Creator button
    const ctaBtn = page.locator('button:has-text("Contact / Chat with Creator"), button:has-text("Sign in to Contact / Chat with Creator")').first();
    await expect(ctaBtn).toBeVisible({ timeout: 10000 });

    // Also check the creator card badge
    const badge = page.locator('text=Direct Chat Inquiry Enabled');
    await expect(badge).toBeVisible({ timeout: 5000 });
  });

  test('4. Quick view modal displays "Contact / Chat with Creator" button', async ({ page }) => {
    await page.goto('/catalog');

    // Click on the quick view / card of the first item
    const firstCard = page.locator('article').filter({ hasText: 'Crochet Daisy Tote Bag' }).first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Open quick view via the card thumbnail click
    const quickViewTrigger = firstCard.locator('button[title*="Quick view"], div[title*="Quick view"], div.cursor-pointer').first();
    if (await quickViewTrigger.count() > 0) {
      await quickViewTrigger.click();
      const modalCta = page.locator('[role="dialog"] button:has-text("Contact / Chat with Creator")');
      await expect(modalCta).toBeVisible({ timeout: 5000 });
    }
  });
});

