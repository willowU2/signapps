const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('response', response => {
    if (response.status() === 404) {
      console.log(`[404] ${response.url()}`);
    }
  });

  console.log("Navigating to http://localhost:3000/login?auto=admin");
  try {
    await page.goto('http://localhost:3000/login?auto=admin', { waitUntil: 'networkidle2' });
  } catch (e) {
    console.error("Navigation error:", e);
  }
  await browser.close();
})();
