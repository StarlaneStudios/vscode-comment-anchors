const debounce = require('debounce');

// Utility used for awaiting a timeout
const asyncDelay = (delay: number) : Promise<void> => {
	return new Promise((success) => {
		setTimeout(() => {
			success();
		}, delay);
	});
}

import * as path from 'path';
import * as fs from 'fs';
import * as escape from 'escape-string-regexp';
import EntryAnchor from './anchor/entryAnchor';
import EntryError from './anchor/entryError';
import { FileAnchorProvider } from './provider/fileAnchorProvider';
import { WorkspaceAnchorProvider } from './provider/workspaceAnchorProvider';
import EntryLoading from './anchor/entryLoading';
import EntryScan from './anchor/entryScan';
import EntryAnchorRegion from './anchor/entryAnchorRegion';
import registerDefaults from './util/defaultTags';
import { createViewContent } from './anchorListView';

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
	TextDocumentChangeEvent,
	languages,
	FoldingRange,
	FoldingRangeKind,
	ProviderResult,
	CompletionItem,
	CompletionList,
	CompletionItemKind,
	Disposable,
	ViewColumn,
	TreeDataProvider,
	TreeItem,
	TreeView
} from "vscode";
import { AnchorIndex } from './anchorIndex';
import EntryCachedFile from './anchor/entryCachedFile';

/* -- Anchor entry type aliases -- */

export type FileEntry = EntryAnchor|EntryError|EntryLoading;
export type FileEntryArray = EntryAnchor[]|EntryError[]|EntryLoading[];

export type AnyEntry = EntryAnchor|EntryError|EntryCachedFile|EntryScan;
export type AnyEntryArray = EntryAnchor[]|EntryError[]|EntryCachedFile[]|EntryScan[];

/**
 * The main anchor parsing and caching engine
 */
export class AnchorEngine {

	/** The context of Comment Anchors */
	public context: ExtensionContext;

	/** Then event emitter in charge of refreshing the file trees */
	public _onDidChangeTreeData: EventEmitter<undefined> = new EventEmitter<undefined>();

	/** Debounced function for performance improvements */
	private _idleRefresh: Function | undefined;

	/** The RegEx used for matching */
	public matcher: RegExp | undefined;

	/** A cache holding all documents */
	public anchorMaps: Map<Uri, AnchorIndex> = new Map();

	/** List of folds created by anchor regions */
	// public foldMaps: Map<Uri, FoldingRange[]> = new Map();

	/** The decorators used for decorating the anchors */
	public anchorDecorators: Map<string, TextEditorDecorationType> = new Map();

	/** The list of tags and their settings */
	public tags: Map<string, TagEntry> = new Map();

	/** Returns true when all anchors have been loaded */
	public anchorsLoaded: boolean = false;

	/** Holds whether a scan has been performed since rebuild */
	public anchorsScanned: boolean = false;

	/** The tree view used for displaying file anchors */
	public fileTreeView: TreeView<FileEntry>;

	/** The tree view used for displaying workspace anchors */
	public workspaceTreeView: TreeView<AnyEntry>;

	/** The currently expanded file tree items */
	public expandedFileTreeViewItems: string[] = [];

	/** The currently expanded workspace tree items  */
	public expandedWorkspaceTreeViewItems: string[] = [];

	/** The current editor */
	public _editor: TextEditor | undefined;

	/** Anchor comments config settings */
	public _config: WorkspaceConfiguration | undefined;

	/** The current file system watcher */
	private _watcher: FileSystemWatcher | undefined;

	/** List of build subscriptions */
	private _subscriptions: Disposable[] = [];

	/** The debug output for comment anchors */
	public static output: (msg: string) => void;

	// Possible error entries //
	public errorUnusableItem: EntryError = new EntryError('Waiting for open editor...');
	public errorEmptyItem: EntryError = new EntryError('No comment anchors detected');
	public errorEmptyWorkspace: EntryError = new EntryError('No comment anchors in workspace');
	public errorWorkspaceDisabled: EntryError = new EntryError('Workspace disabled');
	public errorFileOnly: EntryError = new EntryError('No open workspaces');
	public statusLoading: EntryLoading = new EntryLoading();
	public statusScan: EntryScan = new EntryScan();

	constructor(context: ExtensionContext) {
		this.context = context;

		window.onDidChangeActiveTextEditor(e => this.onActiveEditorChanged(e), this, context.subscriptions);
		workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e), this, context.subscriptions);
		workspace.onDidChangeConfiguration(() => this.buildResources(), this, context.subscriptions);
		workspace.onDidChangeWorkspaceFolders(() => this.buildResources(), this, context.subscriptions);
		workspace.onDidCloseTextDocument((e) => this.cleanUp(e), this, context.subscriptions);

		const outputChannel = window.createOutputChannel("Comment Anchors");
		AnchorEngine.output = (m: string) => outputChannel.appendLine("[Comment Anchors] " + m);

		if(window.activeTextEditor) {
			this._editor = window.activeTextEditor;
		}

		// Build required anchor resources
		this.buildResources();

		// Create the file anchor view
		this.fileTreeView = window.createTreeView('fileAnchors', {
			treeDataProvider: new FileAnchorProvider(this),
			showCollapseAll: true
		});

		this.fileTreeView.onDidExpandElement((e) => {
			if(e.element instanceof EntryAnchor) {
				this.expandedFileTreeViewItems.push(e.element.anchorText);
			}
		});

		this.fileTreeView.onDidCollapseElement((e) => {
			if(e.element instanceof EntryAnchor) {
				const idx = this.expandedFileTreeViewItems.indexOf(e.element.anchorText);
				this.expandedFileTreeViewItems.splice(idx, 1);
			}
		});

		// Create the workspace anchor view
		this.workspaceTreeView = window.createTreeView('workspaceAnchors', {
			treeDataProvider: new WorkspaceAnchorProvider(this),
			showCollapseAll: true
		});

		this.workspaceTreeView.onDidExpandElement((e) => {
			if(e.element instanceof EntryAnchor) {
				this.expandedWorkspaceTreeViewItems.push(e.element.anchorText);
			}
		});

		this.workspaceTreeView.onDidCollapseElement((e) => {
			if(e.element instanceof EntryAnchor) {
				const idx = this.expandedWorkspaceTreeViewItems.indexOf(e.element.anchorText);
				this.expandedWorkspaceTreeViewItems.splice(idx, 1);
			}
		});
	}

	public registerProviders()	{
		const config = this._config!!;

		// Provide auto completion
		if(config.tags.provideAutoCompletion) {
			const endTag = config.tags.endTag;
			const provider = languages.registerCompletionItemProvider({language: '*'}, {

				provideCompletionItems: () : ProviderResult<CompletionList> => {
					const ret = new CompletionList();
					const separator = config.tags.separators[0];
					
					for(let tag of this.tags.values()) {
						let item = new CompletionItem(tag.tag + " Anchor", CompletionItemKind.Reference);
						
						item.documentation = `Insert ${tag.tag} comment anchor`;
						item.insertText = tag.tag + separator;
						
						ret.items.push(item);

						if(tag.isRegion) {
							let endItem = new CompletionItem(endTag + tag.tag + " Anchor", CompletionItemKind.Reference);
						
							endItem.documentation = `Insert ${endTag + tag.tag} comment anchor`;
							endItem.insertText = endTag + tag.tag + separator;
							
							ret.items.push(endItem);
						}
					}
					
					return ret;
				}

			});
			
			this._subscriptions.push(provider);
		}
	}

	public buildResources() {
		try {
			this.anchorsScanned = false;
			const config = this._config = workspace.getConfiguration('commentAnchors');

			// Construct the debounce
			this._idleRefresh = debounce(() => {
				if(this._editor) this.parse(this._editor!.document.uri).then(() => {
					this.refresh();
				});
			}, config.parseDelay);

			// Disable previous build resources
			this._subscriptions.forEach(s => s.dispose());
			this._subscriptions = [];

			// Store the sorting method
			if(config.tags.sortMethod && (config.tags.sortMethod == 'line' || config.tags.sortMethod == 'type')) {
				EntryAnchor.SortMethod = config.tags.sortMethod;
			}

			// Store the scroll position
			if(config.scrollPosition) {
				EntryAnchor.ScrollPosition = config.scrollPosition;
			}
			
			// Create a map holding the tags
			this.tags.clear();
			this.anchorDecorators.forEach((type: TextEditorDecorationType) => type.dispose());
			this.anchorDecorators.clear();

			// Register default tags
			registerDefaults(this.tags);

			// Add custom tags
			config.tags.list.forEach((tag: TagEntry) => {
				let def = this.tags.get(tag.tag.toUpperCase()) || {};

				if(tag.enabled === false) {
					this.tags.delete(tag.tag.toUpperCase());
					return;
				}

				const opts = {...def, ...tag};

				this.tags.set(tag.tag.toUpperCase(), opts);
			});

			// Detect the lane style
			let laneStyle: OverviewRulerLane;

			if(config.tags.rulerStyle == "left") {
				laneStyle = OverviewRulerLane.Left;
			} else if(config.tags.rulerStyle == "right") {
				laneStyle = OverviewRulerLane.Right;
			} else if(config.tags.rulerStyle == "center") {
				laneStyle = OverviewRulerLane.Center;
			} else {
				laneStyle = OverviewRulerLane.Full;
			}

			// Configure all tags
			Array.from(this.tags.values()).forEach((tag: TagEntry) => {

				if(!tag.scope) {
					tag.scope = 'workspace';
				}

				if(config.tagHighlights.enabled) {

					// Create base configuration
					let highlight : DecorationRenderOptions = {
						fontWeight: tag.isBold || tag.isBold == undefined? "bold": "normal",
						fontStyle: tag.isItalic || tag.isItalic == undefined ? "italic": "normal",
						color: tag.highlightColor,
						backgroundColor: tag.backgroundColor
					};

					// Optionally insert rulers
					if(config.tags.displayInRuler) {
						highlight.overviewRulerColor = tag.highlightColor;
						highlight.overviewRulerLane = laneStyle;
					}

					// Optional gutter icons
					if(config.tags.displayInGutter && tag.iconColor !== 'none') {
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

			// Fetch an array of tags
			let matchTags = Array.from(this.tags.keys());

			// Generate region end tags
			const endTag = this._config.tags.endTag;

			AnchorEngine.output("endTag: " + endTag);
			
			this.tags.forEach((entry, tag) => { 
				if(entry.isRegion) {
					matchTags.push(endTag + tag);
				}
			});

			// Create a matcher for the tags
			const tags = matchTags.map(tag => escape(tag)).join('|');

			if(tags.length === 0) {
				window.showErrorMessage("At least one tag must be defined");
				return;
			}

			// Construct a list of separators [ +|: +| +- +]
			const separators = config.tags.separators.map((s: string) => {
				return escape(s).replace(/ /g, ' +');
			}).join('|');

			if(separators.length === 0) {
				window.showErrorMessage("At least one separator must be defined");
				return;
			}

			// ANCHOR: Tag RegEx
			this.matcher = new RegExp(`[^\\w](${tags})((${separators})(.*))?$`, config.tags.matchCase ? "gm" : "img");

			AnchorEngine.output("Using matcher " + this.matcher);

			// Scan in all workspace files
			if(config.workspace.enabled && !config.workspace.lazyLoad) {
				setTimeout(() => {
					this.initiateWorkspaceScan();
				}, 500);
			} else {
				this.anchorsLoaded = true;

				if(this._editor) {
					this.addMap(this._editor!.document.uri);
				}
				
				this.refresh();
			}

			// Dispose the existing file watcher
			if(this._watcher) {
				this._watcher.dispose();
			}

			// Create a new file watcher
			if(config.workspace.enabled) {
				this._watcher = workspace.createFileSystemWatcher(config.workspace.matchFiles, true, true, false);

				this._watcher.onDidDelete((file: Uri) => {
					this.anchorMaps.forEach((_, uri) => {
						if(uri.toString() == file.toString()) {
							this.removeMap(uri);
							return false;
						}
					});
				});
			}

			// Register editor providers
			this.registerProviders();
		} catch(err) {
			AnchorEngine.output("Failed to build resources: " + err.message);
			AnchorEngine.output(err);
		}
	}

	public initiateWorkspaceScan() {
		const config = this._config!;
		this.anchorsScanned = true;
		this.anchorsLoaded = false;

		// Find all files located in this workspace
		workspace.findFiles(config.workspace.matchFiles, config.workspace.excludeFiles).then(uris => {

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
				window.showErrorMessage("Comment Anchors failed to load: " + err);
				AnchorEngine.output(err);
			});
		});

		// Update workspace tree
		this._onDidChangeTreeData.fire();
	}

	private async loadWorkspace(uris: Uri[]) {
		const maxFiles = this._config!.workspace.maxFiles || 100;
		let parseStatus = window.createStatusBarItem(StatusBarAlignment.Left, 0);
		let parseCount: number = 0;
		let parsePercentage: number = 0;
		
		parseStatus.tooltip = "Provided by the Comment Anchors extension";
		parseStatus.text = `$(telescope) Initializing...`;
		parseStatus.show();

		for(let i = 0; i < uris.length && parseCount < maxFiles; i++) {

			// Await a timeout for every 10 documents parsed. This allows
			// all files to be slowly parsed without completely blocking
			// the main thread for the entire process.
			if(i % 10 == 0) {
				await asyncDelay(5);
			}

			try {
				let found = await this.addMap(uris[i]);

				// Only update states when a file containing anchors
				// was found and parsed.
				if(found) {
					parseCount++;
					parsePercentage = parseCount / uris.length * 100;

					parseStatus.text = `$(telescope) Parsing Comment Anchors... (${parsePercentage.toFixed(1)}%)`;
				}
			} catch(err) {
				// Ignore, already taken care of
			}
		};

		// Scanning has now completed
		parseStatus.text = `Comment Anchors loaded!`;

		setTimeout(() => {
			parseStatus.dispose();
		}, 3000);
	}

	/**
	 * Returns the anchors in the current document
	 */
	public get currentAnchors(): EntryAnchor[] {
		if(!this._editor) return [];

		const uri = this._editor.document.uri;

		if(this.anchorMaps.has(uri)) {
			return this.anchorMaps.get(uri)!!.anchorTree;
		} else {
			return [];
		}
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
	public cleanUp(document: TextDocument) {
		if(document.uri.scheme != 'file') return;

		const ws = workspace.getWorkspaceFolder(document.uri);
		if(this._config!.workspace.enabled && ws && this.anchorsScanned) return;

		this.removeMap(document.uri);
	}

	/**
	 * Parse the given or current document
	 * 
	 * @returns true when anchors were found
	 */	
	public parse(document: Uri) : Promise<boolean> {
		return new Promise(async (success, reject) => {
			let anchorsFound = false;

			try {
				let text = null;

				workspace.textDocuments.forEach(td => {
					if(td.uri == document) {
						text = td.getText();
						return false;
					}
				});
				
				if(text == null) {
					text = await this.readDocument(document);
				}

				let currRegions: EntryAnchorRegion[] = [];
				let anchors: EntryAnchor[] = [];
				let folds: FoldingRange[] = [];
				let match;
				
				const config = this._config!!;
				const endTag = config.tags.endTag;

				// Find all anchor occurences
				while (match = this.matcher!.exec(text)) {
					const tagName = match[1].toUpperCase().replace(endTag, '');
					const tag : TagEntry = this.tags.get(tagName)!;
					const isRegionStart = tag.isRegion;
					const isRegionEnd = match[1].startsWith(endTag);
					const currRegion: EntryAnchorRegion|null = currRegions.length ? currRegions[currRegions.length - 1] : null;

					// Offset empty prefix
					// if(!match[1].length) {
					// 	match.index--;
					// }

					// We have found at least one anchor
					anchorsFound = true;

					// Handle the closing of a region
					if(isRegionEnd) {
						if(!currRegion) continue;

						const deltaText = text.substr(0, match.index + 1);
						const lineNumber = deltaText.split(/\r\n|\r|\n/g).length;

						currRegion.setEndTag({
							startIndex: match.index + 1,
							endIndex: match.index + 1 + match[1].length,
							lineNumber: lineNumber
						})

						currRegions.pop();

						folds.push(new FoldingRange(currRegion.lineNumber - 1, lineNumber - 1, FoldingRangeKind.Comment))
						continue;
					}

					let rangeLength = tag.styleComment ? match[0].length - 1 
					: tag.tag.length;
					let startPos = match.index + 1;
					let endPos = startPos + rangeLength;
					let deltaText = text.substr(0, startPos);
					let lineNumber = deltaText.split(/\r\n|\r|\n/g).length;
					
					let comment = (match[4] || '').trim();
					let display = config.tags.displayInSidebar ? tag.tag + ": " + comment : comment;

					// Clean up the comment and adjust the endPos
					if(display.endsWith('-->')) {
						if(tag.styleComment) {
							let skip = [' ', '-', '>'];
							let end = display.length - 1;

							while(skip.indexOf(display[end]) >= 0) {
								endPos--;
								end--;
							}
						}

						display = display.substring(0, display.lastIndexOf('-->'));
					} else if(display.endsWith('*/')) {
						if(tag.styleComment) {
							let skip = [' ', '*', '/'];
							let end = display.length - 1;

							while(skip.indexOf(display[end]) >= 0) {
								endPos--;
								end--;
							}
						}

						display = display.substring(0, display.lastIndexOf('*/'));
					}

					let anchor : EntryAnchor;

					// Create a regular or region anchor
					if(isRegionStart) {
						anchor = new EntryAnchorRegion(
							tag.tag,
							display,
							startPos,
							endPos,
							lineNumber,
							tag.iconColor || "default",
							tag.scope!,
							document
						);
					} else {
						anchor = new EntryAnchor(
							tag.tag,
							display,
							startPos,
							endPos,
							lineNumber,
							tag.iconColor || "default",
							tag.scope!,
							config.tags.displayLineNumber,
							document
						);
					}
				
					// Push this region onto the stack
					if(isRegionStart) {
						currRegions.push(anchor as EntryAnchorRegion);
					}

					// Place this anchor on root or child level
					if(currRegion) {
						currRegion.addChild(anchor);
					} else {
						anchors.push(anchor);
					}

				}

				this.matcher!.lastIndex = 0;
				this.anchorMaps.set(document, new AnchorIndex(anchors));

				// this.foldMaps.set(document, folds);
			} catch(err) {
				AnchorEngine.output("Error: " + err.message);
				AnchorEngine.output(err.stack);
				reject(err);
			} finally {
				success(anchorsFound);
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
			const index =  this.anchorMaps.get(doc);
			const tags = new Map<string, [TextEditorDecorationType, DecorationOptions[]]>();
			
			// Create a mapping between tags and decorators
			this.anchorDecorators.forEach((decorator: TextEditorDecorationType, tag: string) => {
				tags.set(tag.toUpperCase(), [decorator, []]);
			});

			// Create a function to handle decorating
			const applyDecorators = (anchors: EntryAnchor[]) => {
				anchors.forEach(anchor => {
					anchor.decorateDocument(document, tags.get(anchor.anchorTag.toUpperCase())![1]);

					if(anchor.children) {
						applyDecorators(anchor.children);
					}
				});
			}
			
			// Start by decorating the root list
			if(index) {
				applyDecorators(index.anchorTree);
			}

			// Apply all decorators to the document
			tags.forEach((decorator) => {
				this._editor!.setDecorations(decorator[0], decorator[1]);
			});

			// Cache the previous expanded items
			const previousExpandedFileTreeViewItems = this.expandedFileTreeViewItems;
			const previousExpandedWorkspaceTreeViewItems = this.expandedWorkspaceTreeViewItems;

			// Reset the expansion arrays
			this.expandedFileTreeViewItems = [];
			this.expandedWorkspaceTreeViewItems = [];

			// Update the file trees
			this._onDidChangeTreeData.fire();

			// Re-open the previous expanded items

			// FIXME this code should work as expected, except it doesn't thanks to code's janky API.
			// The goal is to loop though our EntryAnchor instances and find all of those that have
			// contents matching a previously expanded entry. We use #reveal() to alert code to expand
			// the entries, however it results in nothing, even when a timeout is applied.

			// this.anchorMaps.forEach((index) => {
			// 	index.textIndex.forEach((anchor, text) => {
			// 		if(previousExpandedFileTreeViewItems.includes(text)) {
			// 			AnchorEngine.output("REVEALING IN FILE TREE " + anchor);

			// 			this.fileTreeView.reveal(anchor, {
			// 				select: true,
			// 				focus: true,
			// 				expand: true
			// 			});
			// 		}

			// 		if(previousExpandedWorkspaceTreeViewItems.includes(text)) {
			// 			AnchorEngine.output("REVEALING IN WORKSPACE TREE");

			// 			this.workspaceTreeView.reveal(anchor, {
			// 				select: true,
			// 				focus: true,
			// 				expand: true
			// 			});
			// 		}
			// 	});
			// });
		} else {
			this.expandedFileTreeViewItems = [];
			this.expandedWorkspaceTreeViewItems = [];

			// Update the file trees
			this._onDidChangeTreeData.fire();
		}
	}
	

	/**
	 * Add a TextDocument mapping to the engine
	 * 
	 * @param document TextDocument
	 */
	public addMap(document: Uri) : Thenable<boolean> {
		if(document.scheme !== 'file') {
			return Promise.resolve(false);
		}

		// Make sure we have no duplicates
		this.anchorMaps.forEach((_, doc) => {
			if(doc.path == document.path) {
				this.anchorMaps.delete(doc);
				return false;
			}
		});

		this.anchorMaps.set(document, AnchorIndex.EMPTY);

		return this.parse(document);
	}

	/**
	 * Remove a TextDocument mapping from the engine
	 * 
	 * @param editor textDocument
	 */
	public removeMap(document: Uri) {
		if(document.scheme !== 'file') return;

		this.anchorMaps.delete(document);
	}

	/**
	 * Open a new webview panel listing out all configured
	 * tags including their applied styles.
	 */
	public openTagListPanel() {
		const panel = window.createWebviewPanel('anchorList', "Comment Anchors Tags", {
			viewColumn: ViewColumn.One
		});

		panel.webview.html = createViewContent(this, panel.webview);
		panel.webview.cspSource
	}

	private onActiveEditorChanged(editor: TextEditor | undefined): void {
		if(editor && editor!!.document.uri.scheme == 'output') return;

		this._editor = editor;

		if(!this.anchorsLoaded) return;

		if(editor && !this.anchorMaps.has(editor.document.uri)) {

			// Bugfix - Replace duplicates
			new Map<Uri, AnchorIndex>(this.anchorMaps).forEach((_, document) => {
				if(document.path.toString() == editor.document.uri.path.toString()) {
					this.anchorMaps.delete(document);
					return false;
				}
			});

			this.anchorMaps.set(editor.document.uri, AnchorIndex.EMPTY);

			this.parse(editor.document.uri).then(() => {
				this.refresh();
			});
		} else {
			this.refresh();
		}
	}

	private onDocumentChanged(e: TextDocumentChangeEvent): void {
		if(!e.contentChanges || e.document.uri.scheme == 'output') return;

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
	enabled?: boolean;
	iconColor?: string;
	highlightColor:string;
	backgroundColor?: string;
	styleComment?: boolean;
	borderStyle?: string;
	borderRadius?: number;
	isBold?: boolean;
	isItalic?: boolean;
	scope?: string,
	isRegion?: boolean;
}