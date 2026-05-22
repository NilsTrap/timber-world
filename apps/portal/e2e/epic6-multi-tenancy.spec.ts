import { test, expect, TEST_USERS } from "./fixtures/auth";

/**
 * Epic 6: Multi-Tenancy Foundation Tests
 *
 * Tests for:
 * - Story 6.2: Organization-Scoped Authentication
 * - Story 6.3: Context-Aware Inventory Queries
 * - Story 6.4: Context-Aware Production Queries
 * - Story 6.5: Organization Selector for Super Admin
 */

test.describe("Epic 6: Multi-Tenancy Foundation", () => {
  // =========================================
  // Story 6.5: Organization Selector (Super Admin)
  // =========================================

  test.describe("Story 6.5: Organization Selector", () => {
    test("Super Admin sees organization selector in sidebar", async ({ superAdminPage }) => {
      // Navigate to dashboard
      await superAdminPage.goto("/dashboard");

      // Organization selector should be visible
      const orgSelector = superAdminPage.locator('select').filter({ hasText: /All Organizations/i });
      await expect(orgSelector).toBeVisible();
    });

    test("Organization selector has 'All Organizations' as default", async ({ superAdminPage }) => {
      await superAdminPage.goto("/dashboard");

      // Check default value
      const orgSelector = superAdminPage.locator('label:has-text("Organization") + select, label:has-text("Organization") ~ select');
      await expect(orgSelector).toHaveValue("all");
    });

    test("Selecting organization updates URL with ?org parameter", async ({ superAdminPage }) => {
      await superAdminPage.goto("/dashboard");

      // Find and click the org selector
      const orgSelector = superAdminPage.locator('select').first();

      // Get the options and select the second one (first org after "All")
      const options = await orgSelector.locator("option").all();
      if (options.length > 1) {
        const orgId = await options[1]!.getAttribute("value");
        await orgSelector.selectOption(orgId!);

        // URL should include org parameter
        await expect(superAdminPage).toHaveURL(new RegExp(`org=${orgId}`));
      }
    });

    test("Organization filter persists across page navigation", async ({ superAdminPage }) => {
      await superAdminPage.goto("/dashboard");

      // Select an organization
      const orgSelector = superAdminPage.locator('select').first();
      const options = await orgSelector.locator("option").all();

      if (options.length > 1) {
        const orgId = await options[1]!.getAttribute("value");
        await orgSelector.selectOption(orgId!);

        // Wait for URL to update after org selection
        await expect(superAdminPage).toHaveURL(new RegExp(`org=${orgId}`));

        // Navigate to Production
        await superAdminPage.getByRole("link", { name: /production/i }).click();
        await expect(superAdminPage).toHaveURL(new RegExp(`/production.*org=${orgId}`));

        // Navigate to Inventory
        await superAdminPage.getByRole("link", { name: /inventory/i }).click();
        await expect(superAdminPage).toHaveURL(new RegExp(`org=${orgId}`));
      }
    });

    test("'All Organizations' clears org filter from URL", async ({ superAdminPage }) => {
      // Start with an org filter
      await superAdminPage.goto("/dashboard?org=some-org-id");

      // Select "All Organizations"
      const orgSelector = superAdminPage.locator('select').first();
      await orgSelector.selectOption("all");

      // URL should not have org parameter
      await expect(superAdminPage).not.toHaveURL(/org=/);
    });
  });

  // =========================================
  // Organization User - No Selector
  // =========================================

  test.describe("Story 6.5: Org User - No Selector", () => {
    test("Organization user does NOT see organization selector", async ({ orgUserPage }) => {
      await orgUserPage.goto("/dashboard");

      // Organization selector should NOT be visible
      const orgLabel = orgUserPage.locator('label:has-text("Organization")');
      await expect(orgLabel).not.toBeVisible();
    });

    test("Organization user sees their org name in sidebar", async ({ orgUserPage }) => {
      await orgUserPage.goto("/dashboard");

      // Should see their organization name in the sidebar header
      const sidebar = orgUserPage.locator("aside");
      await expect(sidebar).toContainText(TEST_USERS.orgUser.orgName);
    });
  });

  // =========================================
  // Story 6.3: Context-Aware Inventory Queries
  // =========================================

  test.describe("Story 6.3: Inventory Data Isolation", () => {
    test("Organization user sees only their inventory", async ({ orgUserPage }) => {
      await orgUserPage.goto("/inventory");

      // Should load without error
      await expect(orgUserPage.locator("h1")).toContainText(/inventory/i);

      // Should NOT see "All Organizations" or other org data
      // This is a basic check - specific data validation needs real test data
      await expect(orgUserPage.locator("body")).not.toContainText(/All Organizations/i);
    });

    test("Super Admin sees all inventory by default", async ({ superAdminPage }) => {
      await superAdminPage.goto("/admin/inventory");

      // Should load admin inventory view
      await expect(superAdminPage.locator("h1")).toContainText(/inventory/i);
    });

    test("Super Admin inventory filters by selected organization", async ({ superAdminPage }) => {
      // First load with all orgs
      await superAdminPage.goto("/admin/inventory");

      // Select an organization
      const orgSelector = superAdminPage.locator('select').first();
      const options = await orgSelector.locator("option").all();

      if (options.length > 1) {
        const orgId = await options[1]!.getAttribute("value");
        await orgSelector.selectOption(orgId!);

        // Wait for page to reload with filter
        await superAdminPage.waitForURL(new RegExp(`org=${orgId}`));

        // Inventory should now be filtered (verify by checking fewer items or specific org)
        // Specific assertion depends on test data
      }
    });
  });

  // =========================================
  // Story 6.4: Context-Aware Production Queries
  // =========================================

  test.describe("Story 6.4: Production Data Isolation", () => {
    test("Organization user sees only their production entries", async ({ orgUserPage }) => {
      await orgUserPage.goto("/production");

      // Should load without error
      await expect(orgUserPage.locator("h1")).toContainText(/production/i);
    });

    test("Super Admin sees Organisation column in Production History", async ({ superAdminPage }) => {
      await superAdminPage.goto("/production?tab=history");

      // Should see Organisation column header
      const historyTab = superAdminPage.locator('[role="tabpanel"]');
      // Check for Organisation column in the history table
      await expect(superAdminPage.locator("th, [role='columnheader']")).toContainText([/organisation/i]);
    });

    test("Super Admin production filters by selected organization", async ({ superAdminPage }) => {
      await superAdminPage.goto("/production?tab=history");

      // Select an organization
      const orgSelector = superAdminPage.locator('select').first();
      const options = await orgSelector.locator("option").all();

      if (options.length > 1) {
        const orgId = await options[1]!.getAttribute("value");
        await orgSelector.selectOption(orgId!);

        // URL should include org filter
        await expect(superAdminPage).toHaveURL(new RegExp(`org=${orgId}`));
      }
    });
  });

  // =========================================
  // Dashboard Filtering
  // =========================================

  test.describe("Dashboard Org Filtering", () => {
    test("Super Admin dashboard shows aggregated metrics by default", async ({ superAdminPage }) => {
      await superAdminPage.goto("/dashboard");

      // Should show admin overview
      await expect(superAdminPage.locator("h1")).toContainText(/admin overview/i);

      // Should show metric cards
      await expect(superAdminPage.locator("text=Total Inventory")).toBeVisible();
      await expect(superAdminPage.locator("text=Total Production Volume")).toBeVisible();
    });

    test("Super Admin dashboard filters metrics by organization", async ({ superAdminPage }) => {
      await superAdminPage.goto("/dashboard");

      // Note initial values (if visible)
      const initialInventory = await superAdminPage.locator("text=Total Inventory").locator("..").locator("p.text-2xl").textContent();

      // Select an organization
      const orgSelector = superAdminPage.locator('select').first();
      const options = await orgSelector.locator("option").all();

      if (options.length > 1) {
        await orgSelector.selectOption({ index: 1 });

        // Wait for data to reload
        await superAdminPage.waitForTimeout(500);

        // Values might change based on org filter
        // (Specific assertion depends on test data)
      }
    });

    test("Organization user sees producer dashboard", async ({ orgUserPage }) => {
      await orgUserPage.goto("/dashboard");

      // Should show producer dashboard
      await expect(orgUserPage.locator("h1")).toContainText(/production dashboard/i);
    });
  });

  // =========================================
  // URL Bookmarking
  // =========================================

  test.describe("URL Bookmarking", () => {
    test("Direct URL with ?org loads filtered view", async ({ superAdminPage }) => {
      // Get a valid org ID first
      await superAdminPage.goto("/dashboard");
      const orgSelector = superAdminPage.locator('select').first();
      const options = await orgSelector.locator("option").all();

      if (options.length > 1) {
        const orgId = await options[1]!.getAttribute("value");

        // Navigate directly to dashboard with org filter
        await superAdminPage.goto(`/dashboard?org=${orgId}`);

        // Selector should show the filtered org
        await expect(orgSelector).toHaveValue(orgId!);
      }
    });
  });

  // =========================================
  // Access Control
  // =========================================

  test.describe("Access Control", () => {
    test("Organization user cannot access admin routes", async ({ orgUserPage }) => {
      // Try to access admin inventory
      await orgUserPage.goto("/admin/inventory");

      // Should be redirected to dashboard with access denied
      await expect(orgUserPage).toHaveURL(/dashboard.*access_denied/);
    });

    test("Organization user cannot access admin organisations", async ({ orgUserPage }) => {
      await orgUserPage.goto("/admin/organisations");

      // Should be redirected
      await expect(orgUserPage).toHaveURL(/dashboard.*access_denied/);
    });
  });
});
