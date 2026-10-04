import { expect, test, type Browser, type Page } from "@playwright/test";

// Two people signed in at the same time in separate browser contexts: a farmer lists tomatoes,
// a buyer orders some, the farmer sees the order arrive live and delivers it, the stock log adds up,
// the buyer rates the order and posts a requirement that reaches the farmer's demand panel.

const run = Date.now().toString(36);
const PRODUCE = `Tomato ${run}`;
const PASSWORD = `test-pass-${run}`;
const base = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = (p: string) => `${base}${p}`;

async function newPerson(browser: Browser, coords: { latitude: number; longitude: number }) {
  const context = await browser.newContext({ geolocation: coords, permissions: ["geolocation"], locale: "en-IN" });
  // Keep tests off the public Nominatim service: answer reverse-geocoding with a fixed address.
  await context.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      json: { address: { road: "Market Road", suburb: "Shivajinagar", city: "Pune", state_district: "Pune", state: "Maharashtra", postcode: "411005" } },
    }),
  );
  await context.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 204 }));
  return context.newPage();
}

async function signUp(page: Page, role: RegExp, name: string, email: string) {
  await page.goto(url("/signup/"));
  await page.getByRole("radio", { name: role }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Set up your profile" })).toBeVisible();
}

async function onboard(page: Page, phone: string) {
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByLabel("PIN code")).toHaveValue("411005");
  await page.getByLabel("House or farm, street").fill("Plot 7, Market Road");
  await page.getByRole("button", { name: "Finish setup" }).click();
}

test("farmer and buyer trade at the same time", async ({ browser }) => {
  const farmer = await newPerson(browser, { latitude: 19.2051, longitude: 73.8746 });
  const buyer = await newPerson(browser, { latitude: 18.5304, longitude: 73.8567 });

  await test.step("farmer signs up, onboards and lists 10 kg", async () => {
    await signUp(farmer, /Farmer/, "Ramesh Test", `farmer-${run}@example.com`);
    await onboard(farmer, "9876543210");
    await expect(farmer.getByRole("heading", { name: /Namaste, Ramesh/ })).toBeVisible();
    await farmer.goto(url("/farmer/produce/new/"));
    await farmer.getByLabel("Produce name").fill(PRODUCE);
    await farmer.getByLabel("Price per kg (₹)").fill("32");
    await farmer.getByLabel("Quantity for sale").fill("10");
    await farmer.getByLabel("Minimum order").fill("1");
    await farmer.getByRole("button", { name: "Publish listing" }).click();
    await expect(farmer.getByRole("heading", { name: PRODUCE })).toBeVisible();
    await farmer.goto(url("/farmer/orders/"));
  });

  await test.step("buyer signs up, finds the listing and orders 4 kg", async () => {
    await signUp(buyer, /Individual buyer/, "Anita Test", `buyer-${run}@example.com`);
    await onboard(buyer, "9123456789");
    await buyer.goto(url("/market/"));
    await buyer.getByLabel("Search produce").fill(PRODUCE);
    await buyer.getByRole("link", { name: new RegExp(PRODUCE) }).click();
    const qty = buyer.getByLabel(`Quantity of ${PRODUCE} in kg`);
    await qty.fill("4");
    await qty.blur();
    await buyer.getByRole("button", { name: /Add to cart/ }).click();
    await buyer.goto(url("/cart/"));
    await buyer.getByRole("link", { name: "Go to checkout" }).click();
    await buyer.getByRole("button", { name: "Place order" }).click();
    await expect(buyer.getByText("Order placed")).toBeVisible();
  });

  await test.step("the farmer sees the order arrive live and delivers it", async () => {
    const card = farmer.getByRole("article", { name: /Order #/ }).filter({ hasText: "Anita Test" });
    await expect(card).toBeVisible({ timeout: 20_000 });
    for (const action of ["Accept order", "Mark packed", "Send for delivery", "Mark delivered"]) {
      await card.getByRole("button", { name: action }).click();
      await expect(farmer.getByText("Order updated").first()).toBeVisible();
    }
    await farmer.getByRole("tab", { name: /Completed/ }).click();
    await expect(farmer.getByRole("article").filter({ hasText: "Anita Test" }).getByText("Delivered")).toBeVisible();
  });

  await test.step("the stock adds up: 4 of 10 kg sold", async () => {
    await farmer.goto(url("/farmer/produce/"));
    await expect(farmer.getByText("4 of 10 kg sold")).toBeVisible();
  });

  await test.step("the buyer rates the order and posts a requirement", async () => {
    await buyer.goto(url("/orders/"));
    await buyer.getByRole("tab", { name: /Completed/ }).click();
    await buyer.getByRole("button", { name: "Rate this order" }).click();
    await buyer.getByRole("radio", { name: "Rate 5 out of 5" }).click();
    await buyer.getByRole("button", { name: "Submit rating" }).click();
    await expect(buyer.getByText("Thanks for the rating")).toBeVisible();

    await buyer.goto(url("/requirements/"));
    await buyer.getByRole("button", { name: "Post a requirement" }).first().click();
    await buyer.getByLabel("Item needed").fill(`Onion ${run}`);
    await buyer.getByLabel("Quantity").fill("50");
    await buyer.getByRole("button", { name: "Post requirement" }).click();
    await expect(buyer.getByText("Requirement posted")).toBeVisible();
  });

  await test.step("the requirement shows on the farmer's demand panel", async () => {
    await farmer.goto(url("/farmer/suggestions/"));
    await expect(farmer.getByRole("heading", { name: `Onion ${run}` })).toBeVisible();
  });
});
