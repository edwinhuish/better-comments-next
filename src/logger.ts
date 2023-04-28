
import * as vscode from 'vscode';

export class Logger {
  private readonly output: vscode.OutputChannel;

  /**
   * Creates a new instance of the Parser class
   */
  public constructor() {

    this.output = vscode.window.createOutputChannel('Better Comments');
  }

  public log(...args: any[]) {

    const line = args.map(obj => typeof obj === 'object' ? JSON.stringify(obj) : obj).join(' ');

    this.output.appendLine(`Better Comments: ${line}`);
  }
}

let logger: Logger;


export const log = (...args: any[]) => {
  if (!logger) {
    logger = new Logger();
  }

  logger.log(...args);
}
