const { chromium, devices } = require('playwright');

const iPhone = devices['iPhone 14'];
const credentials = {
  email: 'sandk008@gmail.com',
  password: 'Grh08hert12233fssa!'
};

async function runMobileAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...iPhone,
    locale: 'ru-RU',
  });
  const page = await context.newPage();

  const results = {
    pages: [],
    touchTargets: [],
    overflowIssues: [],
    screenshots: []
  };

  console.log('📱 Starting Mobile Audit for fancai.ru...\n');
  console.log(`Viewport: ${iPhone.viewport.width}x${iPhone.viewport.height}`);
  console.log(`User Agent: ${iPhone.userAgent.substring(0, 50)}...\n`);

  // 1. Login
  console.log('1️⃣ Testing Login Page...');
  await page.goto('https://fancai.ru/login');
  await page.screenshot({ path: 'screenshots/01-login-mobile.png', fullPage: true });

  const loginBtn = await page.locator('button:has-text("Войти")').boundingBox();
  console.log(`   Login button: ${loginBtn?.width}x${loginBtn?.height}px ${loginBtn?.height >= 44 ? '✅' : '⚠️ <44px'}`);

  await page.fill('input[type="email"], input[placeholder*="email" i]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button:has-text("Войти")');
  await page.waitForURL('**/');
  console.log('   Login successful ✅\n');

  // 2. Home Page
  console.log('2️⃣ Testing Home Page...');
  await page.screenshot({ path: 'screenshots/02-home-mobile.png', fullPage: true });

  const hasBottomNav = await page.locator('nav').filter({ hasText: /Главная|Библиотека/i }).count() > 0;
  console.log(`   Bottom Navigation: ${hasBottomNav ? '✅ Present' : '⚠️ Missing'}\n`);

  // 3. Library Page
  console.log('3️⃣ Testing Library Page...');
  await page.goto('https://fancai.ru/library');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/03-library-mobile.png', fullPage: true });

  const libraryOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log(`   Horizontal overflow: ${libraryOverflow ? '⚠️ YES' : '✅ No'}`);
  if (libraryOverflow) results.overflowIssues.push('/library');

  // Check touch targets on library page
  const buttons = await page.locator('button:visible, a:visible').all();
  let smallTargets = [];
  for (let i = 0; i < Math.min(buttons.length, 30); i++) {
    const box = await buttons[i].boundingBox();
    if (box && (box.width < 44 || box.height < 44)) {
      const text = await buttons[i].textContent() || await buttons[i].getAttribute('aria-label') || `btn-${i}`;
      smallTargets.push({ text: text.trim().substring(0, 25), w: Math.round(box.width), h: Math.round(box.height) });
    }
  }
  if (smallTargets.length > 0) {
    console.log(`   Small touch targets (<44px): ${smallTargets.length}`);
    smallTargets.slice(0, 5).forEach(t => console.log(`     - "${t.text}": ${t.w}x${t.h}px`));
    results.touchTargets.push({ page: '/library', targets: smallTargets });
  } else {
    console.log('   Touch targets: ✅ All >= 44px');
  }
  console.log('');

  // 4. Profile Page
  console.log('4️⃣ Testing Profile Page...');
  await page.goto('https://fancai.ru/profile');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/04-profile-mobile.png', fullPage: true });

  const profileOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log(`   Horizontal overflow: ${profileOverflow ? '⚠️ YES' : '✅ No'}\n`);
  if (profileOverflow) results.overflowIssues.push('/profile');

  // 5. Settings Page
  console.log('5️⃣ Testing Settings Page...');
  await page.goto('https://fancai.ru/settings');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/05-settings-mobile.png', fullPage: true });

  const settingsOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log(`   Horizontal overflow: ${settingsOverflow ? '⚠️ YES' : '✅ No'}\n`);
  if (settingsOverflow) results.overflowIssues.push('/settings');

  // 6. Admin Page
  console.log('6️⃣ Testing Admin Page...');
  await page.goto('https://fancai.ru/admin');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/06-admin-mobile.png', fullPage: true });

  const adminOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log(`   Horizontal overflow: ${adminOverflow ? '⚠️ YES' : '✅ No'}`);
  if (adminOverflow) results.overflowIssues.push('/admin');

  // Check admin tabs
  const tabs = await page.locator('[role="tablist"], [class*="tab"]').first();
  if (await tabs.isVisible()) {
    const tabBox = await tabs.boundingBox();
    console.log(`   Tabs width: ${tabBox?.width}px (viewport: ${iPhone.viewport.width}px)`);
  }
  console.log('');

  // 7. Reader Page
  console.log('7️⃣ Testing Reader Page...');
  await page.goto('https://fancai.ru/library');
  await page.waitForLoadState('networkidle');

  const bookCard = page.locator('button:has-text("Open"), [class*="book"]').first();
  if (await bookCard.isVisible()) {
    await bookCard.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/07-reader-mobile.png', fullPage: true });

    const readerOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    console.log(`   Horizontal overflow: ${readerOverflow ? '⚠️ YES' : '✅ No'}`);
    if (readerOverflow) results.overflowIssues.push('/reader');

    // Check toolbar visibility
    const toolbar = await page.locator('header, [class*="toolbar" i]').first();
    console.log(`   Toolbar visible: ${await toolbar.isVisible() ? '✅' : '⚠️'}`);
  }
  console.log('');

  // 8. Test on smaller screen (iPhone SE)
  console.log('8️⃣ Testing on iPhone SE (375px)...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('https://fancai.ru/library');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/08-library-iphonese.png', fullPage: true });

  const seOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log(`   Library overflow (375px): ${seOverflow ? '⚠️ YES' : '✅ No'}`);
  if (seOverflow) results.overflowIssues.push('/library@375px');

  // 9. Test on small Android (360px)
  console.log('9️⃣ Testing on Small Android (360px)...');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('https://fancai.ru/library');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/09-library-360px.png', fullPage: true });

  const smallOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log(`   Library overflow (360px): ${smallOverflow ? '⚠️ YES' : '✅ No'}`);
  if (smallOverflow) results.overflowIssues.push('/library@360px');

  // 10. Test on very small screen (320px)
  console.log('🔟 Testing on Very Small Screen (320px)...');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('https://fancai.ru/library');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/10-library-320px.png', fullPage: true });

  const tinyOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log(`   Library overflow (320px): ${tinyOverflow ? '⚠️ YES' : '✅ No'}\n`);
  if (tinyOverflow) results.overflowIssues.push('/library@320px');

  // Summary
  console.log('=' .repeat(50));
  console.log('📊 AUDIT SUMMARY');
  console.log('=' .repeat(50));
  console.log(`Screenshots saved: 10`);
  console.log(`Overflow issues: ${results.overflowIssues.length > 0 ? results.overflowIssues.join(', ') : 'None ✅'}`);
  console.log(`Touch target issues: ${results.touchTargets.length > 0 ? results.touchTargets.map(t => `${t.page}: ${t.targets.length}`).join(', ') : 'None ✅'}`);
  console.log('=' .repeat(50));

  await browser.close();
  return results;
}

runMobileAudit().catch(console.error);
