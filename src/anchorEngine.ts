const debounce = require('debounce');

import * as path from 'path';
import * as escape from 'escape-string-regexp';
import EntryAnchor from './entryAnchor';
import EntryError from './entryError';
import {
	window,
	workspace,
	EventEmitter,
	TextDocumentChangeEvent,
	TextEditor,
	TextDocument,
	TextEditorDecorationType,
	OverviewRulerLane,
	Range,
	WorkspaceConfiguration,
	ExtensionContext,
	DecorationRenderOptions,
	OutputChannel,
	StatusBarAlignment,
	Uri,
	FileSystemWatcher
} from "vscode";
import { FileAnchorProvider } from './fileAnchorProvider';
import { WorkspaceAnchorProvider } from './workspaceAnchorProvider';

export class AnchorEngine {

	/** Then event emitter in charge of refreshing the file trees */
	public _onDidChangeTreeData: EventEmitter<undefined> = new EventEmitter<undefined>();

	/** Debounced function for performance improvements */
	private _idleRefresh: Function | undefined;

	/** The RegEx used for matching */
	public matcher: RegExp | undefined;

	/** A cache holding all documents */
	public anchorMaps: Map<TextDocument, EntryAnchor[]> = new Map();

	/** The decorators used for decorating the anchors */
	public anchorDecorators: Map<string, TextEditorDecorationType> = new Map();
	
	// ANCHOR Possible error entries //
	public unusableItem: EntryError = new EntryError('Waiting for open editor...');
	public emptyItem: EntryError = new EntryError('No comment anchors detected');
	public emptyWorkspace: EntryError = new EntryError('No comment anchors in workspace');
	public loading: EntryError = new EntryError('Searching for anchors...');
	public fileOnly: EntryError = new EntryError('No open workspaces');

	/** The list of tags and their settings */
	public tags: Map<string, TagEntry> = new Map();

	/** Returns true when all anchors have been loaded */
	public anchorsLoaded: boolean = false;

	/** The current editor */
	public _editor: TextEditor | undefined;

	/** Anchor comments config settings */
	private _config: WorkspaceConfiguration | undefined;

	/** The debug output for comment anchors */
	public _debug: OutputChannel;

	/** The current file system watcher */
	private _watcher: FileSystemWatcher | undefined;

	/** Initialize the various providers */
	public readonly fileProvider = new FileAnchorProvider(this);
	public readonly workspaceProvider = new WorkspaceAnchorProvider(this);

	constructor(context: ExtensionContext) {
		window.onDidChangeActiveTextEditor(e => this.onActiveEditorChanged(e), this, context.subscriptions);
		workspace.onDidChangeTextDocument(e => this.onDocumentChanged(), this, context.subscriptions);
		workspace.onDidChangeConfiguration(() => this.buildResources(), this, context.subscriptions);
		workspace.onDidChangeWorkspaceFolders(() => this.buildResources(), this, context.subscriptions);
		workspace.onDidCloseTextDocument((e) => this.cleanUp(e), this, context.subscriptions);

		this._debug = window.createOutputChannel("Comment Anchors");

		if(window.activeTextEditor) {
			this._editor = window.activeTextEditor;
		}

		// Build required anchor resources
		this.buildResources();
	}

	buildResources() {
		try {
			const config = this._config = workspace.getConfiguration('commentAnchors');

			// Construct the debounce
			this._idleRefresh = debounce(() => {
				if(this._editor) this.parse(this._editor!.document);
			}, config.parseDelay);

			// Store the sorting method
			if(config.tags.sortMethod && (config.tags.sortMethod == 'line' || config.tags.sortMethod == 'type')) {
				EntryAnchor.SortMethod = config.tags.sortMethod;
			}
			
			// Create a map holding the tags
			this.tags.clear();
			this.anchorDecorators.forEach((type: TextEditorDecorationType) => type.dispose());
			this.anchorDecorators.clear();

			config.tags.list.forEach((tag: TagEntry) => {
				this.tags.set(tag.tag, tag);

				if(!tag.scope) {
					tag.scope = 'workspace';
				}

				if(config.tagHighlights.enabled) {

					// Create base configuration
					let highlight : DecorationRenderOptions = {
						fontWeight: tag.isBold || tag.isBold == undefined? "bold": "normal",
						fontStyle: tag.isItalic || tag.isItalic == undefined ? "italic": "normal",
						color: tag.highlightColor,
						backgroundColor: tag.backgroundColor,
						overviewRulerColor: tag.highlightColor,
						overviewRulerLane: OverviewRulerLane.Full
					};

					// Optional gutter icons
					if(config.tags.displayInGutter) {
						highlight = {
							...highlight,
							dark: {
								gutterIconPath: path.join(__dirname, '..', 'res', `anchor_${tag.iconColor == 'default' ? 'white' : tag.iconColor}.svg`)
							},
							light: {
								gutterIconPath: path.join(__dirname, '..', 'res', `anchor_${tag.iconColor == 'default' ? 'black' : tag.iconColor}.svg`)
							}
						}
					}

					// Optional border
					if(tag.borderStyle) {
						highlight = {
							...highlight,
							border: tag.borderStyle,
							borderRadius: tag.borderRadius + "px"
						}
					}
					
					// Create the decoration type
					this.anchorDecorators.set(tag.tag, window.createTextEditorDecorationType(highlight));
				}
			});

			// Create a matcher for the tags
			const tags = Array.from(this.tags.keys()).map(tag => escape(tag)).join('|');

			if(tags.length === 0) {
				window.showErrorMessage("Invalid tag(s) defined");
				return;
			}

			// ANCHOR Tag RegEx
			this.matcher = new RegExp(`\\b(${tags})\\b(.*)\\b`, "gm");

			// Scan in all workspace files
			const matchFiles = config.workspace.matchFiles;
			this.anchorsLoaded = false;

			workspace.findFiles(matchFiles, config.workspace.excludeFiles).then(uris => {

				// Clear all existing mappings
				this.anchorMaps.clear();

				// Resolve all matched URIs
				this.loadWorkspace(uris).then(() => {
					this._onDidChangeTreeData.fire();
					this.anchorsLoaded = true;
				})
			});

			// Dispose the existing file watcher
			if(this._watcher) {
				this._watcher.dispose();
			}

			// Create a new file watcher
			this._watcher = workspace.createFileSystemWatcher(matchFiles, true, true, false);

			this._watcher.onDidDelete((file: Uri) => {
				this.anchorMaps.forEach((_, document) => {
					if(document.uri.toString() == file.toString()) {
						this.removeMap(document);
						return false;
					}
				});
			})
		} catch(err) {
			console.error("Failed to build resources: " + err.message);
			console.error(err);
		}
	}

	async loadWorkspace(uris: Uri[]) {
		var parseStatus = window.createStatusBarItem(StatusBarAlignment.Left, 0);
		let parseCount: number = 0;
		let parsePercentage: number = 0;

		
		parseStatus.tooltip = "Provided by the Comment Anchors extension";
		parseStatus.text = `Parsing Comment Anchors... [0.0%]`;
		parseStatus.show();

		for(let i = 0; i < uris.length; i++) {
			try {
				let document = await workspace.openTextDocument(uris[i]);
				this.addMap(document);

				parseCount++;
				parsePercentage = parseCount / uris.length * 100;

				parseStatus.text = `Parsing Comment Anchors... [${parsePercentage.toFixed(1)}%]`;
			} catch(err) {
				// Thrown when document is not a text document
				// in this case, we can simply ignore
			}
		};

		parseStatus.text = `Comment Anchors loaded!`;

		setTimeout(() => {
			parseStatus.dispose();
		}, 3000);
	}

	/**
	 * Returns the anchors in the current document
	 */
	get currentAnchors(): EntryAnchor[] {
		if(!this._editor) return [];
		return this.anchorMaps.get(this._editor.document) || [];
	}

	/**
	 * Dispose anchor list resources
	 */
	dispose() {
		this.anchorDecorators.forEach((type: TextEditorDecorationType) => type.dispose());
	}

	/**
	 * Clean up external files
	 */
	cleanUp(document: TextDocument) {
		if(document.uri.scheme != 'file') return;

		const ws = workspace.getWorkspaceFolder(document.uri);
		if(ws) return;

		this.removeMap(document);
	}

	/**
	 * Parse the given or current document
	 */	
	parse(document: TextDocument) {
		const text = document.getText();
		let anchors = [];
		let match;

		// Find all anchor occurences
		while (match = this.matcher!.exec(text)) {
			const tag : TagEntry = this.tags.get(match[1])!;

			const rangeLength = tag.styleComment ? 0 : 1;
			const startPos = document.positionAt(match.index);
			const endPos = document.positionAt(match.index + match[rangeLength].length);
			const anchorSpan = new Range(startPos, endPos);
			const comment = match[2].trim();
			const decoration = { range: anchorSpan, hoverMessage: comment };

			const display = this._config!.tags.displayInSidebar ? match[1] + ": " + comment : comment;
			const anchor = new EntryAnchor(match[1], display, decoration, tag.iconColor || "default", tag.scope!);

			anchors.push(anchor);
		}

		this.matcher!.lastIndex = 0;
		this.anchorMaps.set(document, anchors);

		if(this._editor && this._editor!.document == document) this.refresh();
	}
	
	/**
	 * Refresh the visual representation of the anchors
	 */
	refresh(): void {
		if(this._editor && this._config!.tagHighlights.enabled) {
			const doc = this._editor!.document;
			const anchors = this.anchorMaps.get(doc) || [];

			this.anchorDecorators.forEach((decorator: TextEditorDecorationType, tag: String) => {
				this._editor!
				.setDecorations(decorator, anchors
					.filter(a => a.anchorTag == tag)
					.map(a => a.decorator));
			})
		}

		this._onDidChangeTreeData.fire();
	}

	/**
	 * Add a TextDocument mapping to the engine
	 * 
	 * @param document TextDocument
	 */
	addMap(document: TextDocument) {
		if(document.uri.scheme !== 'file') return;

		if(!this.anchorMaps.has(document)) {
			this.anchorMaps.set(document, []);
		}

		this.parse(document);
	}

	/**
	 * Remove a TextDocument mapping from the engine
	 * 
	 * @param editor textDocument
	 */
	removeMap(document: TextDocument) {
		if(document.uri.scheme !== 'file') return;

		this.anchorMaps.delete(document);
	}

	private onActiveEditorChanged(editor: TextEditor | undefined): void {
		this._editor = editor;

		if(!this.anchorsLoaded) return;

		if(editor && !this.anchorMaps.has(editor.document)) {

			// Bugfix - Replace duplicates
			new Map<TextDocument, EntryAnchor[]>(this.anchorMaps).forEach((_, document) => {
				if(document.uri.toString() == editor.document.uri.toString()) {
					this._debug.appendLine("Recached document " + document.uri.path);
					this.anchorMaps.delete(document);
					return false;
				}
			});

			this.anchorMaps.set(editor.document, []);
			this.parse(editor.document);
		}

		this.refresh();
	}

	private onDocumentChanged(): void {
		this._idleRefresh!();
	}

}

/**
 * A tag entry in the settings
 */
export interface TagEntry {
	tag: string;
	iconColor: string;
	highlightColor:string;
	backgroundColor?: string;
	styleComment?: boolean;
	borderStyle?: string;
	borderRadius?: number;
	isBold?: boolean;
	isItalic?: boolean;
	scope?: string
}