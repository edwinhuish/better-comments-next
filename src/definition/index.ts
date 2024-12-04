import * as definition from './definition';
import { registerEvent } from './event';

export * from './definition';
export { onDidChange, unregisterEvent as deactivate } from './event';

export function activate() {
  registerEvent();
  definition.refresh();
}
