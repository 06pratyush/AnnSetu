/** True when the app under test runs in demo mode: its pages carry the demo banner. */
export async function isDemoMode(baseURL: string | undefined): Promise<boolean> {
  const html = await (await fetch(`${(baseURL ?? "http://localhost:3000").replace(/\/$/, "")}/`)).text();
  return html.includes("Demo mode:");
}
