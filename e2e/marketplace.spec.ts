import { expect, test, type Browser, type Page } from "@playwright/test";

// Three people signed in at the same time in separate browser contexts. A farmer lists tomatoes
// (typed in Hinglish). A restaurant finds them by search and orders; the farmer sees it arrive live,
// promises a delivery time and delivers, and the stock log adds up. A household's order waits to
// share a trip with neighbours. The restaurant rates the order and posts a requirement that reaches
// the farmer's demand panel.

const run = Date.now().toString(36);
const VARIETY = `E2E ${run}`;
const BUSINESS = `Hotel ${run}`;
const PASSWORD = `test-pass-${run}`;
const base = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = (p: string) => `${base}${p}`;

// About 8 km apart in Pune: inside a household's 25 km, a business's 100 km and the farm's 40 km.
const FARM = { latitude: 18.6, longitude: 73.8567 };
const CITY = { latitude: 18.5304, longitude: 73.8567 };

async function newPerson(browser: Browser, coords: { latitude: number; longitude: number }) {
  const context = await browser.newContext({ geolocation: coords, permissions: ["geolocation"], locale: "en-IN" });
  // Keep tests off the public Nominatim service: answer reverse-geocoding with a fixed address.
  await context.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      json: { address: { road: "Market Road", suburb: "Shivajinagar", city: "Pune", state_district: "Pune District", state: "Maharashtra", postcode: "411005" } },
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

async function onboard(page: Page, phone: string, business?: string) {
  await page.getByLabel("Mobile number").fill(phone);
  if (business) {
    await page.getByLabel("Business name").fill(business);
    await page.getByLabel("Type of business").selectOption({ label: "Restaurant or hotel" });
  }
  // The map pin is required: distance rules need the exact spot.
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByLabel("PIN code")).toHaveValue("411005");
  await page.getByLabel("House or farm, street").fill("Plot 7, Market Road");
  await page.getByRole("button", { name: "Finish setup" }).click();
}

/** From the market: search, say how much, open this run's listing, add it to the cart and check out. */
async function buy(page: Page, kg: number) {
  await page.goto(url("/market/"));
  await page.getByLabel("Search produce").fill("Tomato");
  await expect(page.getByText("Showing farms for")).toBeVisible();
  await page.getByLabel("How much do you need?").fill(String(kg));
  await page.getByRole("link", { name: new RegExp(VARIETY) }).click();
  const qty = page.getByLabel(/Quantity of .+ in kg/);
  await expect(qty).toHaveValue(String(kg));
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await page.goto(url("/cart/"));
  await page.getByRole("link", { name: "Go to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Delivery", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Order placed").first()).toBeVisible();
}

test("farmer and buyers trade at the same time", async ({ browser }) => {
  const farmer = await newPerson(browser, FARM);
  const restaurant = await newPerson(browser, CITY);
  const home = await newPerson(browser, CITY);

  await test.step("farmer signs up, onboards and lists 10 kg, finding the item by its Hindi name", async () => {
    await signUp(farmer, /Farmer/, "Ramesh Test", `farmer-${run}@example.com`);
    await onboard(farmer, "9876543210");
    await expect(farmer.getByRole("heading", { name: /Namaste, Ramesh/ })).toBeVisible();
    await farmer.goto(url("/farmer/produce/new/"));
    await farmer.getByLabel("Produce name").fill("tamatar");
    await farmer.getByRole("option", { name: /Tomato/ }).click();
    await farmer.getByLabel("Variety").fill(VARIETY);
    await farmer.getByLabel("Price per kg (₹)").fill("32");
    await farmer.getByLabel("Quantity for sale").fill("10");
    await farmer.getByLabel("Minimum order").fill("1");
    await farmer.getByRole("button", { name: "Publish listing" }).click();
    await expect(farmer.getByText(VARIETY).first()).toBeVisible();
    await farmer.goto(url("/farmer/orders/"));
  });

  await test.step("a restaurant signs up, finds the listing and orders 4 kg", async () => {
    await signUp(restaurant, /Industrial buyer/, "Anita Test", `buyer-${run}@example.com`);
    await onboard(restaurant, "9123456789", BUSINESS);
    await buy(restaurant, 4);
  });

  await test.step("the farmer sees the order arrive live, promises a time and delivers it", async () => {
    const card = farmer.getByRole("article", { name: /Order #/ }).filter({ hasText: "Anita Test" });
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.getByRole("button", { name: "Accept order" }).click();
    await farmer.getByRole("dialog").getByRole("button", { name: "Accept order" }).click();
    await expect(farmer.getByText("Order updated").first()).toBeVisible();
    for (const action of ["Mark packed", "Send for delivery", "Mark delivered"]) {
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

  await test.step("a household's 2 kg waits to share a trip with neighbours", async () => {
    await signUp(home, /Individual buyer/, "Sam Test", `home-${run}@example.com`);
    await onboard(home, "9988776655");
    await buy(home, 2);
    await home.goto(url("/orders/"));
    await expect(home.getByText("Waiting for neighbours").first()).toBeVisible();
    await farmer.goto(url("/farmer/orders/"));
    await expect(farmer.getByRole("heading", { name: "1 shared trip forming" })).toBeVisible();
  });

  await test.step("the restaurant rates the order and posts a requirement", async () => {
    await restaurant.goto(url("/orders/"));
    await restaurant.getByRole("tab", { name: /Completed/ }).click();
    await restaurant.getByRole("button", { name: "Rate this order" }).click();
    await restaurant.getByRole("radio", { name: "Rate 5 out of 5" }).click();
    await restaurant.getByRole("button", { name: "Submit rating" }).click();
    await expect(restaurant.getByText("Thanks for the rating")).toBeVisible();

    await restaurant.goto(url("/requirements/"));
    await restaurant.getByRole("button", { name: "Post a requirement" }).first().click();
    await restaurant.getByLabel("Item needed").fill("pyaz");
    await restaurant.getByRole("option", { name: /Onion/ }).click();
    await restaurant.getByLabel("Quantity").fill("50");
    await restaurant.getByRole("button", { name: "Post requirement" }).click();
    await expect(restaurant.getByText("Requirement posted")).toBeVisible();
  });

  await test.step("the requirement shows on the farmer's demand panel", async () => {
    await farmer.goto(url("/farmer/suggestions/"));
    await expect(farmer.getByText(BUSINESS).first()).toBeVisible();
  });
});
