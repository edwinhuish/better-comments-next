import { registerEvent } from './event';
import { updateDefinitions } from './languages';

export * from './languages';
export {
  onDidChange,
  unregisterEvent as deactivate,
} from './event';

export function activate() {
  registerEvent();
  updateDefinitions();
}
