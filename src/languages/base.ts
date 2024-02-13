import * as vscode from 'vscode';
import { parse as json5Parse } from 'json5';
import * as console from '../console';

export async function loadCommentRuleFromFile(fileUri?: vscode.Uri): Promise<vscode.CommentRule | undefined> {
  if (!fileUri) {
    return undefined;
  }
  try {
    // Read file
    const raw = await vscode.workspace.fs.readFile(fileUri);

    const content = raw.toString();

    // use json5, because the config can contains comments
    const config = json5Parse(content) as vscode.LanguageConfiguration;

    return config.comments;
  }
  catch (error: any) {
    console.error(`Parse configuration file ${fileUri.toString()} failed: ${error.message}`);
    return undefined;
  }
}

export function getBaseCommentRule(languageCode: string): vscode.CommentRule | undefined {
  switch (languageCode) {
    case 'asciidoc':
      return ({ lineComment: '//', blockComment: ['////', '////'] });
    case 'apex':
    case 'javascript':
    case 'javascriptreact':
    case 'typescript':
    case 'typescriptreact':
    case 'al':
    case 'c':
    case 'cpp':
    case 'csharp':
    case 'dart':
    case 'flax':
    case 'fsharp':
    case 'go':
    case 'groovy':
    case 'haxe':
    case 'java':
    case 'jsonc':
    case 'kotlin':
    case 'less':
    case 'pascal':
    case 'objectpascal':
    case 'php':
    case 'rust':
    case 'scala':
    case 'sass':
    case 'scss':
    case 'stylus':
    case 'swift':
    case 'verilog':
      return ({ lineComment: '//', blockComment: ['/*', '*/'] });
    case 'css':
      return ({ blockComment: ['/*', '*/'] });
    case 'coffeescript':
    case 'dockerfile':
    case 'gdscript':
    case 'graphql':
    case 'julia':
    case 'makefile':
    case 'perl':
    case 'perl6':
    case 'puppet':
    case 'r':
    case 'ruby':
    case 'shellscript':
    case 'tcl':
    case 'yaml':
      return ({ lineComment: '#' });
    case 'elixir':
    case 'python':
      return ({ lineComment: '#', blockComment: ['"""', '"""'] });
    case 'nim':
      return ({ lineComment: '#', blockComment: ['#[', ']#'] });
    case 'powershell':
      return ({ lineComment: '#', blockComment: ['<#', '#>'] });
    case 'ada':
    case 'hive-sql':
    case 'pig':
    case 'plsql':
    case 'sql':
      return ({ lineComment: '--' });
    case 'lua':
      return ({ lineComment: '--', blockComment: ['--[[', ']]'] });
    case 'elm':
    case 'haskell':
      return ({ lineComment: '--', blockComment: ['{-', '-}'] });
    case 'vb':
    case 'asp':
    case 'diagram': // ? PlantUML is recognized as Diagram (diagram)
      return ({ lineComment: '\'' });
    case 'bibtex':
    case 'erlang':
    case 'latex':
    case 'matlab':
      return ({ lineComment: '%' });
    case 'clojure':
    case 'elps':
    case 'racket':
    case 'lisp':
      return ({ lineComment: ';' });
    case 'terraform':
      return ({ lineComment: '#', blockComment: ['/*', '*/'] });
    case 'COBOL':
      return ({ lineComment: '*>' });
    case 'fortran-modern':
      return ({ lineComment: 'c' });
    case 'SAS':
    case 'stata':
      return ({ lineComment: '*', blockComment: ['/*', '*/'] });
    case 'html':
    case 'xml':
    case 'markdown':
    case 'vue':
      return ({ blockComment: ['<!--', '-->'] });
    case 'twig':
      return ({ blockComment: ['{#', '#}'] });
    case 'genstat':
      return ({ lineComment: '\\', blockComment: ['"', '"'] });
    case 'cfml':
      return ({ blockComment: ['<!---', '--->'] });
    case 'shaderlab':
      return ({ lineComment: '//' });
    case 'razor':
      return ({ blockComment: ['@*', '*@'] });
    default:
      return undefined;
  }
}
