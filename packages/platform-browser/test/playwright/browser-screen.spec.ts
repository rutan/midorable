import { expect, test } from '@playwright/test';
import type { Size } from '@rutan/midorable/platform';

test('reports client size changes from padding and borders', async ({ page }) => {
  await page.goto('/');
  const sizes = await page.evaluate(async () => {
    const element = document.createElement('div');
    element.style.cssText = 'width: 100px; height: 80px; box-sizing: content-box';
    document.body.append(element);
    const screen = new window.__midorableScreenFeature(element);
    const changes: Size[] = [];
    screen.onChange.on(({ viewSize }) => changes.push(viewSize));

    // Allow ResizeObserver to deliver before making the next layout change.
    const afterLayout = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await afterLayout();
    element.style.padding = '5px 10px';
    await afterLayout();

    // Keep the border box at 120 x 90 while the border reduces the client size.
    element.style.boxSizing = 'border-box';
    element.style.width = '120px';
    element.style.height = '90px';
    element.style.border = '2px solid';
    await afterLayout();
    screen.dispose();
    return changes;
  });
  expect(sizes).toEqual([
    { width: 120, height: 90 },
    { width: 116, height: 86 },
  ]);
});
