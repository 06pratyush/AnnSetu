import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Demo mode (no Supabase project configured): the database lives in the browser, so the people
// take turns in one browser instead of having one each. A farmer lists tomatoes (typed in Hinglish),
// a restaurant orders, the farmer promises a time and delivers, and the stock log adds up. A
// household's order waits to share a trip. The restaurant rates the order and posts a requirement
// that reaches the farmer's demand panel. The multi-browser version is marketplace.spec.ts.
test.skip(Boolean(process.env.E2E_SUPABASE), "demo mode only; E2E_SUPABASE=1 runs marketplace.spec.ts against Supabase");

const run = Date.now().toString(36);
const VARIETY = `E2E ${run}`;
const BUSINESS = `Hotel ${run}`;
// Throwaway accounts that exist only in this test browser's demo database.
const PASSWORD = `demo-pass-${run}`;
const people = {
  farmer: { name: "Ramesh Test", email: `farmer-${run}@example.test` },
  restaurant: { name: "Anita Test", email: `buyer-${run}@example.test` },
  home: { name: "Sam Test", email: `home-${run}@example.test` },
};

// About 8 km apart in Pune: inside a household's 25 km, a business's 100 km and the farm's 40 km.
const FARM = { latitude: 18.6, longitude: 73.8567 };
const CITY = { latitude: 18.5304, longitude: 73.8567 };

async function setUp(context: BrowserContext) {
  await context.grantPermissions(["geolocation"]);
  // Keep tests off the public Nominatim service: answer reverse-geocoding with a fixed address.
  await context.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      json: { address: { road: "Market Road", suburb: "Shivajinagar", city: "Pune", state_district: "Pune District", state: "Maharashtra", postcode: "411005" } },
    }),
  );
  await context.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 204 }));
}

async function signUp(page: Page, role: RegExp, who: { name: string; email: string }) {
  await page.goto("/signup/");
  await page.getByRole("radio", { name: role }).click();
  await page.getByLabel("Full name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Set up your profile" })).toBeVisible({ timeout: 60_000 });
}

async function onboard(page: Page, phone: string, business?: string) {
  await page.getByLabel("Mobile number").fill(phone);
  if (business) {
    await page.getByLabel("Business name").fill(business);
    await page.getByLabel("Type of business").selectOption({ label: "Restaurant or hotel" });
  }
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByLabel("PIN code")).toHaveValue("411005");
  await page.getByLabel("House or farm, street").fill("Plot 7, Market Road");
  await page.getByRole("button", { name: "Finish setup" }).click();
  // Saved once the app leaves onboarding for the person's home page.
  await page.waitForURL((url) => !url.pathname.startsWith("/onboarding"), { timeout: 60_000 });
}

async function signOut(page: Page, name: string) {
  await page.getByRole("button", { name: `Menu: ${name}` }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
}

async function signIn(page: Page, who: { email: string }) {
  await page.goto("/login/");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Signed in once the login page sends the person home.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function buy(page: Page, kg: number) {
  await page.goto("/market/");
  await page.getByLabel("Search produce").fill("Tomato");
  await expect(page.getByText("Showing farms for")).toBeVisible();
  await page.getByLabel("How much do you need?").fill(String(kg));
  await page.getByRole("link", { name: new RegExp(VARIETY) }).click();
  await expect(page.getByLabel(/Quantity of .+ in kg/)).toHaveValue(String(kg));
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await page.goto("/cart/");
  await page.getByRole("link", { name: "Go to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Delivery", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Order placed").first()).toBeVisible();
}

test("farmer and buyers trade in demo mode", async ({ page, context }) => {
  test.setTimeout(300_000);
  await setUp(context);
  // Surface the page's own warnings and errors in the test output.
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.log(`[page ${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => console.log(`[page error] ${e.message}`));

  await test.step("farmer signs up, onboards and lists 10 kg, finding the item by its Hindi name", async () => {
    await context.setGeolocation(FARM);
    await signUp(page, /Farmer/, people.farmer);
    await onboard(page, "9876543210");
    await expect(page.getByRole("heading", { name: /Namaste, Ramesh/ })).toBeVisible({ timeout: 30_000 });
    await page.goto("/farmer/produce/new/");
    await page.getByLabel("Produce name").fill("tamatar");
    await page.getByRole("option", { name: /Tomato/ }).click();
    await page.getByLabel("Variety").fill(VARIETY);
    await page.getByLabel("Price per kg (₹)").fill("32");
    await page.getByLabel("Quantity for sale").fill("10");
    await page.getByLabel("Minimum order").fill("1");
    await page.getByRole("button", { name: "Publish listing" }).click();
    await expect(page.getByText(VARIETY).first()).toBeVisible();
    await signOut(page, people.farmer.name);
  });

  await test.step("a restaurant signs up nearby, finds the listing and orders 4 kg", async () => {
    await context.setGeolocation(CITY);
    await signUp(page, /Industrial buyer/, people.restaurant);
    await onboard(page, "9123456789", BUSINESS);
    await buy(page, 4);
    await signOut(page, people.restaurant.name);
  });

  await test.step("the farmer accepts with a delivery time and delivers", async () => {
    await signIn(page, people.farmer);
    await page.goto("/farmer/orders/");
    const card = page.getByRole("article", { name: /Order #/ }).filter({ hasText: "Anita Test" });
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.getByRole("button", { name: "Accept order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Accept order" }).click();
    await expect(page.getByText("Order updated").first()).toBeVisible();
    for (const action of ["Mark packed", "Send for delivery", "Mark delivered"]) {
      await card.getByRole("button", { name: action }).click();
      await expect(page.getByText("Order updated").first()).toBeVisible();
    }
    await page.getByRole("tab", { name: /Completed/ }).click();
    await expect(page.getByRole("article").filter({ hasText: "Anita Test" }).getByText("Delivered")).toBeVisible();
  });

  await test.step("the stock adds up: 4 of 10 kg sold", async () => {
    await page.goto("/farmer/produce/");
    await expect(page.getByText("4 of 10 kg sold")).toBeVisible();
    await signOut(page, people.farmer.name);
  });

  await test.step("a household's 2 kg waits to share a trip with neighbours", async () => {
    await signUp(page, /Individual buyer/, people.home);
    await onboard(page, "9988776655");
    await buy(page, 2);
    await page.goto("/orders/");
    await expect(page.getByText("Waiting for neighbours").first()).toBeVisible();
    await signOut(page, people.home.name);
    await signIn(page, people.farmer);
    await page.goto("/farmer/orders/");
    await expect(page.getByRole("heading", { name: "1 shared trip forming" })).toBeVisible();
    await signOut(page, people.farmer.name);
  });

  await test.step("the restaurant rates the order and posts a requirement", async () => {
    await signIn(page, people.restaurant);
    await page.goto("/orders/");
    await page.getByRole("tab", { name: /Completed/ }).click();
    await page.getByRole("button", { name: "Rate this order" }).click();
    await page.getByRole("radio", { name: "Rate 5 out of 5" }).click();
    await page.getByRole("button", { name: "Submit rating" }).click();
    await expect(page.getByText("Thanks for the rating")).toBeVisible();

    await page.goto("/requirements/");
    await page.getByRole("button", { name: "Post a requirement" }).first().click();
    await page.getByLabel("Item needed").fill("pyaz");
    await page.getByRole("option", { name: /Onion/ }).click();
    await page.getByLabel("Quantity").fill("50");
    await page.getByRole("button", { name: "Post requirement" }).click();
    await expect(page.getByText("Requirement posted")).toBeVisible();
    await signOut(page, people.restaurant.name);
  });

  await test.step("the requirement shows on the farmer's demand panel", async () => {
    await signIn(page, people.farmer);
    await page.goto("/farmer/suggestions/");
    await expect(page.getByText(BUSINESS).first()).toBeVisible();
  });
});
