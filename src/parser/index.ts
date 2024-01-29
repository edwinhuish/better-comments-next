import * as vscode from 'vscode';
import { getConfigurationFlatten } from '../configuration';
import * as languages from '../languages';
import type { ConfigurationFlatten, TagFlatten } from '../configuration';
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

function generateTagDecorations(configs: ConfigurationFlatten) {
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
function parseDecorationRenderOption(tag: TagFlatten) {
  const options: vscode.DecorationRenderOptions = { color: tag.color, backgroundColor: tag.backgroundColor };

  // ? the textDecoration is initialised to empty so we can concat a preceeding space on it
  options.textDecoration = '';

  if (tag.strikethrough) {
    options.textDecoration += 'line-through';
  }

  if (tag.underline) {
    options.textDecoration += ' underline';
  }

  if (tag.bold) {
    options.fontWeight = 'bold';
  }

  if (tag.italic) {
    options.fontStyle = 'italic';
  }

  return options;
}

export function useParser(configuration?: ConfigurationFlatten) {
  // Better comments configuration in flatten
  const configs = configuration || getConfigurationFlatten();

  const tagDecorations: TagDecoration[] = generateTagDecorations(configs);

  // Line picker
  let linePicker: LinePicker | undefined;

  // Block pickers
  let blockPicker: BlockPicker | undefined;

  // Vscode active editor
  let activedEditor: vscode.TextEditor | undefined;

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

    const comments = await languages.getAvailableCommentRules(activedEditor.document.languageId);

    linePicker = useLinePicker({ editor, comments, configs });

    blockPicker = useBlockPicker({ editor, comments, configs });
  }

  /**
   * Apply decorations after finding all relevant comments
   */
  function updateDecorations(): void {
    if (!activedEditor) {
      return;
    }

    const blockPicked = blockPicker?.pick();

    const linePicked = linePicker?.pick({ skipRanges: blockPicked?.blockRanges });

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
  function triggerUpdateDecorations(ms = 100) {
    if (triggerUpdateTimeout) {
      clearTimeout(triggerUpdateTimeout);
    }

    triggerUpdateTimeout = setTimeout(updateDecorations, ms);
  }

  return {
    updateLanguagesDefinitions: languages.updateDefinitions,
    getEditor,
    setEditor,
    updateDecorations,
    triggerUpdateDecorations,
  };
}
