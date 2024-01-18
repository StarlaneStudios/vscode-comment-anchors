import * as debounce from "debounce";
import * as escape from "escape-string-regexp";
import * as fs from "node:fs";
import * as path from "node:path";

import {
    DecorationOptions,
    DecorationRenderOptions,
    Disposable,
    EventEmitter,
    ExtensionContext,
    FileSystemWatcher,
    FoldingRange,
    FoldingRangeKind,
    OverviewRulerLane,
    StatusBarAlignment,
    TextDocument,
    TextDocumentChangeEvent,
    TextEditor,
    TextEditorDecorationType,
    TreeView,
    Uri,
    ViewColumn,
    WorkspaceConfiguration,
    commands,
    languages,
    window,
    workspace,
    Selection,
} from "vscode";

import * as minimatch from 'minimatch';
import { AnchorIndex } from "./anchorIndex";
import EntryAnchor from "./anchor/entryAnchor";
import EntryAnchorRegion from "./anchor/entryAnchorRegion";
import EntryBase from "./anchor/entryBase";
import EntryCursor from "./anchor/entryCursor";
import EntryError from "./anchor/entryError";
import EntryLoading from "./anchor/entryLoading";
import EntryScan from "./anchor/entryScan";
import { LinkProvider } from "./util/linkProvider";
import { FileAnchorProvider } from "./provider/fileAnchorProvider";
import { EpicAnchorIntelliSenseProvider, EpicAnchorProvider } from "./provider/epicAnchorProvider";
import { WorkspaceAnchorProvider } from "./provider/workspaceAnchorProvider";
import { asyncDelay } from "./util/asyncDelay";
import { createViewContent } from "./anchorListView";
import { flattenAnchors } from "./util/flattener";
import { registerDefaults } from "./util/defaultTags";
import { setupCompletionProvider } from "./util/completionProvider";
import { parseCustomAnchors } from "./util/customTags";

/* -- Constants -- */

const HEX_COLOR_REGEX = /^#([\da-f]{3}){1,2}$/i;
const COLOR_PLACEHOLDER_REGEX = /%COLOR%/g;

/* -- Anchor entry type aliases -- */

export type FileEntry = EntryAnchor | EntryError | EntryLoading | EntryCursor;
export type FileEntryArray = EntryAnchor[] | EntryError[] | EntryLoading[] | EntryCursor[];

export type AnyEntry = EntryBase;
export type AnyEntryArray = EntryBase[];

const MATCHER_TAG_INDEX = 1;
const MATCHER_ATTR_INDEX = 2;
const MATCHER_COMMENT_INDEX = 3;

/**
 * The main anchor parsing and caching engine
 */
export class AnchorEngine {

    /** The context of Comment Anchors */
    public context: ExtensionContext;

    /** Then event emitter in charge of refreshing the file trees */
    public _onDidChangeTreeData: EventEmitter<undefined> = new EventEmitter<undefined>();

    /** Then event emitter in charge of refreshing the document link */
    public _onDidChangeLinkData: EventEmitter<undefined> = new EventEmitter<undefined>();

    /** Debounced function for performance improvements */
    private _idleRefresh: (() => void) | undefined;

    /** The RegEx used for matching */
    public matcher: RegExp | undefined;

    /** A cache holding all documents */
    public anchorMaps: Map<Uri, AnchorIndex> = new Map();

    /** The decorators used for decorating the anchors */
    public anchorDecorators: Map<string, TextEditorDecorationType> = new Map();

    /** The decorators used for decorating the region end anchors */
    public anchorEndDecorators: Map<string, TextEditorDecorationType> = new Map();

    /** The list of tags and their settings */
    public tags: Map<string, TagEntry> = new Map();

    /** Returns true when all anchors have been loaded */
    public anchorsLoaded = false;

    /** Holds whether a scan has been performed since rebuild */
    public anchorsScanned = false;

    /** Holds whether anchors may be outdated */
    public anchorsDirty = true;

    /** The tree view used for displaying file anchors */
    public fileTreeView: TreeView<EntryBase>;

    /** The tree view used for displaying workspace anchors */
    public workspaceTreeView: TreeView<AnyEntry>;

    /** The epic view used for displaying workspace anchors */
    public epicTreeView: TreeView<AnyEntry>;

    /** The resource for the link provider */
    public linkProvider: LinkProvider;

    /** The currently expanded file tree items */
    public expandedFileTreeViewItems: string[] = [];

    /** The currently expanded workspace tree items  */
    public expandedWorkspaceTreeViewItems: string[] = [];

    /** The icon cache directory */
    public iconCache = "";

    /** The current editor */
    public _editor: TextEditor | undefined;

    /** Anchor comments config settings */
    public _config: WorkspaceConfiguration | undefined;

    /** The current file system watcher */
    private _watcher: FileSystemWatcher | undefined;

    /** List of build subscriptions */
    private _subscriptions: Disposable[] = [];
    private linkDisposable!: Disposable;

    /** The debug output for comment anchors */
    public static output: (msg: string) => void;

    // Possible error entries //
    public errorUnusableItem: EntryError = new EntryError(this, "Waiting for open editor...");
    public errorEmptyItem: EntryError = new EntryError(this, "No comment anchors detected");
    public errorEmptyWorkspace: EntryError = new EntryError(this, "No comment anchors in workspace");
    public errorEmptyEpics: EntryError = new EntryError(this, "No epics found in workspace");
    public errorWorkspaceDisabled: EntryError = new EntryError(this, "Workspace disabled");
    public errorFileOnly: EntryError = new EntryError(this, "No open workspaces");
    public statusLoading: EntryLoading = new EntryLoading(this);
    public statusScan: EntryScan = new EntryScan(this);

    private cursorTask?: NodeJS.Timer;

    public constructor(context: ExtensionContext) {
        this.context = context;

        window.onDidChangeActiveTextEditor((e) => this.onActiveEditorChanged(e), this, context.subscriptions);
        workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e), this, context.subscriptions);
        workspace.onDidChangeConfiguration(() => this.buildResources(), this, context.subscriptions);
        workspace.onDidChangeWorkspaceFolders(() => this.buildResources(), this, context.subscriptions);
        workspace.onDidCloseTextDocument((e) => this.cleanUp(e), this, context.subscriptions);

        const outputChannel = window.createOutputChannel("Comment Anchors");

        AnchorEngine.output = (m: string) => outputChannel.appendLine("[Comment Anchors] " + m);

        if (window.activeTextEditor) {
            this._editor = window.activeTextEditor;
        }

        // Create the file anchor view
        this.fileTreeView = window.createTreeView("fileAnchors", {
            treeDataProvider: new FileAnchorProvider(this),
            showCollapseAll: true,
        });

        this.fileTreeView.onDidExpandElement((e) => {
            if (e.element instanceof EntryAnchor) {
                this.expandedFileTreeViewItems.push(e.element.anchorText);
            }
        });

        this.fileTreeView.onDidCollapseElement((e) => {
            if (e.element instanceof EntryAnchor) {
                const idx = this.expandedFileTreeViewItems.indexOf(e.element.anchorText);
                this.expandedFileTreeViewItems.splice(idx, 1);
            }
        });

        // Create the workspace anchor view
        this.workspaceTreeView = window.createTreeView("workspaceAnchors", {
            treeDataProvider: new WorkspaceAnchorProvider(this),
            showCollapseAll: true,
        });

        this.workspaceTreeView.onDidExpandElement((e) => {
            if (e.element instanceof EntryAnchor) {
                this.expandedWorkspaceTreeViewItems.push(e.element.anchorText);
            }
        });

        this.workspaceTreeView.onDidCollapseElement((e) => {
            if (e.element instanceof EntryAnchor) {
                const idx = this.expandedWorkspaceTreeViewItems.indexOf(e.element.anchorText);
                this.expandedWorkspaceTreeViewItems.splice(idx, 1);
            }
        });

        // Create the workspace anchor view
        this.epicTreeView = window.createTreeView("epicAnchors", {
            treeDataProvider: new EpicAnchorProvider(this),
            showCollapseAll: true,
        });

        // Setup the link provider
        const provider = new LinkProvider(this);

        this.linkDisposable = languages.registerDocumentLinkProvider({ language: "*" }, provider);
        this.linkProvider = provider;

        // Build required anchor resources
        this.buildResources();
    }

    public registerProviders(): void {
        const config = this._config!;

        // Provide auto completion
        if (config.tags.provideAutoCompletion) {
            this._subscriptions.push(setupCompletionProvider(this));
        }

        // Provide epic auto complete
        if (config.epic.provideAutoCompletion) {
            this._subscriptions.push(
                languages.registerCompletionItemProvider({ language: "*" }, new EpicAnchorIntelliSenseProvider(this), "[")
            );
        }
    }

    public buildResources(): void {
        try {
            this.anchorsScanned = false;

            const config = (this._config = workspace.getConfiguration("commentAnchors"));

            // Construct the debounce
            this._idleRefresh = debounce(() => {
                if (this._editor)
                    this.parse(this._editor!.document.uri).then(() => {
                        this.refresh();
                    });
            }, config.parseDelay);

            // Disable previous build resources
            for (const s of this._subscriptions) s.dispose();
            this._subscriptions = [];

            // Store the sorting method
            if (config.tags.sortMethod && (config.tags.sortMethod == "line" || config.tags.sortMethod == "type")) {
                EntryAnchor.SortMethod = config.tags.sortMethod;
            }

            // Store the scroll position
            if (config.scrollPosition) {
                EntryAnchor.ScrollPosition = config.scrollPosition;
            }

            // Prepare icon cache
            const storage = this.context.globalStoragePath;
            const iconCache = path.join(storage, "icons");
            const baseAnchorSrc = path.join(__dirname, "../res/anchor.svg");
            const baseAnchorEndSrc = path.join(__dirname, "../res/anchor_end.svg");
            const baseAnchor = fs.readFileSync(baseAnchorSrc, "utf8");
            const baseAnchorEnd = fs.readFileSync(baseAnchorEndSrc, "utf8");
            const iconColors: string[] = [];
            const regionColors: string[] = [];

            if (!fs.existsSync(storage)) fs.mkdirSync(storage);
            if (!fs.existsSync(iconCache)) fs.mkdirSync(iconCache);

            this.iconCache = iconCache;

            // Clear icon cache
            for (const file of fs.readdirSync(iconCache)) {
                fs.unlinkSync(path.join(iconCache, file));
            }

            // Create a map holding the tags
            this.tags.clear();

            for (const type of this.anchorDecorators.values()) {
                type.dispose();
            }

            for (const type of this.anchorEndDecorators.values()) {
                type.dispose();
            }

            this.anchorDecorators.clear();
            this.anchorEndDecorators.clear();

            // Register default tags
            registerDefaults(this.tags);

            // Add custom tags
            parseCustomAnchors(config, this.tags);

            // Detect the lane style
            let laneStyle: OverviewRulerLane;

            if (config.tags.rulerStyle == "left") {
                laneStyle = OverviewRulerLane.Left;
            } else if (config.tags.rulerStyle == "right") {
                laneStyle = OverviewRulerLane.Right;
            } else if (config.tags.rulerStyle == "center") {
                laneStyle = OverviewRulerLane.Center;
            } else {
                laneStyle = OverviewRulerLane.Full;
            }

            // Start the cursor tracker
            if (this.cursorTask) {
                clearInterval(this.cursorTask);
            }

            let prevLine = 0;

            if (config.showCursor) {
                this.cursorTask = setInterval(() => {
                    const cursor = window.activeTextEditor?.selection?.active?.line;

                    if (cursor !== undefined && prevLine != cursor) {
                        AnchorEngine.output("Updating cursor position");
                        this.updateFileAnchors();
                        prevLine = cursor;
                    }
                }, 100);
            }

            // Configure all tags
            for (const tag of this.tags.values()) {
                if (!tag.scope) {
                    tag.scope = "workspace";
                }

                if (config.tagHighlights.enabled) {

                    // Create base configuration
                    const highlight: DecorationRenderOptions = {
                        fontWeight: tag.isBold || tag.isBold == undefined ? "bold" : "normal",
                        fontStyle: tag.isItalic || tag.isItalic == undefined ? "italic" : "normal",
                        color: tag.highlightColor,
                        backgroundColor: tag.backgroundColor,
                        border: tag.borderStyle,
                        borderRadius: tag.borderRadius ? tag.borderRadius + "px" : undefined,
                        textDecoration: tag.textDecorationStyle,
                    };

                    // Optionally insert rulers
                    if (config.tags.displayInRuler && tag.ruler != false) {
                        highlight.overviewRulerColor = tag.highlightColor || '#828282';
                        highlight.overviewRulerLane = laneStyle;
                    }

                    // Save the icon color
                    let iconColor = tag.iconColor || tag.highlightColor || 'default';
                    let skipColor = false;

                    switch (iconColor) {
                        case "blue": {
                            iconColor = "#3ea8ff";
                            break;
                        }
                        case "blurple": {
                            iconColor = "#7d5afc";
                            break;
                        }
                        case "red": {
                            iconColor = "#f44336";
                            break;
                        }
                        case "purple": {
                            iconColor = "#ba68c8";
                            break;
                        }
                        case "teal": {
                            iconColor = "#00cec9";
                            break;
                        }
                        case "orange": {
                            iconColor = "#ffa100";
                            break;
                        }
                        case "green": {
                            iconColor = "#64dd17";
                            break;
                        }
                        case "pink": {
                            iconColor = "#e84393";
                            break;
                        }
                        case "emerald": {
                            iconColor = "#2ecc71";
                            break;
                        }
                        case "yellow": {
                            iconColor = "#f4d13d";
                            break;
                        }
                        case "default":
                        case "auto": {
                            skipColor = true;
                            break;
                        }
                        default: {
                            if (!HEX_COLOR_REGEX.test(iconColor)) {
                                skipColor = true;
                                window.showErrorMessage("Invalid color: " + iconColor);
                            }
                        }
                    }

                    if (skipColor) {
                        tag.iconColor = "auto";
                    } else {
                        iconColor = iconColor.slice(1);

                        if (!iconColors.includes(iconColor)) {
                            iconColors.push(iconColor);
                        }

                        if (tag.behavior == "region" && !regionColors.includes(iconColor)) {
                            regionColors.push(iconColor);
                        }

                        tag.iconColor = iconColor.toLowerCase();
                    }

                    // Optional gutter icons
                    if (config.tags.displayInGutter) {
                        if (tag.iconColor == "auto") {
                            highlight.dark = {
                                gutterIconPath: path.join(__dirname, "..", "res", "anchor_white.svg"),
                            };

                            highlight.light = {
                                gutterIconPath: path.join(__dirname, "..", "res", "anchor_black.svg"),
                            };
                        } else {
                            highlight.gutterIconPath = path.join(iconCache, "anchor_" + tag.iconColor + ".svg");
                        }
                    }

                    // Create the decoration type
                    this.anchorDecorators.set(tag.tag, window.createTextEditorDecorationType(highlight));

                    if (tag.behavior == "region") {
                        const endHighlight = { ...highlight };

                        // Optional gutter icons
                        if (config.tags.displayInGutter) {
                            if (tag.iconColor == "auto") {
                                endHighlight.dark = {
                                    gutterIconPath: path.join(__dirname, "..", "res", "anchor_end_white.svg"),
                                };

                                endHighlight.light = {
                                    gutterIconPath: path.join(__dirname, "..", "res", "anchor_end_black.svg"),
                                };
                            } else {
                                endHighlight.gutterIconPath = path.join(iconCache, "anchor_end_" + tag.iconColor + ".svg");
                            }
                        }

                        // Create the ending decoration type
                        this.anchorEndDecorators.set(tag.tag, window.createTextEditorDecorationType(endHighlight));
                    }
                }
            }

            // Fetch an array of tags
            const tagList = [...this.tags.keys()];

            // Generate region end tags
            const endTag = this._config.tags.endTag;

            for (const [tag, entry] of this.tags.entries()) {
                if (entry.behavior == "region") {
                    tagList.push(endTag + tag);
                }
            }

            // Create a selection of tags
            const tags = tagList
                .map((tag) => escape(tag))
                .sort((left, right) => right.length - left.length)
                .join("|");

            if (tags.length === 0) {
                window.showErrorMessage("At least one tag must be defined");
                return;
            }

            // Create a selection of separators
            const separators = (config.tags.separators as string[])
                .map((seperator) => escape(seperator).replaceAll(' ', " +"))
                .sort((left, right) => right.length - left.length)
                .join("|");

            if (separators.length === 0) {
                window.showErrorMessage("At least one separator must be defined");
                return;
            }

            // Create a selection of prefixes
            const prefixes = (config.tags.matchPrefix as string[])
                .map((match) => escape(match).replaceAll(' ', " +"))
                .sort((left, right) => right.length - left.length)
                .join("|");

            if (prefixes.length === 0) {
                window.showErrorMessage("At least one match prefix must be defined");
                return;
            }

            // ANCHOR: Regex for matching tags
            // group 1 - Anchor tag
            // group 2 - Attributes
            // group 3 - Text

            const regex = `(?:${prefixes})(?:\\x20{0,4}|\\t{0,1})(${tags})(\\[.*\\])?(?:(?:${separators})(.*))?$`;
            const flags = config.tags.matchCase ? "gm" : "img";

            this.matcher = new RegExp(regex, flags);

            AnchorEngine.output("Using matcher " + this.matcher);

            // Write anchor icons
            for (const color of iconColors) {
                const filename = "anchor_" + color.toLowerCase() + ".svg";
                const anchorSvg = baseAnchor.replaceAll(COLOR_PLACEHOLDER_REGEX, "#" + color);

                fs.writeFileSync(path.join(iconCache, filename), anchorSvg);

                if (regionColors.includes(color)) {
                    const filenameEnd = "anchor_end_" + color.toLowerCase() + ".svg";
                    const anchorEndSvg = baseAnchorEnd.replaceAll(COLOR_PLACEHOLDER_REGEX, "#" + color);

                    fs.writeFileSync(path.join(iconCache, filenameEnd), anchorEndSvg);
                }
            }

            AnchorEngine.output("Generated icon cache at " + iconCache);

            // Scan in all workspace files
            if (config.workspace.enabled && !config.workspace.lazyLoad) {
                setTimeout(() => {
                    this.initiateWorkspaceScan();
                }, 500);
            } else {
                this.anchorsLoaded = true;

                if (this._editor) {
                    this.addMap(this._editor!.document.uri);
                }

                this.refresh();
            }

            // Dispose the existing file watcher
            if (this._watcher) {
                this._watcher.dispose();
            }

            // Create a new file watcher
            if (config.workspace.enabled) {
                this._watcher = workspace.createFileSystemWatcher(config.workspace.matchFiles, true, true, false);

                this._watcher.onDidDelete((file: Uri) => {
                    for (const [uri, _] of this.anchorMaps.entries()) {
                        if (uri.toString() == file.toString()) {
                            this.removeMap(uri);
                            false; continue;
                        }
                    }
                });
            }

            // Register editor providers
            this.registerProviders();
        } catch (err: any) {
            AnchorEngine.output("Failed to build resources: " + err.message);
            AnchorEngine.output(err);
        }
    }

    public initiateWorkspaceScan(): void {
        const config = this._config!;
        this.anchorsScanned = true;
        this.anchorsLoaded = false;

        // Find all files located in this workspace
        workspace.findFiles(config.workspace.matchFiles, config.workspace.excludeFiles).then((uris) => {
            // Clear all existing mappings
            this.anchorMaps.clear();

            // Resolve all matched URIs
            this.loadWorkspace(uris)
                .then(() => {
                    if (this._editor) {
                        this.addMap(this._editor!.document.uri);
                    }

                    this.anchorsLoaded = true;
                    this.refresh();
                })
                .catch((err) => {
                    window.showErrorMessage("Comment Anchors failed to load: " + err);
                    AnchorEngine.output(err);
                });
        });

        // Update workspace tree
        this.updateFileAnchors();
    }

    private async loadWorkspace(uris: Uri[]): Promise<void> {
        const maxFiles = this._config!.workspace.maxFiles;
        const parseStatus = window.createStatusBarItem(StatusBarAlignment.Left, 0);
        let parseCount = 0;
        let parsePercentage = 0;

        parseStatus.tooltip = "Provided by the Comment Anchors extension";
        parseStatus.text = `$(telescope) Initializing...`;
        parseStatus.show();

        for (let i = 0; i < uris.length && parseCount < maxFiles; i++) {
            // Await a timeout for every 10 documents parsed. This allows
            // all files to be slowly parsed without completely blocking
            // the main thread for the entire process.
            if (i % 10 == 0) {
                await asyncDelay(5);
            }

            try {
                const found = await this.addMap(uris[i]);

                // Only update states when a file containing anchors
                // was found and parsed.
                if (found) {
                    parseCount++;
                    parsePercentage = (parseCount / uris.length) * 100;

                    parseStatus.text = `$(telescope) Parsing Comment Anchors... (${parsePercentage.toFixed(1)}%)`;
                }
            } catch {
                // Ignore, already taken care of
            }
        }

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
        if (!this._editor) return [];

        const uri = this._editor.document.uri;

        if (this.anchorMaps.has(uri)) {
            return this.anchorMaps.get(uri)!.anchorTree;
        } else {
            return [];
        }
    }

    /**
     * Dispose anchor list resources
     */
    public dispose(): void {
        for (const type of this.anchorDecorators.values()) {
            type.dispose();
        }

        for (const type of this.anchorEndDecorators.values()) {
            type.dispose();
        }
        
        for (const subscription of this._subscriptions) {
            subscription.dispose();
        }

        this.linkDisposable.dispose();

        if (this.cursorTask) {
            clearInterval(this.cursorTask);
        }
    }

    /**
     * Clean up external files
     */
    public cleanUp(document: TextDocument): void {
        if (document.uri.scheme != "file") return;

        const ws = workspace.getWorkspaceFolder(document.uri);
        if (this._config!.workspace.enabled && ws && this.anchorsScanned) return;

        this.removeMap(document.uri);
    }

    /**
     * Travel to the specified anchor id
     *
     * @param The anchor id
     */
    public travelToAnchor(id: string): void {
        if (!this._editor) return;

        const anchors = this.currentAnchors;
        const flattened = flattenAnchors(anchors);

        for (const anchor of flattened) {
            if (anchor.attributes.id == id) {
                const targetLine = anchor.lineNumber - 1;

                commands.executeCommand("revealLine", {
                    lineNumber: targetLine,
                    at: EntryAnchor.ScrollPosition,
                });

                return;
            }
        }
    }

    /**
     * Parse the given raw attribute string into
     * individual attributes.
     *
     * @param raw The raw attribute string
     * @param defaultValue The default attributes
     */
    public parseAttributes(raw: string, defaultValue: TagAttributes): TagAttributes {
        if (!raw) return defaultValue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: TagAttributes = { ...defaultValue };
        const mapping = new Map<string, string>();

        // parse all 'key1=value1,key2=value2'
        for (const pair of raw.split(",")) {
            const [key, value] = pair.trim().split("=");
            AnchorEngine.output(`Trying to set key=${key},value=${value}`);
            mapping.set(key, value);
        }

        // Parse the epic value
        if (mapping.has("epic")) {
            result.epic = mapping.get("epic")!;
        }

        // Parse the sequence value
        if (mapping.has("seq")) {
            result.seq = Number.parseInt(mapping.get("seq")!, 10);
        }

        // Parse the id value
        if (mapping.has("id")) {
            result.id = mapping.get("id");
        }

        return result;
    }

    /**
     * Parse the given or current document
     *
     * @returns true when anchors were found
     */
    public async parse(document: Uri): Promise<boolean> {
        let anchorsFound = false;

        try {
            const config = this._config!;
            const endTag = config.tags.endTag;
            
            const {
                displayTagName,
                displayInSidebar,
                displayLineNumber,
                matchSuffix,
            } = config.tags;

            let text = null;

            // Match the document against the configured glob
            if(!minimatch(document.path, config.workspace.matchFiles)) {
                return false;
            }

            // Read text from open documents
            for (const td of workspace.textDocuments) {
                if (td.uri == document) {
                    text = td.getText();
                    false; continue;
                }
            }

            // Read the text from the file system
            if (text == null) {
                text = await this.readDocument(document);
            }

            const currRegions: EntryAnchorRegion[] = [];
            const anchors: EntryAnchor[] = [];
            const folds: FoldingRange[] = [];

            let match;

            // Find all anchor occurences
            while ((match = this.matcher!.exec(text))) {
                const tagMatch = match[MATCHER_TAG_INDEX];
                let tagName;
                let isRegionEnd;

                if (this.tags.has(tagMatch)) {
                    tagName = tagMatch;
                    isRegionEnd = false;
                } else {
                    if (!tagMatch.startsWith(endTag)) throw new TypeError("matched non-existent tag");
                    tagName = tagMatch.slice(endTag.length);
                    isRegionEnd = true;
                }

                const tagEntry: TagEntry = this.tags.get(tagName)!;
                const isRegionStart = tagEntry.behavior == "region";
                const currRegion: EntryAnchorRegion | null = (currRegions.length > 0 && currRegions.at(-1)) || null;
                const style = tagEntry.styleMode;

                // Compute positions and lengths
                const offsetPos = match[0].indexOf(tagMatch);
                const startPos = match.index + (style == 'full' ? 0 : offsetPos);
                const lineNumber = text.slice(0, Math.max(0, startPos)).split(/\r\n|\r|\n/g).length;
                const rangeLength = style == 'full'
                    ? match[0].length
                    : (style == 'comment'
                        ? match[0].length - offsetPos
                        : tagMatch.length);

                // We have found at least one anchor
                anchorsFound = true;

                let endPos = startPos + rangeLength;
                let comment = (match[MATCHER_COMMENT_INDEX] || "").trim();
                let display = "";

                const rawAttributeStr = match[MATCHER_ATTR_INDEX] || "[]";
                const attributes = this.parseAttributes(rawAttributeStr.slice(1, 1 + rawAttributeStr.length - 2), {
                    seq: lineNumber,
                });

                // Clean up the comment and adjust the endPos
                for (const endMatch of matchSuffix) {
                    if (comment.endsWith(endMatch)) {
                        comment = comment.slice(0, Math.max(0, comment.length - endMatch.length));

                        if (style == 'comment') {
                            endPos -= endMatch.length;
                        }

                        break;
                    }
                }

                // Handle the closing of a region
                if (isRegionEnd) {
                    if (!currRegion || currRegion.anchorTag != tagEntry.tag) continue;

                    currRegion.setEndTag({
                        startIndex: startPos,
                        endIndex: endPos,
                        lineNumber: lineNumber,
                    });

                    currRegions.pop();
                    folds.push(new FoldingRange(currRegion.lineNumber - 1, lineNumber - 1, FoldingRangeKind.Comment));
                    continue;
                }

                // Construct the resulting string to display
                if (comment.length === 0) {
                    display = tagEntry.tag;
                } else if (displayInSidebar && tagEntry.behavior != "link") {
                    display = displayTagName ? (tagEntry.tag + ": " + comment) : comment;
                } else {
                    display = comment;
                }

                // Remove epics when tag is not workspace visible
                if (tagEntry.scope != "workspace") {
                    attributes.epic = undefined;
                }

                let anchor: EntryAnchor;

                // Create a regular or region anchor
                if (isRegionStart) {
                    anchor = new EntryAnchorRegion(
                        this,
                        tagEntry.tag,
                        display,
                        startPos,
                        endPos,
                        match[0].length - 1,
                        lineNumber,
                        tagEntry.iconColor!,
                        tagEntry.scope!,
                        displayLineNumber,
                        document,
                        attributes
                    );
                } else {
                    anchor = new EntryAnchor(
                        this,
                        tagEntry.tag,
                        display,
                        startPos,
                        endPos,
                        match[0].length - 1,
                        lineNumber,
                        tagEntry.iconColor!,
                        tagEntry.scope!,
                        displayLineNumber,
                        document,
                        attributes
                    );
                }

                // Push this region onto the stack
                if (isRegionStart) {
                    currRegions.push(anchor as EntryAnchorRegion);
                }

                // Place this anchor on root or child level
                if (currRegion) {
                    currRegion.addChild(anchor);
                } else {
                    anchors.push(anchor);
                }
            }

            this.matcher!.lastIndex = 0;
            this.anchorMaps.set(document, new AnchorIndex(anchors));
        } catch (err: any) {
            AnchorEngine.output("Error: " + err.message);
            AnchorEngine.output(err.stack);
        }

        return anchorsFound;
    }

    /**
     * Returns the list of anchors parsed from the given
     * file.
     *
     * @param file The file URI
     * @returns The anchor array
     */
    public async getAnchors(file: Uri): Promise<EntryAnchor[]> {
        const cached = this.anchorMaps.get(file)?.anchorTree;

        if (cached) {
            return cached;
        } else {
            await this.parse(file);
            return await this.getAnchors(file);
        }
    }

    /**
     * Refresh the visual representation of the anchors
     */
    public refresh(): void {
        if (this._editor && this._config!.tagHighlights.enabled) {
            const document = this._editor!.document;
            const doc = document.uri;
            const index = this.anchorMaps.get(doc);
            const tags = new Map<string, [TextEditorDecorationType, DecorationOptions[]]>();
            const tagsEnd = new Map<string, [TextEditorDecorationType, DecorationOptions[]]>();

            // Create a mapping between tags and decorators
            for (const [tag, decorator] of this.anchorDecorators.entries()) {
                tags.set(tag, [decorator, []]);
            }

            for (const [tag, decorator] of this.anchorEndDecorators.entries()) {
                tagsEnd.set(tag, [decorator, []]);
            }

            // Create a function to handle decorating
            const applyDecorators = (anchors: EntryAnchor[]) => {
                for (const anchor of anchors) {
                    const deco = tags.get(anchor.anchorTag)![1];

                    anchor.decorateDocument(document, deco);

                    if (anchor instanceof EntryAnchorRegion) {
                        anchor.decorateDocumentEnd(document, tagsEnd.get(anchor.anchorTag)![1]);
                    }

                    if (anchor.children) {
                        applyDecorators(anchor.children);
                    }
                }
            };

            // Start by decorating the root list
            if (index) {
                applyDecorators(index.anchorTree);
            }

            // Apply all decorators to the document
            for (const decorator of Object.values(tags)) {
                this._editor!.setDecorations(decorator[0], decorator[1]);
            }

            for (const decorator of Object.values(tagsEnd)) {
                this._editor!.setDecorations(decorator[0], decorator[1]);
            }
        }

        // Reset the expansion arrays
        this.expandedFileTreeViewItems = [];
        this.expandedWorkspaceTreeViewItems = [];

        // Update the file trees
        this._onDidChangeLinkData.fire(undefined);
        this.updateFileAnchors();
        this.anchorsDirty = false;
    }

    /**
     * Add a TextDocument mapping to the engine
     *
     * @param document TextDocument
     */
    public addMap(document: Uri): Thenable<boolean> {
        if (document.scheme !== "file") {
            return Promise.resolve(false);
        }

        // Make sure we have no duplicates
        for (const [doc, _] of this.anchorMaps.entries()) {
            if (doc.path == document.path) {
                this.anchorMaps.delete(doc);
            }
        }

        this.anchorMaps.set(document, AnchorIndex.EMPTY);

        return this.parse(document);
    }

    /**
     * Remove a TextDocument mapping from the engine
     *
     * @param editor textDocument
     */
    public removeMap(document: Uri): void {
        if (document.scheme !== "file") return;

        this.anchorMaps.delete(document);
    }

    /**
     * Open a new webview panel listing out all configured
     * tags including their applied styles.
     */
    public openTagListPanel(): void {
        const panel = window.createWebviewPanel("anchorList", "Comment Anchors Tags", {
            viewColumn: ViewColumn.One,
        });

        panel.webview.html = createViewContent(this, panel.webview);
    }

    /**
     * Jump to an anchor in the current document
     * 
     * @param anchor The anchor to jump to
     */
    public jumpToAnchor(anchor: EntryAnchor) {
        const selection = new Selection(anchor.lineNumber - 1, 999, anchor.lineNumber - 1, 999);

        this._editor!.selection = selection;
        this._editor!.revealRange(selection);
    }

    /**
     * Move the cursor to the anchor relative to the current position
     * 
     * @param direction The direction
     */
    public jumpToRelativeAnchor(direction: 'up'|'down') {
        const current = this._editor!.selection.active.line + 1;
        const anchors = [...this.currentAnchors].sort((a, b) => a.lineNumber - b.lineNumber);

        if (direction == 'up') {
            for (let i = anchors.length - 1; i >= 0; i--) {
                const anchor = anchors[i];

                if (anchor.lineNumber < current) {
                    this.jumpToAnchor(anchor);
                    break;
                }
            }
        } else {
            for (const anchor of anchors) {
                if (anchor.lineNumber > current) {
                    this.jumpToAnchor(anchor);
                    break;
                }
            }
        }
    }

    private onActiveEditorChanged(editor: TextEditor | undefined): void {
        if (editor && editor!.document.uri.scheme == "output") return;

        this._editor = editor;

        if (!this.anchorsLoaded) return;

        if (editor && !this.anchorMaps.has(editor.document.uri)) {
            // Bugfix - Replace duplicates
            for (const [document, _] of new Map<Uri, AnchorIndex>(this.anchorMaps).entries()) {
                if (document.path.toString() == editor.document.uri.path.toString()) {
                    this.anchorMaps.delete(document);
                    false; continue;
                }
            }

            this.anchorMaps.set(editor.document.uri, AnchorIndex.EMPTY);

            this.parse(editor.document.uri).then(() => {
                this.refresh();
            });
        } else {
            this.refresh();
        }
    }

    private onDocumentChanged(e: TextDocumentChangeEvent): void {
        if (!e.contentChanges || e.document.uri.scheme == "output") return;

        this.anchorsDirty = true;
        this._idleRefresh!();
    }

    /**
     * Reads the document at the given Uri async
     *
     * @param path Document uri
     */
    private readDocument(path: Uri): Thenable<string> {
        return new Promise<string>((success, reject) => {
            fs.readFile(path.fsPath, "utf8", (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    success(data);
                }
            });
        });
    }

    /**
     * Alert subscribed listeners of a change in the file anchors tree
     */
    private updateFileAnchors() {
        this._onDidChangeTreeData.fire(undefined);

        const anchors = this.currentAnchors.length;

        AnchorEngine.output('ANCHORS =' + anchors);

        this.fileTreeView.badge = anchors > 0 ? {
            tooltip: 'File anchors',
            value: anchors
        } : undefined;
    }
}

/**
 * A tag entry in the settings
 */
export interface TagEntry {
    tag: string;
    enabled?: boolean;
    iconColor?: string;
    highlightColor?: string;
    backgroundColor?: string;
    styleMode?: 'tag' | 'comment' | 'full';
    borderStyle?: string;
    borderRadius?: number;
    ruler?: boolean;
    textDecorationStyle?: string;
    isBold?: boolean;
    isItalic?: boolean;
    scope?: string;
    isSequential?: boolean;
    isEpic?: boolean;
    behavior: "anchor" | "region" | "link";
}

/**
 * Defined for tag attribute
 * Currenly only "seq" and "epic" are used
 */
export interface TagAttributes {
    seq: number;
    epic?: string;
    id?: string;
}
