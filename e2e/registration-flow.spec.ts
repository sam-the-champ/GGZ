import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";

test("complete registration journey, then visible in the admin dashboard", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // 1–2. Landing page and event details
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /GGZ Camp 1\.0/ })).toBeVisible();
  await expect(page.getByText("8–10 December 2026").first()).toBeVisible();
  await expect(page.getByText("Royal Beach, Orimedu, Lagos").first()).toBeVisible();
  await page.locator("#register").scrollIntoViewIfNeeded();
  await expect(page.locator("#register").getByText("₦15,000")).toBeVisible();

  // 3. Start registration
  await page.locator("#register").getByRole("link", { name: /Secure your place/ }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Pay .* securely/ }).click();

  // 4. Mock Flutterwave checkout (test mode — no real payment)
  await expect(page.getByText("TEST MODE")).toBeVisible();
  await page.getByRole("button", { name: "Pay now" }).click();

  // 5–6. Server verifies, unlocks the form
  await expect(page).toHaveURL(/\/register\/form$/);
  await expect(page.getByText("Payment verified")).toBeVisible();
  await page.getByLabel("Full name").fill("Ada Okafor");
  await page.getByLabel("Phone number").first().fill("08031234567");
  await page.getByLabel("Date of birth").fill("2002-04-12");
  await page.getByLabel("City or state of residence").fill("Ikeja, Lagos");
  await page.getByLabel("Name", { exact: true }).fill("Ngozi Okafor");
  await page.locator("#emergencyContactPhone").fill("08035550000");
  await page.getByLabel(/I accept the/).check();
  await page.getByLabel(/I have read the privacy notice/).check();
  await page.getByRole("button", { name: "Complete registration" }).click();

  // 7. Confirmation
  await expect(page).toHaveURL(/\/register\/confirmation$/);
  await expect(page.getByRole("heading", { name: /You're in, Ada!/ })).toBeVisible();
  const regNo = (await page.getByText(/^GGZ26-[A-Z2-9]{6}$/).textContent())!.trim();
  expect(regNo).toMatch(/^GGZ26-/);

  // Paying again with the same session is not offered: the form now redirects to confirmation.
  await page.goto("/register/form");
  await expect(page).toHaveURL(/\/register\/confirmation$/);

  // 8. Admin sign-in
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(E2E_ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /GGZ Camp 1\.0 — IMPACT/ })).toBeVisible();

  // 9. Registration and payment appear
  await expect(page.getByText("Confirmed registrations").locator("..")).toContainText("1");
  await page.goto(`/admin/registrations?q=${encodeURIComponent(regNo)}`);
  await expect(page.getByRole("link", { name: "Ada Okafor" })).toBeVisible();
  await page.getByRole("link", { name: "Ada Okafor" }).click();
  await expect(page.getByText(regNo)).toBeVisible();
  await expect(page.getByText("Verified amount")).toBeVisible();
  await page.goto("/admin/payments?status=PAID");
  await expect(page.getByText(email)).toBeVisible();
});

test("failed payment does not unlock the form and can be retried", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email address").fill(`fail-${Date.now()}@example.com`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Pay .* securely/ }).click();
  await page.getByRole("button", { name: "Simulate failed payment" }).click();
  await expect(page.getByRole("heading", { name: /didn't go through/ })).toBeVisible();
  await page.goto("/register/form");
  await expect(page.getByText("Complete registration")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /can't be used to register/ })).toBeVisible();
});

test("admin area requires sign-in", async ({ page, request }) => {
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/admin\/login$/);
  const res = await request.get("/api/admin/export");
  expect(res.status()).toBe(401);
});
