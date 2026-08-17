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

const compactGoalLabels = {
  "get-stronger": "Get stronger",
  "sprint-speed": "Improve sprint speed",
  agility: "Improve agility",
  "lose-body-fat": "Lose body fat",
  "gain-weight": "Gain weight",
  nutrition: "Improve nutrition",
  "flexibility-mobility": "Improve flexibility & mobility",
  conditioning: "Improve stamina & conditioning",
  "core-strength": "Improve core strength",
  "sleep-schedule": "Improve sleep schedule",
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

async function assertCompactRankingLayout(page, width) {
  const result = await page.evaluate((viewportWidth) => {
    function rectFor(selector, root = document) {
      const element = root.querySelector(selector);

      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();

      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        width: rect.width,
      };
    }

    function lineCheck(selector) {
      const element = document.querySelector(selector);

      if (!element) {
        return { wraps: true, missing: true, text: selector };
      }

      const styles = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(styles.fontSize);
      const lineHeight = Number.parseFloat(styles.lineHeight) || fontSize * 1.2;
      const rect = element.getBoundingClientRect();

      return {
        wraps: rect.height > lineHeight * 1.35,
        missing: false,
        text: element.textContent?.trim() ?? selector,
        height: rect.height,
        lineHeight,
      };
    }

    const cards = Array.from(document.querySelectorAll(".ranking-card"));
    const cardIssues = cards.flatMap((card, index) => {
      const cardRect = card.getBoundingClientRect();
      const label = card.querySelector(".ranking-label");
      const labelRect = label?.getBoundingClientRect();
      const actionsRect = rectFor(".ranking-actions", card);
      const handleRect = rectFor(".drag-handle", card);
      const cardCenter = cardRect.top + cardRect.height / 2;
      const actionCenter = actionsRect ? actionsRect.top + actionsRect.height / 2 : 0;
      const handleCenter = handleRect ? handleRect.top + handleRect.height / 2 : 0;
      const maxHeight = viewportWidth === 320 ? 66 : 64;
      const issues = [];

      if (cardRect.height < 56 || cardRect.height > maxHeight) {
        issues.push(`card ${index + 1} height ${cardRect.height.toFixed(1)}px`);
      }

      if (!actionsRect || Math.abs(actionCenter - cardCenter) > 5) {
        issues.push(`card ${index + 1} actions not vertically centered`);
      }

      if (!handleRect || Math.abs(handleCenter - cardCenter) > 5) {
        issues.push(`card ${index + 1} handle not vertically centered`);
      }

      if (label && labelRect) {
        const styles = window.getComputedStyle(label);
        const fontSize = Number.parseFloat(styles.fontSize);
        const lineHeight = Number.parseFloat(styles.lineHeight) || fontSize * 1.2;

        if (labelRect.height > lineHeight * 1.35) {
          issues.push(`card ${index + 1} label wraps`);
        }

        if (viewportWidth >= 375 && label.scrollWidth > label.clientWidth) {
          issues.push(`card ${index + 1} label clips: ${label.textContent?.trim()}`);
        }
      }

      return issues;
    });

    return {
      cardIssues,
      heading: lineCheck(".survey-header h1"),
      intro: lineCheck(".intro"),
      cardCount: cards.length,
    };
  }, width);

  if (result.cardCount !== goals.length) {
    throw new Error(`survey-${width}: expected ${goals.length} ranking cards, got ${result.cardCount}`);
  }

  if (result.heading.wraps) {
    throw new Error(`survey-${width}: heading wraps (${result.heading.text})`);
  }

  if (result.intro.wraps) {
    throw new Error(`survey-${width}: intro wraps (${result.intro.text})`);
  }

  if (result.cardIssues.length > 0) {
    throw new Error(`survey-${width}: ${result.cardIssues.join("; ")}`);
  }
}

async function assertAdminMobileLayout(page, width) {
  const result = await page.evaluate(() => {
    function visible(element) {
      if (!element) {
        return false;
      }

      const styles = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }

    function rectFor(selector) {
      const element = document.querySelector(selector);

      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();

      return {
        height: rect.height,
        width: rect.width,
      };
    }

    const clientWidth = document.documentElement.clientWidth;
    const clippedText = Array.from(
      document.querySelectorAll(".priority-main strong, .mini-bar-row span, .player-card strong"),
    ).flatMap((element) => {
      const rect = element.getBoundingClientRect();

      if (rect.left < -1 || rect.right > clientWidth + 1) {
        return [element.textContent?.trim() || "unknown"];
      }

      return [];
    });
    const exportVisible = Array.from(document.querySelectorAll("button")).some((button) => {
      return (button.textContent || "").includes("Export CSV") && visible(button);
    });

    return {
      header: rectFor(".admin-header"),
      tabs: rectFor(".tabs"),
      deleteButton: rectFor(".delete-icon-button"),
      refreshButton: rectFor(".refresh-button"),
      metricCount: document.querySelectorAll(".metric-card").length,
      priorityRows: document.querySelectorAll(".priority-row").length,
      priorityTitle: document.body.innerText.includes("Team Priorities"),
      exportVisible,
      clippedText,
      bodyText: document.body.innerText,
    };
  });

  if (!result.header || result.header.height > 76) {
    throw new Error(`admin-${width}: compact header height is off (${result.header?.height})`);
  }

  if (!result.tabs || result.tabs.height > 54) {
    throw new Error(`admin-${width}: tabs are too tall (${result.tabs?.height})`);
  }

  if (!result.refreshButton || result.refreshButton.width > 45 || result.refreshButton.height > 45) {
    throw new Error(`admin-${width}: refresh control is not compact`);
  }

  if (!result.deleteButton || result.deleteButton.width > 45 || result.deleteButton.height > 45) {
    throw new Error(`admin-${width}: delete control is not compact`);
  }

  if (result.metricCount !== 4) {
    throw new Error(`admin-${width}: expected 4 summary cards, got ${result.metricCount}`);
  }

  if (!result.priorityTitle || result.priorityRows !== goals.length) {
    throw new Error(`admin-${width}: team priorities are missing or incomplete`);
  }

  if (result.exportVisible) {
    throw new Error(`admin-${width}: Export CSV is visible in the mobile overview header`);
  }

  if (result.clippedText.length > 0) {
    throw new Error(`admin-${width}: clipped goal text: ${result.clippedText.join(", ")}`);
  }

  if (result.bodyText.includes("NaN")) {
    throw new Error(`admin-${width}: dashboard rendered NaN`);
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
    acceptDownloads: true,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(baseUrl).origin,
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
    await page.getByRole("heading", { name: "Fall 2026 Development Survey" }).waitFor();
    await assertNoOverflow(page, `survey-${width}`);
    await assertCompactRankingLayout(page, width);
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
    page.getByLabel("Drag Improve agility"),
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
  await page.getByText("Team Priorities").waitFor();
  await assertNoOverflow(page, "admin-overview");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-overview.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 768, height: 1024 });
  await assertNoOverflow(page, "admin-ipad");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-ipad.png"),
    fullPage: true,
  });

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
    await page.getByText("Team Priorities").waitFor();
    await assertNoOverflow(page, `admin-mobile-${width}`);
    await assertAdminMobileLayout(page, width);
    await page.screenshot({
      path: path.join(screenshotDir, `admin-mobile-${width}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
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

  await page.getByLabel("Refresh results").click();
  await page.waitForTimeout(250);
  await assertNoOverflow(page, "admin-refresh");

  await page.getByRole("button", { name: /^Players$/ }).click();
  await page.getByRole("heading", { name: "Player Responses" }).waitFor();
  await assertNoOverflow(page, "admin-players");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-players-390.png"),
    fullPage: true,
  });
  await page.getByPlaceholder("Search players").fill(secondPlayerName);
  await page.getByText(secondPlayerName).first().waitFor();
  await page.getByLabel("Filter player responses").click();
  await page.locator("#player-filter-panel select").nth(1).selectOption("core-strength");
  await page.getByRole("button", { name: new RegExp(secondPlayerName) }).click();
  await page
    .getByRole("dialog")
    .locator(".top-priority-callout strong")
    .filter({ hasText: "Improve core strength" })
    .waitFor();
  await assertNoOverflow(page, "admin-player-detail");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-player-detail-390.png"),
    fullPage: true,
  });
  await page.getByLabel("Close player response").click();

  await page.getByPlaceholder("Search players").fill("");
  await page.locator("#player-filter-panel select").nth(1).selectOption("all");
  const playerCards = page.locator(".player-card");
  const playerCount = await playerCards.count();

  if (playerCount < 2) {
    throw new Error(`Expected at least 2 player cards, found ${playerCount}`);
  }

  for (let index = 0; index < playerCount; index += 1) {
    const card = playerCards.nth(index);
    const playerName = (await card.locator("span").first().textContent())?.trim();

    if (!playerName) {
      throw new Error(`Player card ${index + 1} is missing a name.`);
    }

    await card.click();
    await page.getByRole("dialog").getByRole("heading", { name: playerName, exact: true }).waitFor();
    await page.getByRole("dialog").getByText("#1 Priority").waitFor();
    await page.getByLabel("Close player response").click();
  }

  await page.getByRole("button", { name: /^Share$/ }).click();
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

  const qrDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download QR Code" }).click();
  const qrDownload = await qrDownloadPromise;
  if (!qrDownload.suggestedFilename().endsWith(".png")) {
    throw new Error(`Unexpected QR filename: ${qrDownload.suggestedFilename()}`);
  }

  await page.getByRole("button", { name: "Copy Link" }).click();
  const copiedLink = await page.evaluate(() => navigator.clipboard.readText());
  const expectedSurveyLink = new URL("/", baseUrl).href;
  if (copiedLink !== expectedSurveyLink) {
    throw new Error(`Copy link copied ${copiedLink}, expected ${expectedSurveyLink}`);
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().endsWith(".csv")) {
    throw new Error(`Unexpected CSV filename: ${download.suggestedFilename()}`);
  }

  const csvResponse = await page.context().request.get(`${baseUrl}/api/admin/export`);
  const csv = await csvResponse.text();
  if (!csvResponse.ok() || !csv.includes("Player name") || !csv.includes(secondPlayerName)) {
    throw new Error("CSV export did not include expected headers/player data.");
  }

  const totalBeforeDelete = analytics.analysis.totalResponses;
  await page.getByLabel("Delete all submissions").click();
  let deleteDialog = page.getByRole("dialog", { name: "Delete all submissions?" });
  await deleteDialog.waitFor();
  const destructiveButton = deleteDialog.getByRole("button", { name: "Delete All Submissions" });

  if (!(await destructiveButton.isDisabled())) {
    throw new Error("Delete button should be disabled before confirmation text.");
  }

  await deleteDialog.getByLabel("Type DELETE to confirm deletion").fill("delete");
  if (!(await destructiveButton.isDisabled())) {
    throw new Error("Delete button should stay disabled for lowercase confirmation.");
  }
  await assertNoOverflow(page, "admin-delete-dialog");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-delete-dialog-390.png"),
    fullPage: true,
  });

  await deleteDialog.getByRole("button", { name: "Cancel" }).click();
  await deleteDialog.waitFor({ state: "hidden" });

  const preservedAnalytics = await page.evaluate(async () => {
    const response = await fetch("/api/admin/responses", { cache: "no-store" });
    return response.json();
  });

  if (preservedAnalytics.analysis.totalResponses !== totalBeforeDelete) {
    throw new Error("Canceling delete changed the response data.");
  }

  await page.getByLabel("Delete all submissions").click();
  deleteDialog = page.getByRole("dialog", { name: "Delete all submissions?" });
  await deleteDialog.waitFor();
  await deleteDialog.getByLabel("Type DELETE to confirm deletion").fill("DELETE");
  if (await deleteDialog.getByRole("button", { name: "Delete All Submissions" }).isDisabled()) {
    throw new Error("DELETE confirmation did not enable the destructive action.");
  }

  await deleteDialog.getByRole("button", { name: "Delete All Submissions" }).click();
  await page.getByText("All submissions deleted").waitFor();

  const zeroAnalytics = await page.evaluate(async () => {
    const response = await fetch("/api/admin/responses", { cache: "no-store" });
    return response.json();
  });

  if (zeroAnalytics.responses.length !== 0 || zeroAnalytics.analysis.totalResponses !== 0) {
    throw new Error("Delete all did not clear response data.");
  }

  const brokenZeroSummary = zeroAnalytics.analysis.summaries.some((summary) => {
    return !Number.isFinite(summary.averageRank) || !Number.isFinite(summary.top3Percent);
  });

  if (brokenZeroSummary) {
    throw new Error("Zero-response analysis contains non-finite values.");
  }

  await page.getByRole("button", { name: /^Overview$/ }).click();
  await page.getByText("No responses yet").waitFor();
  await assertNoOverflow(page, "admin-empty-overview");

  await page.getByRole("button", { name: /^Players$/ }).click();
  await page.getByText("No responses yet").waitFor();
  await assertNoOverflow(page, "admin-empty-players");

  await page.getByRole("button", { name: /^Share$/ }).click();
  await page.locator(".qr-frame img").waitFor();
  await page.getByLabel("Refresh results").click();
  await page.waitForTimeout(250);
  await assertNoOverflow(page, "admin-empty-share");

  const emptyCsvResponse = await page.context().request.get(`${baseUrl}/api/admin/export`);
  const emptyCsv = await emptyCsvResponse.text();
  if (!emptyCsvResponse.ok() || !emptyCsv.includes("Player name") || emptyCsv.includes(primaryPlayerName)) {
    throw new Error("CSV export did not handle the empty response set.");
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
        totalResponsesBeforeDelete: totalBeforeDelete,
        totalResponsesAfterDelete: zeroAnalytics.analysis.totalResponses,
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
