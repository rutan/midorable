import { BrowserPlatformBase } from '../BrowserPlatformBase';

export function registerDefaultPlatformFeatures(platform: BrowserPlatformBase) {
  const fontLoadTasks = new Map<string, Promise<void>>();

  platform.setFeature('system.font', {
    async loadFont(fontName: string, url: string) {
      const key = `${fontName}\u0000${url}`;
      const cachedTask = fontLoadTasks.get(key);
      if (cachedTask) {
        await cachedTask;
        return true;
      }

      const task = loadBrowserFont(fontName, url);
      fontLoadTasks.set(key, task);
      try {
        await task;
        return true;
      } catch (error) {
        fontLoadTasks.delete(key);
        console.error(`Failed to load font "${fontName}" from URL: ${url}`, error);
        return false;
      }
    },
  });

  platform.setFeature('system.openUrl', async (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  });

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    platform.setFeature('system.clipboard', {
      async readText() {
        return navigator.clipboard.readText();
      },
      async writeText(text: string) {
        await navigator.clipboard.writeText(text);
      },
    });
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    platform.setFeature('system.share', {
      async share(data) {
        await navigator.share(data);
      },
    });
  }

  platform.setFeature('system.locale', {
    getLocale() {
      if (typeof navigator === 'undefined') {
        return 'en-US';
      }
      return navigator.language || 'en-US';
    },
    getTimeZone() {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return timeZone || 'UTC';
    },
  });
}

async function loadBrowserFont(fontName: string, url: string) {
  if (typeof document === 'undefined') {
    throw new Error('Document is not available for system.font');
  }

  if (typeof FontFace === 'function' && document.fonts) {
    const fontFace = new FontFace(fontName, `url(${JSON.stringify(url)})`);
    const loadedFace = await fontFace.load();
    document.fonts.add(loadedFace);
    await document.fonts.load(`1em ${JSON.stringify(fontName)}`);
    return;
  }

  const style = document.createElement('style');
  style.textContent = `@font-face { font-family: ${JSON.stringify(fontName)}; src: url(${JSON.stringify(url)}); }`;
  document.head.append(style);

  if (document.fonts) {
    await document.fonts.load(`1em ${JSON.stringify(fontName)}`);
  }
}
