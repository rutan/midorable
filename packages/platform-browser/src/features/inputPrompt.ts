import { SystemPromptInputFeature } from '@rutan/midorable';
import { BrowserPlatformBase } from '../BrowserPlatformBase';

export function registerPromptInputFeature(platform: BrowserPlatformBase) {
  const promptInputController = new DomInputController(platform);
  platform.setFeature('system.promptInput', promptInputController.promptInput.bind(promptInputController));
  platform.addDisposeFunction(() => {
    promptInputController.dispose();
  });
}

class DomInputController {
  private readonly _platform: BrowserPlatformBase;
  private _resolver: ((value: string | null) => void) | null = null;
  private _overlayElement: HTMLElement | null = null;
  private _overlayResizeObserver: ResizeObserver | null = null;
  private _onWindowResize = () => this._updateOverlayLayout();

  constructor(platform: BrowserPlatformBase) {
    this._platform = platform;
  }

  async promptInput({
    title,
    defaultValue,
    multiline = false,
    submitLabel,
    cancelLabel,
  }: Parameters<SystemPromptInputFeature>[0]) {
    this._cleanupOverlay(null);

    return new Promise<string | null>((resolve) => {
      this._resolver = resolve;

      // まだCSSをbodyに挿入していない場合はここで挿入
      const existingStyle = document.getElementById(promptInputUiStyleId) as HTMLStyleElement | null;
      if (!existingStyle) {
        const styleElement = document.createElement('style');
        styleElement.id = promptInputUiStyleId;
        styleElement.textContent = promptInputUiStyle;
        document.head.appendChild(styleElement);
      }

      this._overlayElement = this._createPromptOverlay();

      const titleElement = this._overlayElement.querySelector('.midorable__prompt-input-title') as HTMLElement;
      const bodyElement = this._overlayElement.querySelector('.midorable__prompt-input-body') as HTMLElement;
      const cancelButton = this._overlayElement.querySelector(
        '.midorable__prompt-input-cancel-button',
      ) as HTMLButtonElement;
      const submitButton = this._overlayElement.querySelector(
        '.midorable__prompt-input-submit-button',
      ) as HTMLButtonElement;
      const formElement = this._overlayElement as HTMLFormElement;

      titleElement.textContent = title ?? '';
      titleElement.classList.toggle('midorable__prompt-input-title--hidden', !title);
      cancelButton.textContent = cancelLabel ?? defaultCancelLabel;
      submitButton.textContent = submitLabel ?? defaultSubmitLabel;

      const inputElement = multiline ? document.createElement('textarea') : document.createElement('input');
      if (inputElement instanceof HTMLInputElement) {
        inputElement.type = 'text';
      } else {
        inputElement.rows = 4;
      }
      inputElement.autocomplete = 'off';
      inputElement.name = 'promptInput';
      inputElement.value = defaultValue ?? '';
      inputElement.className = 'midorable__prompt-input-field';
      inputElement.setAttribute('data-1p-ignore', 'true');
      inputElement.setAttribute('data-lpignore', 'true');
      bodyElement.appendChild(inputElement);

      this._applyOverlayViewport(this._overlayElement);

      this._platform.element.appendChild(this._overlayElement);
      this._startOverlayLayoutTracking();
      setTimeout(() => inputElement.focus(), 0);

      cancelButton.addEventListener('click', () => this._cleanupOverlay(null), { once: true });
      formElement.addEventListener('submit', (event) => {
        event.preventDefault();
        this._cleanupOverlay(inputElement.value);
      });

      // 各種操作をゲーム側に伝播させないようにする
      const stopEvent = (event: Event) => event.stopPropagation();
      this._overlayElement.addEventListener('contextmenu', stopEvent);
      this._overlayElement.addEventListener('pointerdown', stopEvent);
      this._overlayElement.addEventListener('pointermove', stopEvent);
      this._overlayElement.addEventListener('pointerup', stopEvent);
      this._overlayElement.addEventListener('mousedown', stopEvent);
      this._overlayElement.addEventListener('mouseup', stopEvent);
      this._overlayElement.addEventListener('touchstart', stopEvent, { passive: false });
      this._overlayElement.addEventListener('touchmove', stopEvent, { passive: false });
      this._overlayElement.addEventListener('touchend', stopEvent, { passive: false });
      this._overlayElement.addEventListener('keydown', stopEvent);
      this._overlayElement.addEventListener('keyup', stopEvent);

      this._overlayElement.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this._cleanupOverlay(null);
        }
      });
    });
  }

  dispose() {
    this._cleanupOverlay(null);

    const existingStyle = document.getElementById(promptInputUiStyleId) as HTMLStyleElement | null;
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  private _createPromptOverlay() {
    const overlay = document.createElement('div');
    overlay.innerHTML = promptInputUi;
    return overlay.firstElementChild as HTMLElement;
  }

  private _cleanupOverlay(value: string | null) {
    this._stopOverlayLayoutTracking();
    const resolver = this._resolver;
    this._resolver = null;
    if (this._overlayElement) {
      this._overlayElement.remove();
      this._overlayElement = null;
    }
    resolver?.(value);
  }

  private _applyOverlayViewport(overlayElement: HTMLElement) {
    const { width, height } = this._platform.logicalSize;
    const containerWidth = this._platform.element.clientWidth || 0;
    const containerHeight = this._platform.element.clientHeight || 0;

    if (!width || !height || !containerWidth || !containerHeight) {
      overlayElement.style.left = '0';
      overlayElement.style.top = '0';
      overlayElement.style.width = `${containerWidth}px`;
      overlayElement.style.height = `${containerHeight}px`;
      return;
    }

    const scale = Math.min(containerWidth / width, containerHeight / height);
    const viewWidth = Math.round(width * scale);
    const viewHeight = Math.round(height * scale);
    const offsetX = Math.round((containerWidth - viewWidth) / 2);
    const offsetY = Math.round((containerHeight - viewHeight) / 2);

    overlayElement.style.left = `${offsetX}px`;
    overlayElement.style.top = `${offsetY}px`;
    overlayElement.style.width = `${viewWidth}px`;
    overlayElement.style.height = `${viewHeight}px`;
  }

  private _updateOverlayLayout() {
    if (!this._overlayElement) {
      return;
    }
    this._applyOverlayViewport(this._overlayElement);
  }

  private _startOverlayLayoutTracking() {
    if (this._overlayResizeObserver || !this._overlayElement) {
      return;
    }
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this._updateOverlayLayout());
      observer.observe(this._platform.element);
      this._overlayResizeObserver = observer;
    } else {
      window.addEventListener('resize', this._onWindowResize);
    }
  }

  private _stopOverlayLayoutTracking() {
    if (this._overlayResizeObserver) {
      this._overlayResizeObserver.disconnect();
      this._overlayResizeObserver = null;
    } else {
      window.removeEventListener('resize', this._onWindowResize);
    }
  }
}

const promptInputUi = `
<form class="midorable__prompt-input-overlay">
  <div class="midorable__prompt-input-panel">
    <div class="midorable__prompt-input-title"></div>
    <div class="midorable__prompt-input-body">
    </div>
    <div class="midorable__prompt-input-actions">
      <button type="button" class="midorable__prompt-input-cancel-button">
        Cancel
      </button>
      <button type="submit" class="midorable__prompt-input-submit-button">
        Submit
      </button>
    </div>
  </div>
</form>
`.trim();

const defaultCancelLabel = 'Cancel';
const defaultSubmitLabel = 'Submit';

const promptInputUiStyleId = 'midorable-prompt-input-styles';
const promptInputUiStyle = `
.midorable__prompt-input-overlay {
  cursor: default;
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.midorable__prompt-input-panel {
  width: min(560px, 100%);
  padding: 14px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #1f1f1f;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.5);
  font-family: sans-serif;
}

.midorable__prompt-input-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 700;
}

.midorable__prompt-input-title--hidden {
  display: none;
}

.midorable__prompt-input-body {
  margin-bottom: 10px;
}

.midorable__prompt-input-field {
  width: 100%;
  padding: 8px 10px;
  box-sizing: border-box;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: #ffffff;
  color: #000000;
  font-size: 16px;
  font-family: inherit;
}

textarea.midorable__prompt-input-field {
  resize: vertical;
}

.midorable__prompt-input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.midorable__prompt-input-actions button {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 30px;
  background: #304040;
  border: 0;
  border-radius: 3px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.midorable__prompt-input-actions button[type="submit"] {
  background: #6066f9;
}

.midorable__prompt-input-actions button:hover {
  opacity: 0.8;
}
`;
