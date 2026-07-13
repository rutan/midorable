import { AppContext } from '../../src/engine/AppContext';

export function createTestContext(): AppContext {
  return {
    app: {} as AppContext['app'],
    loader: {} as AppContext['loader'],
  };
}
