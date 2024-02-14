import * as vscode from 'vscode';
import * as configuration from '../configuration';
import { useLinePicker } from './line-picker';
import { useBlockPicker } from './block-picker';

export type LinePicker = ReturnType<typeof useLinePicker>;
export type BlockPicker = ReturnType<typeof useBlockPicker>;

export interface TagDecorationOptions extends vscode.DecorationOptions {
  tag: string;
}

export interface TagDecoration {
  tag: string;
  decorationType: vscode.TextEditorDecorationType;
}

function generateTagDecorations() {
  const configs = configuration.getConfigurationFlatten();
  const decorations: TagDecoration[] = [];
  for (const tag of configs.tags) {
    const opt = parseDecorationRenderOption(tag);

    const tagLight = configs.tagsLight.find(t => t.tag === tag.tag);
    if (tagLight) {
      opt.light = parseDecorationRenderOption(tagLight);
    }

    const tagDark = configs.tagsDark.find(t => t.tag === tag.tag);
    if (tagDark) {
      opt.dark = parseDecorationRenderOption(tagDark);
    }

    decorations.push({
      tag: tag.tag,
      decorationType: vscode.window.createTextEditorDecorationType(opt),
    });
  }

  return decorations;
}

/**
 * Parse decoration render option by tag configuration
 */
function parseDecorationRenderOption(tag: configuration.TagFlatten) {
  const options: vscode.DecorationRenderOptions = { color: tag.color, backgroundColor: tag.backgroundColor };

  const textDecorations: string[] = [];
  tag.strikethrough && textDecorations.push('line-through');
  tag.underline && textDecorations.push('underline');
  options.textDecoration = textDecorations.join(' ');

  if (tag.bold) {
    options.fontWeight = 'bold';
  }

  if (tag.italic) {
    options.fontStyle = 'italic';
  }

  return options;
}

export function useParser() {
  // Vscode active editor
  let activedEditor: vscode.TextEditor | undefined;

  let tagDecorations: TagDecoration[] = generateTagDecorations();
  configuration.onDidChange(() => {
    tagDecorations = generateTagDecorations();
  });

  const linePickers = new Map<string, LinePicker>();
  function getLinePicker(langId: string) {
    let linePicker = linePickers.get(langId);
    if (!linePicker) {
      linePicker = useLinePicker(langId);
      linePickers.set(langId, linePicker);
    }
    return linePicker;
  }

  const blockPickes = new Map<string, BlockPicker>();
  function getBlockPicker(langId: string) {
    let blockPicker = blockPickes.get(langId);
    if (!blockPicker) {
      blockPicker = useBlockPicker(langId);
      blockPickes.set(langId, blockPicker);
    }
    return blockPicker;
  }

  /**
   * Get actived editor
   */
  function getEditor() {
    return activedEditor;
  }

  /**
   * Switch editor for parser and setup pickers
   */
  async function setEditor(editor: vscode.TextEditor) {
    activedEditor = editor;
  }

  /**
   * Apply decorations after finding all relevant comments
   */
  async function updateDecorationsDirectly(): Promise<void> {
    if (!activedEditor) {
      return;
    }

    const [linePicker, blockPicker] = await Promise.all([
      getLinePicker(activedEditor.document.languageId),
      getBlockPicker(activedEditor.document.languageId),
    ]);

    const blockPicked = await blockPicker.pick({ editor: activedEditor });
    const linePicked = await linePicker.pick({ skipRanges: blockPicked.blockRanges, editor: activedEditor });

    for (const td of tagDecorations) {
      const lowerTag = td.tag.toLowerCase();
      const blockOpts = (blockPicked?.decorationOptions.filter(opt => opt.tag === lowerTag) || []) as vscode.DecorationOptions[];
      const lineOpts = (linePicked?.decorationOptions.filter(opt => opt.tag === lowerTag) || []) as vscode.DecorationOptions[];

      activedEditor.setDecorations(td.decorationType, [...blockOpts, ...lineOpts]);
    }
  }

  // * IMPORTANT:
  // * To avoid calling update too often,
  // * set a timer for 100ms to wait before updating decorations
  let triggerUpdateTimeout: NodeJS.Timer | undefined;
  function updateDecorations(time: true | number = 100) {
    if (triggerUpdateTimeout) {
      clearTimeout(triggerUpdateTimeout);
    }

    if (time === true) {
      updateDecorationsDirectly();
      return;
    }

    triggerUpdateTimeout = setTimeout(updateDecorationsDirectly, time);
  }

  // Update decorations when configuration changed
  configuration.onDidChange(updateDecorationsDirectly);

  return {
    getEditor,
    setEditor,
    updateDecorations,
  };
}
