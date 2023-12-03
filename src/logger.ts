import * as vscode from 'vscode';

const _channel = vscode.window.createOutputChannel('Better Comments');

export function log(...args: any[]) {
  const line = args.map(obj => typeof obj === 'object' ? JSON.stringify(obj) : obj).join(' ');
  _channel.appendLine(line);
}
