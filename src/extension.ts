import {
  window,
  commands,
  ExtensionContext,
  workspace,
  Uri,
  TreeDataProvider,
  TreeItem,
} from "vscode";
import { AnchorEngine } from "./anchorEngine";

let anchorEngine: AnchorEngine;

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext): void {
  const engine = new AnchorEngine(context);

  // Register extension commands
  commands.registerCommand("commentAnchors.parse", parseCurrentAnchors);
  commands.registerCommand("commentAnchors.toggle", toggleVisibilitySetting);
  commands.registerCommand(
    "commentAnchors.openFileAndRevealLine",
    openFileAndRevealLine
  );
  commands.registerCommand(
    "commentAnchors.launchWorkspaceScan",
    launchWorkspaceScan
  );
  commands.registerCommand("commentAnchors.listTags", () =>
    engine.openTagListPanel()
  );

  // Store a reference to the engine
  anchorEngine = engine;
}

export function deactivate(): void {
  anchorEngine.dispose();
}

/**
 * Reparse anchors in the current file
 */
function parseCurrentAnchors() {
  if (!window.activeTextEditor) return;

  anchorEngine.parse(window.activeTextEditor.document.uri);
}

/**
 * Luanch the workspace scan
 */
function launchWorkspaceScan() {
  anchorEngine.initiateWorkspaceScan();
}

/**
 * Toggles the visibility of comment anchors
 */
function toggleVisibilitySetting() {
  const config = workspace.getConfiguration("commentAnchors");

  config.update("tagHighlights.enabled", !config.tagHighlights.enabled);
}

type OpenFileAndRevealLineOptions = {
  uri: Uri;
  lineNumber: number;
  at: string;
};

/**
 * Opens a file and reveales the given line number
 */
function openFileAndRevealLine(options: OpenFileAndRevealLineOptions) {
  if (!options) return;

  function scrollAndMove() {
    commands.executeCommand("revealLine", {
      lineNumber: options.lineNumber,
      at: options.at,
    });
  }

  // Either open right away or wait for the document to open
  if (
    window.activeTextEditor &&
    window.activeTextEditor.document.uri == options.uri
  ) {
    scrollAndMove();
  } else {
    workspace.openTextDocument(options.uri).then((doc) => {
      window.showTextDocument(doc).then(() => {
        scrollAndMove();
      });
    });
  }
}
