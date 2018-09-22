import {window, commands, ExtensionContext, workspace, Uri, Disposable} from 'vscode';
import {AnchorEngine} from './anchorEngine';
import { FileAnchorProvider } from './fileAnchorProvider';
import { WorkspaceAnchorProvider } from './workspaceAnchorProvider';

let anchorEngine: AnchorEngine;

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
	const engine = new AnchorEngine(context);

	const fileProvider: FileAnchorProvider = engine.fileProvider;
	const workspaceProvider: WorkspaceAnchorProvider = engine.workspaceProvider;

	// Register the ActivityBar view providers
	window.registerTreeDataProvider('fileAnchors', fileProvider);
	window.registerTreeDataProvider('workspaceAnchors', workspaceProvider);

	// Register extension commands
	commands.registerCommand("commentAnchors.parse", parseCurrentAnchors);
	commands.registerCommand("commentAnchors.toggle", toggleVisibilitySetting);
	commands.registerCommand("commentAnchors.openFileAndRevealLine", openFileAndRevealLine);

	// Store a reference to the engine
	anchorEngine = engine;
}

export function deactivate() {
	anchorEngine.dispose();
}

/**
 * Reparse anchors in the current file
 */
function parseCurrentAnchors() {
	if(!window.activeTextEditor) return;

	anchorEngine.parse(window.activeTextEditor.document);
}

/**
 * Toggles the visibility of comment anchors
 */
function toggleVisibilitySetting() {
	const config = workspace.getConfiguration('commentAnchors');

	config.update("tagHighlights.enabled", !config.tagHighlights.enabled);
}

type OpenFileAndRevealLineOptions = {uri: Uri, lineNumber: number, at: string};

/**
 * Opens a file and reveales the given line number
 */
function openFileAndRevealLine(options: OpenFileAndRevealLineOptions) {
	if(!options) return;

	function scrollAndMove() {
		commands.executeCommand('revealLine', {
			lineNumber: options.lineNumber,
			at: options.at
		});
	}

	// Either open right away or wait for the document to open
	if(window.activeTextEditor && window.activeTextEditor.document.uri == options.uri) {
		scrollAndMove();
	} else {
		commands.executeCommand('vscode.openFolder', options.uri);

		// Wait for the document to open
		let unsub: Disposable = window.onDidChangeActiveTextEditor(() => {
			scrollAndMove();
	
			// Unsubscribe
			unsub.dispose();
		})
	}
}