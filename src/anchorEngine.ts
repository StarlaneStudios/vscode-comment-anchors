const debounce = require('debounce');

import * as path from 'path';
import * as fs from 'fs';
import * as escape from 'escape-string-regexp';
import EntryAnchor from './entryAnchor';
import EntryError from './entryError';
import {
	window,
	workspace,
	EventEmitter,
	TextEditor,
	TextDocument,
	TextEditorDecorationType,
	OverviewRulerLane,
	WorkspaceConfiguration,
	ExtensionContext,
	DecorationRenderOptions,
	OutputChannel,
	StatusBarAlignment,
	Uri,
	FileSystemWatcher,
	DecorationOptions,
	TextDocumentChangeEvent
} from "vscode";
import { FileAnchorProvider } from './fileAnchorProvider';
import { WorkspaceAnchorProvider } from './workspaceAnchorProvider';
import Spinner from './progressBar';

export class AnchorEngine {

	/** Then event emitter in charge of refreshing the file trees */
	public _onDidChangeTreeData: EventEmitter<undefined> = new EventEmitter<undefined>();

	/** Debounced function for performance improvements */
	private _idleRefresh: Function | undefined;

	/** The RegEx used for matching */
	public matcher: RegExp | undefined;

	/** A cache holding all documents */
	public anchorMaps: Map<Uri, EntryAnchor[]> = new Map();

	/** The decorators used for decorating the anchors */
	public anchorDecorators: Map<string, TextEditorDecorationType> = new Map();
	
	// ANCHOR Possible error entries //
	public errorUnusableItem: EntryError = new EntryError('Waiting for open editor...');
	public errorEmptyItem: EntryError = new EntryError('No comment anchors detected');
	public errorEmptyWorkspace: EntryError = new EntryError('No comment anchors in workspace');
	public errorLoading: EntryError = new EntryError('Searching for anchors...');
	public errorFileOnly: EntryError = new EntryError('No open workspaces');

	/** The list of tags and their settings */
	public tags: Map<string, TagEntry> = new Map();

	/** Returns true when all anchors have been loaded */
	public anchorsLoaded: boolean = false;

	/** The current editor */
	public _editor: TextEditor | undefined;

	/** Anchor comments config settings */
	public _config: WorkspaceConfiguration | undefined;

	/** The debug output for comment anchors */
	public _debug: OutputChannel;
	public static output: OutputChannel;

	/** The current file system watcher */
	private _watcher: FileSystemWatcher | undefined;

	/** Initialize the various providers */
	public readonly fileProvider = new FileAnchorProvider(this);
	public readonly workspaceProvider = new WorkspaceAnchorProvider(this);

	constructor(context: ExtensionContext) {
		window.onDidChangeActiveTextEditor(e => this.onActiveEditorChanged(e), this, context.subscriptions);
		workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e), this, context.subscriptions);
		workspace.onDidChangeConfiguration(() => this.buildResources(), this, context.subscriptions);
		workspace.onDidChangeWorkspaceFolders(() => this.buildResources(), this, context.subscriptions);
		workspace.onDidCloseTextDocument((e) => this.cleanUp(e), this, context.subscriptions);

		this._debug = window.createOutputChannel("Comment Anchors");
		AnchorEngine.output = this._debug;

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
				if(this._editor) this.parse(this._editor!.document.uri).then(() => {
					this.refresh();
				});
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
				this.tags.set(tag.tag.toUpperCase(), tag);

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
			this.matcher = new RegExp(`\\b(${tags}).+?\\b(.*)\\b`, config.tags.matchCase ? "gm" : "img");

			// Scan in all workspace files
			const matchFiles = config.workspace.matchFiles;
			this.anchorsLoaded = false;

			workspace.findFiles(matchFiles, config.workspace.excludeFiles).then(uris => {

				// Clear all existing mappings
				this.anchorMaps.clear();

				// Resolve all matched URIs
				this.loadWorkspace(uris).then(() => {
					if(this._editor) {
						this.addMap(this._editor!.document.uri);
					}
					
					this.anchorsLoaded = true;
					this.refresh();
				}).catch(err => {
					window.showErrorMessage("Comment Anchors failed to load: " + err.message);
				});
			});

			// Dispose the existing file watcher
			if(this._watcher) {
				this._watcher.dispose();
			}

			// Create a new file watcher
			this._watcher = workspace.createFileSystemWatcher(matchFiles, true, true, false);

			this._watcher.onDidDelete((file: Uri) => {
				this.anchorMaps.forEach((_, uri) => {
					if(uri.toString() == file.toString()) {
						this.removeMap(uri);
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
				await this.addMap(uris[i]);
			} catch(err) {
				// Ignore, already taken care of
			}

			parseCount++;
			parsePercentage = parseCount / uris.length * 100;

			parseStatus.text = `Parsing Comment Anchors... [${parsePercentage.toFixed(1)}%]`;
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
		return this.anchorMaps.get(this._editor.document.uri) || [];
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

		this.removeMap(document.uri);
	}

	/**
	 * Parse the given or current document
	 */	
	parse(document: Uri) : Promise<void> {
		return new Promise<void>(async (success, reject) => {
			try {
				let text = null;

				workspace.textDocuments.forEach(td => {
					if(td.uri == document) {
						text = td.getText();
						return false;
					}
				})
				
				if(text == null) {
					text = await this.readDocument(document);
				}

				let anchors = [];
				let match;

				// Find all anchor occurences
				while (match = this.matcher!.exec(text)) {
					const tag : TagEntry = this.tags.get(match[1].toUpperCase())!;

					const rangeLength = tag.styleComment ? 0 : 1;
					const startPos = match.index;
					const endPos = match.index + match[rangeLength].length;
					const deltaText = text.substr(0, startPos);
					const lineNumber = deltaText.split(/\r\n|\r|\n/g).length;
					
					const comment = match[2].trim();

					const display = this._config!.tags.displayInSidebar ? match[1] + ": " + comment : comment;
					const anchor = new EntryAnchor(match[1], display, startPos, endPos, lineNumber, tag.iconColor || "default", tag.scope!);

					anchors.push(anchor);
				}

				this.matcher!.lastIndex = 0;
				this.anchorMaps.set(document, anchors);
			} catch(err) {
				this._debug.appendLine("Error: " + err.message);
				reject(err);
			} finally {
				success();
			}
		});
	}
	
	/**
	 * Refresh the visual representation of the anchors
	 */
	refresh(): void {
		if(this._editor && this._config!.tagHighlights.enabled) {
			const document = this._editor!.document;
			const doc = document.uri;
			const anchors =  this.anchorMaps.get(doc) || [];

			this.anchorDecorators.forEach((decorator: TextEditorDecorationType, tag: String) => {
				const decorators : DecorationOptions[] = anchors.filter(a => a.anchorTag.toUpperCase() == tag.toUpperCase())
					.map(a => a.toDecorator(document));

				this._editor!.setDecorations(decorator, decorators);
			})
		}

		this._onDidChangeTreeData.fire();
	}

	/**
	 * Add a TextDocument mapping to the engine
	 * 
	 * @param document TextDocument
	 */
	addMap(document: Uri) : Thenable<void> {
		if(document.scheme !== 'file') return Promise.resolve();

		// Make sure we have no duplicates
		this.anchorMaps.forEach((_, doc) => {
			if(doc.path == document.path) {
				this.anchorMaps.delete(doc);
				return false;
			}
		});

		this.anchorMaps.set(document, []);

		return this.parse(document);
	}

	/**
	 * Remove a TextDocument mapping from the engine
	 * 
	 * @param editor textDocument
	 */
	removeMap(document: Uri) {
		if(document.scheme !== 'file') return;

		this.anchorMaps.delete(document);
	}

	private onActiveEditorChanged(editor: TextEditor | undefined): void {
		this._editor = editor;

		if(!this.anchorsLoaded) return;

		if(editor && !this.anchorMaps.has(editor.document.uri)) {

			// Bugfix - Replace duplicates
			new Map<Uri, EntryAnchor[]>(this.anchorMaps).forEach((_, document) => {
				if(document.path.toString() == editor.document.uri.path.toString()) {
					this.anchorMaps.delete(document);
					return false;
				}
			});

			this.anchorMaps.set(editor.document.uri, []);
			this.parse(editor.document.uri).then(() => {
				this.refresh();
			});
		} else {
			this.refresh();
		}
	}

	private onDocumentChanged(e: TextDocumentChangeEvent): void {
		if(!e.contentChanges) return;
		this._idleRefresh!();
	}

	/**
	 * Reads the document at the given Uri async
	 * 
	 * @param path Document uri
	 */
	private readDocument(path: Uri) : Thenable<string> {
		return new Promise<string>((success, reject) => {
			fs.readFile(path.fsPath, 'utf8', (err, data) => {
				if(err) {
					reject(err);
				} else {
					success(data);
				}
			});
		});
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