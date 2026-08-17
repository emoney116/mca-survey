import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const screenshotDir = path.join(process.cwd(), ".next", "verification");
const runId = Date.now().toString().slice(-6);
const primaryPlayerName = `Verification Player ${runId}`;
const secondPlayerName = `Second Verification Player ${runId}`;
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

const goals = [
  "get-stronger",
  "sprint-speed",
  "agility",
  "lose-body-fat",
  "gain-weight",
  "nutrition",
  "flexibility-mobility",
  "conditioning",
  "core-strength",
  "sleep-schedule",
];

const goalLabels = {
  "get-stronger": "Get stronger",
  "sprint-speed": "Get faster / improve sprint speed",
  agility: "Get quicker / improve agility",
  "lose-body-fat": "Lose body fat",
  "gain-weight": "Gain weight",
  nutrition: "Learn to eat better / healthier",
  "flexibility-mobility": "Improve flexibility and mobility",
  conditioning: "Improve overall stamina / conditioning",
  "core-strength": "Improve core strength",
  "sleep-schedule": "Improve overall sleep schedule",
};

async function findExecutable() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep looking.
    }
  }

  throw new Error("No Chrome or Edge executable found. Set CHROME_PATH to run browser checks.");
}

function responsePayload(playerName, order = goals) {
  return {
    playerName,
    personalGoal: `${playerName} wants a strong, consistent fall.`,
    additionalNotes: `${playerName} is open to training groups.`,
    rankings: order.map((goalKey, index) => ({
      goalKey,
      goalLabel: goalLabels[goalKey],
      rank: index + 1,
    })),
  };
}

async function assertNoOverflow(page, label) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyTextLength: document.body.innerText.trim().length,
    overlay: Boolean(
      document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay"),
    ),
  }));

  if (result.overlay) {
    throw new Error(`${label}: framework error overlay detected`);
  }

  if (result.bodyTextLength === 0) {
    throw new Error(`${label}: page body is blank`);
  }

  if (result.scrollWidth > result.clientWidth + 1) {
    throw new Error(`${label}: horizontal overflow ${result.scrollWidth} > ${result.clientWidth}`);
  }
}

async function dispatchTouchDrag(page, sourceLocator, targetLocator) {
  const source = await sourceLocator.boundingBox();
  const target = await targetLocator.boundingBox();

  if (!source || !target) {
    throw new Error("Unable to locate drag source or target.");
  }

  const client = await page.context().newCDPSession(page);
  const startX = Math.round(source.x + source.width / 2);
  const startY = Math.round(source.y + source.height / 2);
  const endX = Math.round(target.x + target.width / 2);
  const endY = Math.round(target.y + target.height / 2);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y: startY, radiusX: 3, radiusY: 3 }],
  });
  await page.waitForTimeout(180);

  for (let step = 1; step <= 8; step += 1) {
    const x = startX + ((endX - startX) * step) / 8;
    const y = startY + ((endY - startY) * step) / 8;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y, radiusX: 3, radiusY: 3 }],
    });
    await page.waitForTimeout(25);
  }

  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(350);
}

async function run() {
  await mkdir(screenshotDir, { recursive: true });

  const executablePath = await findExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const consoleErrors = [];
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Fall Development Survey" }).waitFor();
    await assertNoOverflow(page, `survey-${width}`);
    await page.screenshot({
      path: path.join(screenshotDir, `survey-${width}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByLabel("Player Name").fill(primaryPlayerName);
  await page.getByLabel("Move Get stronger down").click();
  await page.getByLabel("Move Get stronger up").click();
  await dispatchTouchDrag(
    page,
    page.getByLabel("Drag Get stronger"),
    page.getByLabel("Drag Get quicker / improve agility"),
  );
  await page
    .getByLabel("What is the #1 thing you personally want to accomplish this fall?")
    .fill("Build better strength and sprint habits.");
  await page
    .getByLabel("Anything else you'd like the coaching staff to know about your goals?")
    .fill("Morning workouts are easiest.");
  await page.getByRole("button", { name: "Submit Survey" }).click();
  await page.getByRole("heading", { name: "Survey Submitted" }).waitFor();
  await assertNoOverflow(page, "confirmation");
  await page.screenshot({
    path: path.join(screenshotDir, "confirmation.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit My Response" }).click();
  await page.getByRole("button", { name: "Update Survey" }).waitFor();

  const apiResponse = await context.request.post(`${baseUrl}/api/responses`, {
    data: responsePayload(secondPlayerName, [
      "core-strength",
      "conditioning",
      "get-stronger",
      "sprint-speed",
      "agility",
      "nutrition",
      "flexibility-mobility",
      "sleep-schedule",
      "gain-weight",
      "lose-body-fat",
    ]),
  });

  if (!apiResponse.ok()) {
    throw new Error(`Second response failed: ${apiResponse.status()} ${await apiResponse.text()}`);
  }

  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Coach Results" }).waitFor();
  await page.getByText("Team Goal Analysis").waitFor();
  await assertNoOverflow(page, "admin-overview");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-overview.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow(page, "admin-mobile-overview");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-mobile-overview.png"),
    fullPage: true,
  });

  const analytics = await page.evaluate(async () => {
    const response = await fetch("/api/admin/responses", { cache: "no-store" });
    return response.json();
  });

  if (analytics.analysis.totalResponses < 2) {
    throw new Error(`Expected at least 2 responses, got ${analytics.analysis.totalResponses}`);
  }

  const strengthSummary = analytics.analysis.summaries.find(
    (summary) => summary.goalKey === "get-stronger",
  );

  if (!strengthSummary || typeof strengthSummary.averageRank !== "number") {
    throw new Error("Strength summary missing from analysis.");
  }

  await page.getByRole("button", { name: "Players" }).click();
  await page.getByPlaceholder("Search players").fill(secondPlayerName);
  await page.getByText(secondPlayerName).first().waitFor();
  await page.getByLabel("#1 Priority").selectOption("core-strength");
  await page.getByRole("button", { name: new RegExp(secondPlayerName) }).click();
  await page.getByRole("dialog").getByText("Improve core strength").waitFor();
  await page.getByLabel("Close player response").click();

  await page.getByRole("button", { name: "Share" }).click();
  await page.locator(".qr-frame img").waitFor();
  await assertNoOverflow(page, "admin-share");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-share.png"),
    fullPage: true,
  });
  const qrSrc = await page.locator(".qr-frame img").getAttribute("src");
  if (!qrSrc?.startsWith("data:image/png")) {
    throw new Error("QR code did not render as a PNG data URL.");
  }

  const csvResponse = await page.context().request.get(`${baseUrl}/api/admin/export`);
  const csv = await csvResponse.text();
  if (!csvResponse.ok() || !csv.includes("Player name") || !csv.includes(secondPlayerName)) {
    throw new Error("CSV export did not include expected headers/player data.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected:\n${consoleErrors.join("\n")}`);
  }

  await browser.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        screenshots: screenshotDir,
        totalResponses: analytics.analysis.totalResponses,
        topTeamPriority: analytics.analysis.topTeamPriority?.goalLabel ?? null,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
