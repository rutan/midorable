import { DisplayObject, type DisplayObjectProps, imageAsset, PointerButtonId } from '@rutan/midorable';
import { sceneRouter, type AssetsOf } from '../_share';
import { PointerMarkersLayer } from './PointerMarkersLayer';
import { PointerStatusPanelSprite } from './PointerStatusPanelSprite';
import { createPointerSnapshot, syncPointerButtons } from './snapshot';

const pointerSceneAssets = sceneRouter.defineAssets('pointer', () => ({
  cursorImage: imageAsset('img/cursor.png'),
}));

type PointerSceneAssets = AssetsOf<typeof pointerSceneAssets>;

export const PointerSceneDef = sceneRouter.defineScene('pointer', {
  getAssets: pointerSceneAssets,
  create({ context, assets }) {
    return new PointerSceneView({ context, assets });
  },
});

export interface PointerSceneViewProps extends DisplayObjectProps {
  assets: PointerSceneAssets;
}

export class PointerSceneView extends DisplayObject {
  private _pointerButtons = new Map<number, Set<PointerButtonId>>();
  private _statusPanel!: PointerStatusPanelSprite;
  private _markersLayer!: PointerMarkersLayer;

  constructor(props: PointerSceneViewProps) {
    super(props);

    const { cursorImage } = props.assets;

    this._markersLayer = new PointerMarkersLayer({
      context: this.context,
      cursorImage,
      cursorImageWidth: cursorImage.height,
    });
    this.addChild(this._markersLayer);

    this._statusPanel = new PointerStatusPanelSprite({
      context: this.context,
      x: 10,
    });
    this._statusPanel.y = this.context.app.height - this._statusPanel.image.height - 10;
    this.addChild(this._statusPanel);

    this.onUpdate.on(this._handleUpdate);
  }

  private _handleUpdate = () => {
    const pointers = this.context.app.input.pointers;
    syncPointerButtons({
      pointers,
      pointerButtons: this._pointerButtons,
    });

    const snapshot = createPointerSnapshot({
      pointers,
      pointerButtons: this._pointerButtons,
    });

    this._statusPanel.setSnapshot(snapshot);
    this._markersLayer.syncPointers(snapshot.pointers);
  };
}
