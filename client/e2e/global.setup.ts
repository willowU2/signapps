import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Global setup for Playwright tests
 * Runs once before all test files
 */

const authDir = path.join(__dirname, '../playwright/.auth');

setup('create auth directory', async () => {
  // Ensure the auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Create a placeholder auth file if it doesn't exist
  const authFile = path.join(authDir, 'user.json');
  if (!fs.existsSync(authFile)) {
    const defaultState = {
      cookies: [],
      origins: [],
    };
    fs.writeFileSync(authFile, JSON.stringify(defaultState, null, 2));
  }
});
