const debounce = require('debounce');

import Anchor from './anchor';
import {
	window,
	workspace,
	TreeDataProvider,
	Event,
	EventEmitter,
	TreeItem,
	TextDocumentChangeEvent,
	TextEditor,
	TextDocument,
	TextEditorDecorationType,
	OverviewRulerLane,
	Range,
	WorkspaceConfiguration,
	ExtensionContext,
	Disposable,
	
} from "vscode";

export class AnchorListProvider implements TreeDataProvider<Anchor>, Disposable {

	private _onDidChangeTreeData: EventEmitter<undefined> = new EventEmitter<undefined>();
	readonly onDidChangeTreeData: Event<undefined> = this._onDidChangeTreeData.event;

	/** Debounced function for performance improvements */
	private _idleRefresh: Function | undefined;

	/** The RegEx used for matching */
	public matcher: RegExp | undefined;

	/** A cache holding all documents */
	public anchorMaps: Map<TextDocument, Anchor[]> = new Map();

	/** The decorators used for decorating the anchors */
	public anchorDecorators: Map<String, TextEditorDecorationType> = new Map();

	/** The current list of anchors */
	public anchors: Anchor[] = [];

	/** The list of tags and their colors */
	public tags: Map<String, String> = new Map();

	/** The current editor */
	private _editor: TextEditor | undefined;

	/** Anchor comments config settings */
	private _config: WorkspaceConfiguration | undefined;

	/** The contex of this extension, used for disposing */
	private _context: ExtensionContext;

	constructor(context: ExtensionContext) {
		this._context = context;

		window.onDidChangeActiveTextEditor(e => this.onActiveEditorChanged(e), this, context.subscriptions);
		workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e), this, context.subscriptions);
		workspace.onDidChangeConfiguration(() => this.buildResources(), this, context.subscriptions);
		workspace.onDidCloseTextDocument(e => this.removeMap(e), this, context.subscriptions);
		workspace.onDidOpenTextDocument(e => this.addMap(e), this, context.subscriptions);

		if(window.activeTextEditor) {
			this.anchorMaps.set(window.activeTextEditor!.document, this.anchors);
			this._editor = window.activeTextEditor;
		}

		this.buildResources();
	}

	buildResources() {
		try {
			this._config = workspace.getConfiguration('commentAnchors');

			// Construct the debounce
			this._idleRefresh = debounce(this.parse, this._config.parseDelay);
			
			// Create a map holding the tags
			this.tags.clear();
			this.anchorDecorators.forEach((type: TextEditorDecorationType) => type.dispose());
			this.anchorDecorators.clear();

			this._config.tags.list.forEach((tag: TagEntry) => {
				this.tags.set(tag.tag, tag.iconColor);

				if(this._config!.tagHighlights.enabled) {
					this.anchorDecorators.set(tag.tag, window.createTextEditorDecorationType({
						color: tag.highlightColor,
						fontWeight: "bold",
						overviewRulerColor: tag.highlightColor,
						overviewRulerLane: OverviewRulerLane.Right
					}));
				}
			});

			// Create a matcher for the tags
			const tags = Array.from(this.tags.keys()).join('|');

			if(tags.length === 0) {
				window.showErrorMessage("Invalid tag(s) defined");
				return;
			}

			this.matcher = new RegExp(`\\b(${tags})\\b(.*)$`, "gm");

			// Perform a parse of the document
			this.parse(null);
		} catch(err) {
			console.error("Failed to build resources: " + err.message);
			console.error(err);
		}
	}

	/**
	 * Dispose anchor list resources
	 */
	dispose() {
		this.anchorDecorators.forEach((type: TextEditorDecorationType) => type.dispose());
	}

	/**
	 * Parse the given or current document
	 */	
	parse(document: TextDocument | null) {
		if(this._editor || document) {
			let doc = document || this._editor!.document;

			// Clear the anchors list
			this.anchors.length = 0;

			const text = doc.getText();
			let match;

			// Find all anchor occurences
			while (match = this.matcher!.exec(text)) {
				const startPos = doc.positionAt(match.index);
				const endPos = doc.positionAt(match.index + match[1].length);
				const anchorSpan = new Range(startPos, endPos);
				const comment = match[2].trim();
				const decoration = { range: anchorSpan, hoverMessage: comment };

				const display = this._config!.tags.displayInSidebar ? match[1] + ": " + comment : comment;
				const anchor = new Anchor(match[1], display, decoration, this.tags.get(match[1]) || "default");
				
				this.anchors.push(anchor);
			}

			this.matcher!.lastIndex = 0;
		}

		if(!document) this.refresh();
	}
	
	/**
	 * Refresh the visual representation of the anchors
	 */
	refresh(): void {
		if(this._editor && this._config!.tagHighlights.enabled) {
			this.anchorDecorators.forEach((decorator: TextEditorDecorationType, tag: String) => {
				this._editor!.setDecorations(decorator, this.anchors
					.filter(a => a.anchorTag == tag).map(a => a.decorator));
			})
		}

		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Anchor): TreeItem {
		return element;
	}

	getChildren(element?: Anchor): Thenable<Anchor[]> {
		if(element || this._editor == undefined) {
			return Promise.resolve([]);
		}

		return new Promise(resolve => {
			resolve(this.anchors);
		});
	}

	addMap(document: TextDocument) {
		if(document.uri.scheme !== 'file') return;

		if(this.anchorMaps.has(document)) {
			this.anchors = this.anchorMaps.get(document)!;
		} else {
			this.anchors = [];
			this.anchorMaps.set(document, this.anchors);
		}

		this.parse(document);
	}

	removeMap(editor: TextDocument) {
		if(editor.uri.scheme !== 'file') return;

		this.anchorMaps.delete(editor);
	}

	private onActiveEditorChanged(editor: TextEditor | undefined): void {
		this._editor = editor;

		if(!editor) {
			this.anchors = []; // Reset the anchor list
		} else {
			if(this.anchorMaps.has(editor.document)) {
				this.anchors = this.anchorMaps.get(editor.document)!;
			} else {
				this.anchors = [];
				this.anchorMaps.set(editor.document, this.anchors);
			}
		}

		this.refresh();
	}

	private onDocumentChanged(changeEvent: TextDocumentChangeEvent): void {
		this._idleRefresh!();
	}

}

/**
 * A tag entry in the settings
 */
interface TagEntry {
	tag: String;
	iconColor: String;
	highlightColor: String;
}
