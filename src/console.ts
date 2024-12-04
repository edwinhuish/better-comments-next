import * as vscode from 'vscode';

const channel = vscode.window.createOutputChannel('Better Comments');

function log(...args: any[]) {
  const line = args.map((obj) => (typeof obj === 'object' ? JSON.stringify(obj) : obj)).join(' ');
  channel.appendLine(line);
}

export function info(...args: any[]) {
  log('[INFO] ', ...args);
}

export function error(...args: any[]) {
  log('[ERROR] ', ...args);
}
