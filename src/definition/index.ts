import { registerEvent } from './event';
import * as definition from './definition';

export * from './definition';
export {
  onDidChange,
  unregisterEvent as deactivate,
} from './event';

export function activate() {
  registerEvent();
  definition.refresh();
}
