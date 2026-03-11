import { test, expect, chromium } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

// Timeout accru pour le lancement de l'application pèse lourd
test.describe.configure({ mode: 'serial', timeout: 60000 });

test.describe('Tauri Native Binary E2E (Windows WebView2 CDP)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let tauriProcess: ChildProcess;
  let browser: any;
  let page: any;
  
  const executablePath = path.join(__dirname, '../../target/release/signapps-tauri.exe');

  test.beforeAll(async () => {
    // Vérifier si l'exécutable existe
    const exists = fs.existsSync(executablePath);
    console.log(`Executable exists: ${exists} at ${executablePath}`);
    if (!exists) {
      throw new Error(`Tauri executable not found at ${executablePath}`);
    }

    // Lancer Tauri avec un port distant de debug ouvert pour WebView2
    // La variable d'environnement WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS active le CDP sous Windows
    tauriProcess = spawn(executablePath, [], {
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=1420',
      },
      stdio: 'ignore'
    });

    // Attendre que la WebView2 ouvre le port 1420 
    // On boucle jusqu'à ce que la connexion CDP réussisse
    let connected = false;
    let retries = 0;
    
    while (!connected && retries < 20) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        browser = await chromium.connectOverCDP('http://127.0.0.1:1420');
        connected = true;
      } catch (e) {
        retries++;
        console.log(`Waiting for Tauri CDP port... (${retries}/20)`);
      }
    }

    if (!connected) {
      tauriProcess.kill('SIGINT');
      throw new Error('Failed to connect to Tauri WebView2 via CDP (Port 1420). Debug mode might be stripped in release build or WebView2 is not respecting the ENV var.');
    }

    // Récupérer la fenêtre principale de Tauri
    const defaultContext = browser.contexts()[0];
    page = defaultContext.pages()[0];
    
    // Si la page met du temps à se charger
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
    if (tauriProcess) tauriProcess.kill('SIGKILL');
  });

  test('Tauri window should load the Next.js App Shell', async () => {
    // Purge the persisted WebView2 state to force a fresh login
    // And force navigation via Javascript to avoid Playwright protocol conflicts (tauri:// or http://tauri.localhost/)
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        // Since Next.js export generates HTML files, let Tauri custom protocol resolve extensionless paths
        window.location.href = '/login';
    });
    
    // Wait for the route to change and page to load
    await page.waitForTimeout(3000);
    
    const title = await page.title();
    console.log('Tauri App Title:', title);
    console.log('Current Tauri URL:', page.url());
    
    // Si nous sommes sur le formulaire
    await expect(page.getByText('Welcome Back')).toBeVisible({ timeout: 15000 });
  });

  test('Tauri should successfully authenticate to the local SeaORM Backend', async () => {
    // Test de clic E2E absolu : l'UI native contacte l'API locale
    const usernameInput = page.getByLabel(/username/i);
    await usernameInput.click({ force: true });
    await usernameInput.fill('admin');

    const passwordInput = page.getByLabel(/password/i);
    await passwordInput.click({ force: true });
    await passwordInput.fill('password123');

    await page.getByRole('button', { name: 'Sign In' }).click({ force: true });

    // Verifier la redirection valide
    await page.waitForURL(/\/(dashboard|login\/verify)/, { timeout: 15000 });
    
    // Le tableau de bord Next.js s'affiche dans l'exe Tauri
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
