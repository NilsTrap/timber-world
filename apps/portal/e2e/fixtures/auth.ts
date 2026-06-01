import { test as base, Page } from "@playwright/test";

/**
 * Test User Credentials
 *
 * These users must exist in the target (staging) database for tests to work.
 * In CI, supply real credentials via GitHub secrets — the playwright job maps
 * them to these env vars (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD / E2E_ORG_EMAIL
 * / E2E_ORG_PASSWORD). The literals below are local-dev fallbacks only and are
 * NOT valid passwords; override them via env (or a local .env) to run locally.
 */
export const TEST_USERS = {
  superAdmin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "nils@nils.lv",
    password: process.env.E2E_ADMIN_PASSWORD ?? "TestAdmin123",
    name: "Nils",
  },
  orgUser: {
    email: process.env.E2E_ORG_EMAIL ?? "nils@thewoodandgood.com",
    password: process.env.E2E_ORG_PASSWORD ?? "TestProducer123",
    name: "Producer",
    orgCode: "INE",
    orgName: "Inerce", // Full organization name shown in sidebar
  },
};

/**
 * Login helper function
 */
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/);
}

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  superAdminPage: Page;
  orgUserPage: Page;
}>({
  /**
   * Page logged in as Super Admin
   */
  superAdminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);
    await use(page);
    await context.close();
  },

  /**
   * Page logged in as Organization User
   */
  orgUserPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, TEST_USERS.orgUser.email, TEST_USERS.orgUser.password);
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
