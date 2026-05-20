import { AppContext } from '../../src/core/App';

export function createTestContext(): AppContext {
  return {
    app: {} as AppContext['app'],
    loader: {} as AppContext['loader'],
  };
}
