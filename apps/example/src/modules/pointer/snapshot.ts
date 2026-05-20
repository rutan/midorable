import { InputPointerState, PointerButtonId, PointerKind } from '@rutan/midorable';

export type PointerSnapshot = {
  pointers: InputPointerState[];
  counts: {
    touch: number;
    pen: number;
    total: number;
  };
  mouseButtons: Set<PointerButtonId>;
};

export function createPointerSnapshot(params: {
  pointers: InputPointerState[];
  pointerButtons: Map<number, Set<PointerButtonId>>;
}) {
  const { pointers, pointerButtons } = params;
  const mousePointerId = findPointerIdByType(pointers, 'mouse');
  const counts = countPointersByType(pointers);

  return {
    pointers,
    counts,
    mouseButtons:
      mousePointerId === null ? new Set<PointerButtonId>() : (pointerButtons.get(mousePointerId) ?? new Set()),
  } satisfies PointerSnapshot;
}

export function syncPointerButtons(params: {
  pointers: InputPointerState[];
  pointerButtons: Map<number, Set<PointerButtonId>>;
}) {
  const { pointers, pointerButtons } = params;
  const activePointerIds = new Set<number>();

  for (const pointer of pointers) {
    activePointerIds.add(pointer.id);

    if (pointer.pointerType !== 'mouse') {
      continue;
    }

    const buttons = getOrCreateButtonSet(pointerButtons, pointer.id);

    for (const button of pointer.pressedButtons) {
      buttons.add(button);
    }

    for (const button of pointer.releasedButtons) {
      buttons.delete(button);
    }

    if (pointer.down) {
      buttons.add('left');
    } else {
      buttons.delete('left');
    }
  }

  for (const pointerId of pointerButtons.keys()) {
    if (!activePointerIds.has(pointerId)) {
      pointerButtons.delete(pointerId);
    }
  }
}

function getOrCreateButtonSet(pointerButtons: Map<number, Set<PointerButtonId>>, pointerId: number) {
  const existing = pointerButtons.get(pointerId);
  if (existing) {
    return existing;
  }

  const created = new Set<PointerButtonId>();
  pointerButtons.set(pointerId, created);
  return created;
}

function findPointerIdByType(pointers: InputPointerState[], pointerType: PointerKind) {
  for (const pointer of pointers) {
    if (pointer.pointerType === pointerType) {
      return pointer.id;
    }
  }
  return null;
}

function countPointersByType(pointers: InputPointerState[]) {
  const counts = {
    touch: 0,
    pen: 0,
    total: pointers.length,
  };

  for (const pointer of pointers) {
    if (pointer.pointerType === 'touch') {
      counts.touch += 1;
      continue;
    }

    if (pointer.pointerType === 'pen') {
      counts.pen += 1;
    }
  }

  return counts;
}
