import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as definition from '../../src/definition';
import { triggerUpdateDecorations } from '../../src/handler/handler';
import { CommonHandler } from '../../src/handler/modules/common';

const EXTENSION_ID = 'edwinhuish.better-comments-next';

async function activateExtension(): Promise<vscode.Extension<unknown>> {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(ext, `extension ${EXTENSION_ID} should be present`);
  await ext.activate();
  assert.ok(ext.isActive, 'extension should be active');
  return ext;
}

async function waitFor(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(predicate(), 'condition not met within timeout');
}

describe('better Comments Next integration', () => {
  it('activates without error', async () => {
    await activateExtension();
  });

  it('resolves comment tokens for typescript', async () => {
    await activateExtension();

    const comments = await definition.getAvailableComments('typescript');

    assert.ok(comments.lineComments.includes('//'), 'typescript should have `//` line comments');
    assert.ok(
      comments.blockComments.some(([start, end]) => start === '/*' && end === '*/'),
      'typescript should have `/* */` block comments',
    );
  });

  it('updates decorations for two same-language editors independently (B1 regression)', async () => {
    await activateExtension();

    const doc1 = await vscode.workspace.openTextDocument({ content: '// TODO: alpha\n', language: 'typescript' });
    const doc2 = await vscode.workspace.openTextDocument({ content: '// TODO: beta\n', language: 'typescript' });
    await vscode.window.showTextDocument(doc1, { viewColumn: vscode.ViewColumn.One, preview: false });
    await vscode.window.showTextDocument(doc2, { viewColumn: vscode.ViewColumn.Two, preview: false });

    const uri1 = doc1.uri.toString();
    const uri2 = doc2.uri.toString();
    const editor1 = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri1);
    const editor2 = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri2);
    assert.ok(editor1 && editor2, 'both editors should be visible');

    // spy on our own setDecorations: with the pre-fix shared-handler state,
    // the second trigger canceled the first update entirely
    let editor1Decorations = 0;
    const proto = CommonHandler.prototype as unknown as {
      setDecorations: (editor: vscode.TextEditor, tagRanges: Map<string, vscode.Range[]>) => void;
    };
    const original = proto.setDecorations;
    proto.setDecorations = function (editor: vscode.TextEditor, tagRanges: Map<string, vscode.Range[]>) {
      if (editor.document.uri.toString() === uri1) {
        editor1Decorations++;
      }
      return original.call(this, editor, tagRanges);
    };

    try {
      triggerUpdateDecorations({ editor: editor1 });
      triggerUpdateDecorations({ editor: editor2 });

      await waitFor(() => editor1Decorations > 0);
    }
    finally {
      proto.setDecorations = original;
    }
  });

  it('emits no unhandled rejections during rapid updates', async () => {
    await activateExtension();

    const doc = await vscode.workspace.openTextDocument({ content: '// TODO: alpha\n// TODO: beta\n', language: 'typescript' });
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      for (let i = 0; i < 5; i++) {
        triggerUpdateDecorations({ editor });
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    finally {
      process.off('unhandledRejection', onRejection);
    }

    assert.strictEqual(rejections.length, 0);
  });
});
