import { ImageAsset, InputPointerState, PointerKind, DisplayObject, DisplayObjectProps } from '@rutan/midorable';
import { PointerMarkerSprite } from './PointerMarkerSprite';

export interface PointerMarkersLayerProps extends DisplayObjectProps {
  cursorImage: ImageAsset;
  cursorImageWidth: number;
}

export class PointerMarkersLayer extends DisplayObject {
  private _cursorImage: ImageAsset;
  private _cursorImageWidth: number;
  private _pointerSprites = new Map<number, PointerMarkerSprite>();

  constructor(params: PointerMarkersLayerProps) {
    super(params);
    this._cursorImage = params.cursorImage;
    this._cursorImageWidth = params.cursorImageWidth;
  }

  dispose() {
    this._pointerSprites.forEach((marker) => marker.dispose());
    this._pointerSprites.clear();
    super.dispose();
  }

  syncPointers(pointers: InputPointerState[]) {
    const activePointerIds = new Set<number>();

    for (const pointer of pointers) {
      activePointerIds.add(pointer.id);

      const marker = this._getOrCreateMarker(pointer.id, pointer.pointerType);
      marker.syncPointer(pointer);
    }

    for (const [pointerId, marker] of this._pointerSprites.entries()) {
      if (activePointerIds.has(pointerId)) {
        continue;
      }

      this.removeChild(marker);
      marker.dispose();
      this._pointerSprites.delete(pointerId);
    }
  }

  private _getOrCreateMarker(pointerId: number, pointerType: PointerKind) {
    const existing = this._pointerSprites.get(pointerId);
    if (existing) {
      return existing;
    }

    const marker = new PointerMarkerSprite({
      context: this.context,
      type: pointerType,
      cursorImage: this._cursorImage,
      cursorImageWidth: this._cursorImageWidth,
    });
    this._pointerSprites.set(pointerId, marker);
    this.addChild(marker);
    return marker;
  }
}
