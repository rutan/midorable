import { describe, expect, it, vi } from 'vitest';
import { DisplayObject } from '../../../src/core/displays/DisplayObject';
import { createTestContext } from '../../helpers/createTestContext';

describe('DisplayObject#addChild', () => {
  it('throws when adding self as child', () => {
    const node = new DisplayObject({ context: createTestContext() });

    expect(() => node.addChild(node)).toThrow('Cannot add self as child');
  });

  it('throws when adding ancestor as child', () => {
    const context = createTestContext();
    const parent = new DisplayObject({ context });
    const child = new DisplayObject({ context });
    const grandChild = new DisplayObject({ context });
    parent.addChild(child);
    child.addChild(grandChild);

    expect(() => grandChild.addChild(parent)).toThrow('Cannot add an ancestor as child');
  });

  it('reparents child from old parent to new parent', () => {
    const context = createTestContext();
    const parentA = new DisplayObject({ context });
    const parentB = new DisplayObject({ context });
    const child = new DisplayObject({ context });
    parentA.addChild(child);

    parentB.addChild(child);

    expect(parentA.children).toHaveLength(0);
    expect(parentB.children).toHaveLength(1);
    expect(parentB.children[0]).toBe(child);
    expect(child.parent).toBe(parentB);
  });
});

describe('DisplayObject#removeChildren', () => {
  it('removeChildren clears parent references', () => {
    const context = createTestContext();
    const parent = new DisplayObject({ context });
    const a = new DisplayObject({ context });
    const b = new DisplayObject({ context });
    parent.addChild(a);
    parent.addChild(b);

    parent.removeChildren();

    expect(parent.children).toHaveLength(0);
    expect(a.parent).toBeNull();
    expect(b.parent).toBeNull();
  });
});

describe('DisplayObject#dispose', () => {
  it('disposes all children without skipping any', () => {
    const context = createTestContext();
    const parent = new DisplayObject({ context });
    const children = Array.from({ length: 3 }, () => new DisplayObject({ context }));

    for (const child of children) {
      parent.addChild(child);
    }
    const disposeSpies = children.map((child) => vi.spyOn(child, 'dispose'));

    parent.dispose();

    expect(parent.children).toHaveLength(0);
    for (const [index, child] of children.entries()) {
      expect(disposeSpies[index]).toHaveBeenCalledTimes(1);
      expect(child.parent).toBeNull();
    }
  });
});
