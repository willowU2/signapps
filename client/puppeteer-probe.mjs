import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-gpu'],
        });

        const page = await browser.newPage();

        // Capture all console messages
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
            }
        });

        page.on('pageerror', error => {
            console.log(`[PAGE ERROR] ${error.message}`);
        });

        console.log('Navigating to http://localhost:3000...');
        await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 30000 });

        // Wait an extra 3 seconds
        await new Promise(r => setTimeout(r, 3000));

        console.log('Navigating to http://localhost:3000/calendar...');
        await page.goto('http://localhost:3000/calendar', { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        console.log('Navigating to http://localhost:3000/admin...');
        await page.goto('http://localhost:3000/admin', { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        console.log('Done scanning.');
        await browser.close();
    } catch (err) {
        console.error(`Script error: ${err.message}`);
    }
})();
