import { App, Color, Sprite, SpriteProps } from '@rutan/midorable';

export interface GridSpriteProps extends Omit<SpriteProps, 'image'> {
  width: number;
  height: number;
  gridSize?: number;
  gridColor?: Color;
}

const DEFAULT_GRID_SIZE = 50;
const DEFAULT_GRID_COLOR = { r: 255, g: 255, b: 255, a: 0.08 };

export class GridSprite extends Sprite {
  constructor(props: GridSpriteProps) {
    super({
      ...props,
      image: createTexture({
        app: props.context.app,
        gridSize: props.gridSize ?? DEFAULT_GRID_SIZE,
        gridColor: props.gridColor ?? DEFAULT_GRID_COLOR,
      }),
    });
  }
}

function createTexture({ app, gridSize, gridColor }: { app: App; gridSize: number; gridColor: Color }) {
  const texture = app.createTexture(app.width, app.height);

  for (let x = 0; x <= app.width; x += gridSize) {
    texture.drawLine({ sx: x, sy: 0, ex: x, ey: app.height, color: gridColor });
  }

  for (let y = 0; y <= app.height; y += gridSize) {
    texture.drawLine({ sx: 0, sy: y, ex: app.width, ey: y, color: gridColor });
  }

  return texture;
}
