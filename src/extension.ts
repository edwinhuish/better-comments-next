import type * as vscode from 'vscode';
import * as log from '@/log';
import * as configuration from './configuration';
import * as definition from './definition';
import * as handler from './handler';

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  try {
    configuration.activate(context);
    definition.activate(context);
    handler.activate(context);
    log.info('started successfully.');
  }
  catch (e) {
    log.error(e);
  }
}

export function deactivate() {
  configuration.deactivate();
  definition.deactivate();
  handler.deactivate();
}
