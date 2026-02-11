import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * Custom fixtures for SignApps E2E tests
 */

// Path to the authenticated state file
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Authenticated test fixture
 * Uses stored authentication state for tests that require login
 */
export const test = base.extend({
  // Use authenticated state for all tests
  storageState: authFile,
});

/**
 * Unauthenticated test fixture
 * For testing login flow and route protection
 */
export const unauthenticatedTest = base.extend({
  // No storage state - fresh browser context
  storageState: { cookies: [], origins: [] },
});

export { expect };

/**
 * Test data helpers
 */
export const testData = {
  validUser: {
    username: 'admin',
    password: 'admin123',
  },
  invalidUser: {
    username: 'invalid_user',
    password: 'wrong_password',
  },
  testContainer: {
    name: 'test-container-e2e',
    image: 'nginx:alpine',
  },
  testBucket: {
    name: 'test-bucket-e2e',
  },
  testFolder: {
    name: 'test-folder-e2e',
  },
};

/**
 * Page object helpers
 */
export const selectors = {
  // Auth
  loginForm: {
    username: 'input[id="username"]',
    password: 'input[id="password"]',
    submitButton: 'button[type="submit"]',
    errorMessage: '.bg-destructive\\/10',
    rememberMe: 'button[id="remember"]',
  },

  // Dashboard
  dashboard: {
    title: 'h1:has-text("Dashboard")',
    statCards: '[class*="StatCard"]',
    refreshButton: 'button:has-text("Refresh")',
  },

  // Navigation
  sidebar: {
    container: 'aside',
    navLinks: 'nav a',
    logo: 'a:has-text("SignApps")',
    collapseButton: 'aside button',
  },

  // Containers
  containers: {
    title: 'h1:has-text("Containers")',
    newButton: 'button:has-text("New Container")',
    searchInput: 'input[placeholder="Search containers..."]',
    containerCard: '[class*="Card"]',
    startButton: 'button:has-text("Start")',
    stopButton: 'button:has-text("Stop")',
    logsButton: 'button:has-text("Logs")',
  },

  // Storage
  storage: {
    title: 'h1:has-text("Storage")',
    tabs: '[role="tablist"]',
    uploadButton: 'button:has-text("Upload Files")',
    newFolderButton: 'button:has-text("New Folder")',
    fileList: '[class*="CardContent"]',
  },

  // Dialogs
  dialog: {
    container: '[role="dialog"]',
    title: '[role="dialog"] h2',
    closeButton: '[role="dialog"] button:has-text("Cancel")',
    submitButton: '[role="dialog"] button[type="submit"]',
  },
};
