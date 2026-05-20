import { Transform2D } from '../renderer';

export function multiplyTransform(parent: Transform2D, local: Transform2D): Transform2D {
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    tx: parent.a * local.tx + parent.c * local.ty + parent.tx,
    ty: parent.b * local.tx + parent.d * local.ty + parent.ty,
  };
}

export function invertTransform(transform: Transform2D): Transform2D | null {
  const det = transform.a * transform.d - transform.b * transform.c;
  if (det === 0) {
    return null;
  }
  const invDet = 1 / det;
  const a = transform.d * invDet;
  const b = -transform.b * invDet;
  const c = -transform.c * invDet;
  const d = transform.a * invDet;
  const tx = -(a * transform.tx + c * transform.ty);
  const ty = -(b * transform.tx + d * transform.ty);
  return { a, b, c, d, tx, ty };
}

export function applyTransform(transform: Transform2D, x: number, y: number) {
  return {
    x: transform.a * x + transform.c * y + transform.tx,
    y: transform.b * x + transform.d * y + transform.ty,
  };
}
