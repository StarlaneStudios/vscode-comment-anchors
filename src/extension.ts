import {window, commands, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument, TreeView, Selection, Position} from 'vscode';
import {AnchorListProvider} from './anchorList';
import { posix } from 'path';
import Anchor from './anchor';

let anchorListProvider: AnchorListProvider;

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
	anchorListProvider = new AnchorListProvider(context);

	window.registerTreeDataProvider('anchorsList', anchorListProvider);
	commands.registerCommand("commentAnchors.parse", () => anchorListProvider.parse(null));
}

export function deactivate() {
	anchorListProvider.dispose();
}