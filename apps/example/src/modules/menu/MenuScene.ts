import { DisplayObject, type DisplayObjectProps } from '@rutan/midorable';
import { ADVANCED_DEMO_SCENES, NORMAL_DEMO_SCENES, SceneName, sceneRouter, TextButtonSprite } from '../_share';

const COLUMN_COUNT = 5;
const BUTTON_WIDTH = 200;
const BUTTON_HEIGHT = 72;
const BUTTON_GAP = 20;

export const MenuSceneDef = sceneRouter.defineScene('menu', {
  meta: {
    showBackButton: false,
  },
  create({ context, params, navigator }) {
    return new MenuSceneView({
      context,
      startTime: params.startTime,
      onSceneSelect: (sceneName) => {
        void navigator.goTo(sceneName);
      },
    });
  },
});

export interface MenuSceneViewProps extends DisplayObjectProps {
  startTime: number;
  onSceneSelect: (sceneName: SceneName) => void;
}

export class MenuSceneView extends DisplayObject {
  private _onSceneSelect: (sceneName: SceneName) => void;

  constructor(props: MenuSceneViewProps) {
    super(props);
    this._onSceneSelect = props.onSceneSelect;

    console.log('MenuScene startTime', props.startTime);

    this._createButtons(NORMAL_DEMO_SCENES, 70);
    this._createButtons(ADVANCED_DEMO_SCENES, 300);
  }

  private _createButtons(sceneNames: readonly SceneName[], baseY: number) {
    const baseX = (this._context.app.width - COLUMN_COUNT * (BUTTON_WIDTH + BUTTON_GAP) + BUTTON_GAP) / 2;
    sceneNames.forEach((sceneName, index) => {
      const button = new TextButtonSprite({
        context: this._context,
        label: sceneName,
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        x: baseX + (index % COLUMN_COUNT) * (BUTTON_WIDTH + BUTTON_GAP),
        y: baseY + Math.floor(index / COLUMN_COUNT) * (BUTTON_HEIGHT + BUTTON_GAP),
      });
      button.onClick.on(() => {
        this._onSceneSelect(sceneName);
      });
      this.addChild(button);
    });
  }
}
