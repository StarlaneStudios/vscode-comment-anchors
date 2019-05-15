import {window, commands, ExtensionContext, workspace, Uri, Disposable, TreeDataProvider, TreeItem} from 'vscode';
import {AnchorEngine} from './anchorEngine';
import openAnchorList from './anchorListView';
import UpdateMonitor from './updateMonitor';

let anchorEngine: AnchorEngine;

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
	const engine = new AnchorEngine(context);

	// Check for extension updates
	new UpdateMonitor(context).checkForUpdate();
	
	// Register the ActivityBar view providers
	window.registerTreeDataProvider('fileAnchors', engine.fileProvider as TreeDataProvider<TreeItem>);
	window.registerTreeDataProvider('workspaceAnchors', engine.workspaceProvider as TreeDataProvider<TreeItem>);
	window.registerTreeDataProvider('epicAnchors', engine.epicProvider as TreeDataProvider<TreeItem>);

	// Register extension commands
	commands.registerCommand("commentAnchors.parse", parseCurrentAnchors);
	commands.registerCommand("commentAnchors.toggle", toggleVisibilitySetting);
	commands.registerCommand("commentAnchors.openFileAndRevealLine", openFileAndRevealLine);
	commands.registerCommand("commentAnchors.launchWorkspaceScan", launchWorkspaceScan);
	commands.registerCommand("commentAnchors.listTags", () => openAnchorList(engine));

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