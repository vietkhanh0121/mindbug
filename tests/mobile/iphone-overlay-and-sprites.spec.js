import { expect, test } from "@playwright/test";

async function enterSoloGame(page) {
  await page.goto("/");
  await expect(page.locator("#lobbyPreloadOverlay")).toBeHidden({ timeout: 20_000 });

  const profile = page.locator("#lobbyProfileView");
  if (await profile.isVisible()) {
    await page.locator("#lobbyPlayerName").fill("Test");
    await page.locator("#lobbyProfileContinueButton").click();
  }

  await page.locator("#lobbyModeSolo").click();
  await page.locator("#lobbyStartButton").click();
  await expect(page.locator("#lobbyView")).toBeHidden({ timeout: 20_000 });
  await expect(page.locator("#hand .card")).toHaveCount(5);
}

test("iPhone overlay stays aligned and card sprites survive a render", async ({ page }) => {
  await enterSoloGame(page);

  const handCards = page.locator("#hand .card");
  const firstCard = handCards.nth(0);
  const preservedCard = handCards.nth(1);
  const preservedId = await preservedCard.getAttribute("data-card-id");
  expect(preservedId).toBeTruthy();

  await page.evaluate(cardId => {
    window.__mindbugPreservedCardNode = document.querySelector(`#hand .card[data-card-id="${cardId}"]`);
  }, preservedId);

  await firstCard.click();
  const overlay = page.locator("#cardInspectDialog");
  await expect(overlay).toBeVisible();
  await expect(page.locator("#cardInspectContent .inspectCard")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector("#cardInspectDialog").getBoundingClientRect();
    const arena = document.querySelector("#arena").getBoundingClientRect();
    const viewport = window.visualViewport;
    return {
      dialog: { left: dialog.left, right: dialog.right, top: dialog.top, bottom: dialog.bottom },
      dialogCenter: { x: dialog.left + dialog.width / 2, y: dialog.top + dialog.height / 2 },
      arenaCenter: { x: arena.left + arena.width / 2, y: arena.top + arena.height / 2 },
      viewport: {
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth),
        bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)
      }
    };
  });

  expect(geometry.dialog.left).toBeGreaterThanOrEqual(geometry.viewport.left - 1);
  expect(geometry.dialog.right).toBeLessThanOrEqual(geometry.viewport.right + 1);
  expect(geometry.dialog.top).toBeGreaterThanOrEqual(geometry.viewport.top - 1);
  expect(geometry.dialog.bottom).toBeLessThanOrEqual(geometry.viewport.bottom + 1);
  expect(Math.abs(geometry.dialogCenter.x - geometry.arenaCenter.x)).toBeLessThanOrEqual(12);
  expect(Math.abs(geometry.dialogCenter.y - geometry.arenaCenter.y)).toBeLessThanOrEqual(12);

  const playButton = page.locator("#localHandActions .handActionButton", { hasText: "Chơi" });
  await expect(playButton).toBeEnabled();
  await playButton.click();

  const preservedAfter = page.locator(`#hand .card[data-card-id="${preservedId}"]`);
  await expect(preservedAfter).toBeVisible({ timeout: 20_000 });
  const spriteResult = await page.evaluate(async cardId => {
    const card = document.querySelector(`#hand .card[data-card-id="${cardId}"]`);
    const sameNode = card === window.__mindbugPreservedCardNode;
    const samples = [];
    for (let frame = 0; frame < 24; frame += 1) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const style = getComputedStyle(card);
      samples.push({
        backgroundImage: style.backgroundImage,
        width: card.getBoundingClientRect().width,
        height: card.getBoundingClientRect().height
      });
    }
    return {
      sameNode,
      blankFrames: samples.filter(sample => !sample.backgroundImage || sample.backgroundImage === "none").length,
      invalidSizeFrames: samples.filter(sample => sample.width <= 0 || sample.height <= 0).length
    };
  }, preservedId);

  expect(spriteResult.sameNode).toBe(true);
  expect(spriteResult.blankFrames).toBe(0);
  expect(spriteResult.invalidSizeFrames).toBe(0);
});
