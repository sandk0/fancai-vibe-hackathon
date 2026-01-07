import { test, expect, devices } from '@playwright/test';

const iPhone = devices['iPhone 14'];
const credentials = {
  email: 'sandk008@gmail.com',
  password: 'Grh08hert12233fssa!'
};

test.use({ ...iPhone });

test.describe('Mobile Audit - fancai.ru', () => {

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('https://fancai.ru/login');
    await page.fill('input[type="email"], input[placeholder*="email"]', credentials.email);
    await page.fill('input[type="password"]', credentials.password);
    await page.click('button:has-text("Войти")');
    await page.waitForURL('**/');
  });

  test('1. Login Page Mobile', async ({ page }) => {
    await page.goto('https://fancai.ru/login');
    await page.screenshot({ path: 'screenshots/01-login-mobile.png', fullPage: true });

    // Check touch targets
    const loginBtn = page.locator('button:has-text("Войти")');
    const box = await loginBtn.boundingBox();
    console.log('Login button size:', box?.width, 'x', box?.height);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('2. Home Page Mobile', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/02-home-mobile.png', fullPage: true });

    // Check bottom navigation exists
    const bottomNav = page.locator('nav[aria-label*="Bottom"], [class*="bottom-nav"], [class*="BottomNav"]');
    await expect(bottomNav.or(page.locator('a[href="/library"]'))).toBeVisible();
  });

  test('3. Library Page Mobile', async ({ page }) => {
    await page.goto('https://fancai.ru/library');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/03-library-mobile.png', fullPage: true });

    // Check grid layout
    const bookCards = page.locator('[class*="book-card"], [class*="BookCard"], button:has-text("Open")');
    const count = await bookCards.count();
    console.log('Book cards found:', count);
  });

  test('4. Reader Page Mobile', async ({ page }) => {
    // Open first book
    await page.goto('https://fancai.ru/library');
    await page.waitForLoadState('networkidle');

    const firstBook = page.locator('button:has-text("Open"), [class*="book-card"]').first();
    if (await firstBook.isVisible()) {
      await firstBook.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/04-reader-mobile.png', fullPage: true });

      // Check reader controls
      const toolbar = page.locator('[class*="toolbar"], [class*="Toolbar"], header');
      console.log('Toolbar visible:', await toolbar.first().isVisible());
    }
  });

  test('5. Profile Page Mobile', async ({ page }) => {
    await page.goto('https://fancai.ru/profile');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/05-profile-mobile.png', fullPage: true });
  });

  test('6. Settings Page Mobile', async ({ page }) => {
    await page.goto('https://fancai.ru/settings');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/06-settings-mobile.png', fullPage: true });
  });

  test('7. Admin Page Mobile', async ({ page }) => {
    await page.goto('https://fancai.ru/admin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/07-admin-mobile.png', fullPage: true });

    // Check tabs scrollable
    const tabs = page.locator('[role="tablist"], [class*="tabs"]');
    if (await tabs.isVisible()) {
      const box = await tabs.boundingBox();
      console.log('Tabs width:', box?.width);
    }
  });

  test('8. Touch Targets Audit', async ({ page }) => {
    await page.goto('https://fancai.ru/library');
    await page.waitForLoadState('networkidle');

    // Find all interactive elements
    const buttons = page.locator('button, a, [role="button"]');
    const count = await buttons.count();

    let smallTargets = [];
    for (let i = 0; i < Math.min(count, 50); i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box && (box.width < 44 || box.height < 44)) {
          const text = await btn.textContent() || await btn.getAttribute('aria-label') || `element-${i}`;
          smallTargets.push({ text: text.substring(0, 30), width: box.width, height: box.height });
        }
      }
    }

    console.log('Small touch targets (<44px):', JSON.stringify(smallTargets, null, 2));

    // Save report
    await page.evaluate((targets) => {
      console.log('AUDIT REPORT - Small Touch Targets:', targets);
    }, smallTargets);
  });

  test('9. Horizontal Overflow Check', async ({ page }) => {
    const pages = ['/library', '/profile', '/settings', '/admin'];

    for (const pagePath of pages) {
      await page.goto(`https://fancai.ru${pagePath}`);
      await page.waitForLoadState('networkidle');

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      console.log(`${pagePath} horizontal overflow:`, hasOverflow);
      if (hasOverflow) {
        await page.screenshot({ path: `screenshots/overflow-${pagePath.replace('/', '')}.png`, fullPage: true });
      }
    }
  });

  test('10. Bottom Nav Visibility', async ({ page }) => {
    await page.goto('https://fancai.ru/library');
    await page.waitForLoadState('networkidle');

    // Check for bottom navigation on mobile
    const bottomNav = page.locator('nav').filter({ has: page.locator('a[href="/library"]') });
    const isFixed = await bottomNav.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.position === 'fixed' && style.bottom === '0px';
    }).catch(() => false);

    console.log('Bottom nav is fixed at bottom:', isFixed);
    await page.screenshot({ path: 'screenshots/10-bottom-nav.png' });
  });
});
