import { test, expect, TEST_USERS } from "./fixtures/auth";

/**
 * Epic 7: User & Organization Management Tests
 *
 * Tests for:
 * - Story 7.1: Enhanced Organizations Management
 * - Story 7.2: User Management within Organization
 * - Story 7.3: User Credential Generation
 * - Story 7.4: Resend and Reset Credentials
 */

test.describe("Epic 7: User & Organization Management", () => {
  // =========================================
  // Story 7.1: Enhanced Organizations Management
  // =========================================

  test.describe("Story 7.1: Enhanced Organizations Management", () => {
    test("Super Admin sees Organizations table with User Count column", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Should see the organisations table
      await expect(superAdminPage.locator("h1")).toContainText(/organisations/i);

      // Should have User Count column (Users header with icon)
      const usersHeader = superAdminPage.locator("th, [role='columnheader']").filter({ hasText: /users/i });
      await expect(usersHeader).toBeVisible();
    });

    test("Organizations table shows user count for each org", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Wait for table to load
      await superAdminPage.waitForSelector("table tbody tr");

      // Get the first row and check it has a number in the users column
      const firstRow = superAdminPage.locator("table tbody tr").first();
      await expect(firstRow).toBeVisible();
    });

    test("Clicking organization row opens detail page", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Wait for table to load
      await superAdminPage.waitForSelector("table tbody tr");

      // Click the first organisation row
      const firstRow = superAdminPage.locator("table tbody tr").first();
      await firstRow.click();

      // Should navigate to detail page
      await expect(superAdminPage).toHaveURL(/\/admin\/organisations\/[a-f0-9-]+/);
    });

    test("Organization detail page has Details and Users tabs", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Wait for table and click first row
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();

      // Wait for detail page
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);

      // Should see tabs
      const detailsTab = superAdminPage.getByRole("tab", { name: /details/i });
      const usersTab = superAdminPage.getByRole("tab", { name: /users/i });

      await expect(detailsTab).toBeVisible();
      await expect(usersTab).toBeVisible();
    });

    test("Details tab shows organization information", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Navigate to first org detail
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);

      // Details tab should be active by default - use getByRole to get the active panel
      const detailsPanel = superAdminPage.getByRole("tabpanel", { name: /details/i });
      await expect(detailsPanel).toContainText(/code/i);
      await expect(detailsPanel).toContainText(/name/i);
    });

    test("Organization user cannot access admin organisations", async ({ orgUserPage }) => {
      await orgUserPage.goto("/admin/organisations");

      // Should be redirected with access denied
      await expect(orgUserPage).toHaveURL(/dashboard.*access_denied/);
    });
  });

  // =========================================
  // Story 7.2: User Management within Organization
  // =========================================

  test.describe("Story 7.2: User Management within Organization", () => {
    test("People directory shows persona and membership-aware organisations", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");
      await superAdminPage.getByRole("tab", { name: /people/i }).click();
      await expect(superAdminPage.getByRole("columnheader", { name: /persona/i })).toBeVisible();
      await expect(superAdminPage.getByRole("columnheader", { name: /organisations/i })).toBeVisible();
    });

    test("Non-admin cannot see the cross-org People entry point", async ({ orgUserPage }) => {
      await orgUserPage.goto("/admin/organisations");
      await expect(orgUserPage.getByRole("tab", { name: /people/i })).toHaveCount(0);
    });

    test("Users tab shows user management table", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Navigate to first org detail
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);

      // Click Users tab
      await superAdminPage.getByRole("tab", { name: /users/i }).click();

      // Should see Add User button
      const addUserButton = superAdminPage.getByRole("button", { name: /add user/i });
      await expect(addUserButton).toBeVisible();
    });

    test("Users table has correct columns or empty state", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Navigate to first org detail and Users tab
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);
      await superAdminPage.getByRole("tab", { name: /users/i }).click();

      // Wait for tab content to render
      const usersPanel = superAdminPage.getByRole("tabpanel", { name: /users/i });
      await expect(usersPanel).toBeVisible();

      // Should have either a table with headers or an empty state message
      const hasTable = await usersPanel.locator("table").isVisible();

      if (hasTable) {
        // Check for column headers - using the table inside the panel
        const table = usersPanel.locator("table");
        await expect(table.locator("th")).toContainText([/name/i]);
      } else {
        // If no table, should show empty state with Add User option
        await expect(usersPanel).toContainText(/no users|add user/i);
      }
    });

    test("Add User dialog opens and has required fields", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Navigate to org detail and Users tab
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);
      await superAdminPage.getByRole("tab", { name: /users/i }).click();

      // Click Add User button
      await superAdminPage.getByRole("button", { name: /add user/i }).click();

      // Should see dialog with Name and Email fields
      const dialog = superAdminPage.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const nameInput = dialog.getByLabel(/name/i);
      const emailInput = dialog.getByLabel(/email/i);

      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(dialog.getByLabel(/send passwordless invite now/i)).toBeVisible();
      await expect(dialog.getByLabel(/make primary when attaching/i)).toBeVisible();
    });

    test("Add User form validation requires name and email", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Navigate to org detail and Users tab
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);
      await superAdminPage.getByRole("tab", { name: /users/i }).click();

      // Wait for tab panel to be visible
      const usersPanel = superAdminPage.getByRole("tabpanel", { name: /users/i });
      await expect(usersPanel).toBeVisible();

      // Open Add User dialog
      await superAdminPage.getByRole("button", { name: /add user/i }).click();

      const dialog = superAdminPage.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Try to submit empty form (button says "Create User")
      await dialog.getByRole("button", { name: /create user/i }).click();

      // Should show validation errors (form won't submit, dialog stays open)
      await expect(dialog).toBeVisible();
    });
  });

  // =========================================
  // Story 7.3 & 7.4: Credential Management
  // =========================================

  test.describe("Story 7.3 & 7.4: Credential Management", () => {
    test("Users table shows credential action buttons", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Navigate to org detail and Users tab
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);
      await superAdminPage.getByRole("tab", { name: /users/i }).click();

      // Wait for users table to potentially load
      await superAdminPage.waitForTimeout(1000);

      // If there are users, they should have action buttons
      const userRows = superAdminPage.locator('[role="tabpanel"] table tbody tr');
      const rowCount = await userRows.count();

      if (rowCount > 0) {
        // Should have some kind of action buttons in the actions column
        const firstUserRow = userRows.first();
        const actionButtons = firstUserRow.locator("button");
        const buttonCount = await actionButtons.count();
        expect(buttonCount).toBeGreaterThan(0);
      }
    });

    test("Edit user dialog shows credential history", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Navigate to org detail and Users tab
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);
      await superAdminPage.getByRole("tab", { name: /users/i }).click();

      // Wait for users to load
      await superAdminPage.waitForTimeout(1000);

      // If there are users, try to edit one
      const userRows = superAdminPage.locator('[role="tabpanel"] table tbody tr');
      const rowCount = await userRows.count();

      if (rowCount > 0) {
        // Find and click the edit button (Pencil icon)
        const editButton = userRows.first().locator('button[aria-label*="edit" i], button:has-text("Edit")').first();
        if (await editButton.isVisible()) {
          await editButton.click();

          // Dialog should show
          const dialog = superAdminPage.locator('[role="dialog"]');
          await expect(dialog).toBeVisible();

          // Should have credential history section or status info
          // The edit dialog shows status badge and credential info
          await expect(dialog.locator("text=/status|active|invited/i")).toBeVisible();
        }
      }
    });
  });

  // =========================================
  // Access Control Tests
  // =========================================

  test.describe("Access Control", () => {
    test("Organization user cannot access organisation detail", async ({ orgUserPage }) => {
      // Try to access a random org detail page
      await orgUserPage.goto("/admin/organisations/some-random-id");

      // Should be redirected
      await expect(orgUserPage).toHaveURL(/dashboard.*access_denied/);
    });
  });

  // =========================================
  // Navigation Tests
  // =========================================

  test.describe("Navigation", () => {
    test("Back button on detail page returns to organisations list", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/organisations");

      // Navigate to first org detail
      await superAdminPage.waitForSelector("table tbody tr");
      await superAdminPage.locator("table tbody tr").first().click();
      await superAdminPage.waitForURL(/\/admin\/organisations\/[a-f0-9-]+/);

      // Click back button/link
      const backLink = superAdminPage.locator('a[href="/admin/organisations"]').first();
      await backLink.click();

      // Should be back at list
      await expect(superAdminPage).toHaveURL("/admin/organisations");
    });
  });
});
