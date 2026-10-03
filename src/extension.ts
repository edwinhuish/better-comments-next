import type * as vscode from 'vscode';
import * as log from '@/log';
import * as configuration from './configuration';
import * as definition from './definition';
import * as panel from './panel';
import * as renderer from './renderer';

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  try {
    configuration.activate(context);
    definition.activate(context);
    renderer.activate(context);
    panel.activate(context);
    log.info('started successfully with configuration:', configuration.getConfigurationFlatten());
  }
  catch (e) {
    log.error(e);
  }
}

export function deactivate() {
  panel.deactivate();
  renderer.deactivate();
  definition.deactivate();
  configuration.deactivate();
}
