import * as configuration from './configuration';
import * as definition from './definition';
import * as handler from './handler';

import type * as vscode from 'vscode';

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  configuration.activate(context);
  definition.activate(context);
  handler.activate(context);
}

export function deactivate() {
  configuration.deactivate();
  definition.deactivate();
  handler.deactivate();
}
