import {
    TreeDataProvider,
    Event,
    TreeItem,
    workspace,
    CompletionItemProvider,
    TextDocument,
    Position,
    CancellationToken,
    CompletionContext,
    CompletionItem,
    CompletionList,
    CompletionItemKind,
} from "vscode";

import EntryAnchor from "../anchor/entryAnchor";
import { AnchorEngine, AnyEntry, AnyEntryArray } from "../anchorEngine";
import EntryEpic from "../anchor/entryEpic";
import { flattenAnchors } from "../util/flattener";

/**
 * AnchorProvider implementation in charge of returning the anchors in the current workspace
 */
export class EpicAnchorProvider implements TreeDataProvider<AnyEntry> {
	
    public readonly provider: AnchorEngine;
    public readonly onDidChangeTreeData: Event<undefined>;

    public constructor(provider: AnchorEngine) {
        this.onDidChangeTreeData = provider._onDidChangeTreeData.event;
        this.provider = provider;
    }

    public getTreeItem(element: AnyEntry): TreeItem {
        return element;
    }

    public getChildren(element?: AnyEntry): Thenable<AnyEntryArray> {
        return new Promise((success) => {
            // The default is empty, so you have to build a tree
            if (element) {
                if (element instanceof EntryAnchor && element.children) {
                    success(element.children);
                    return;
                } else if (element instanceof EntryEpic) {
                    const res: EntryAnchor[] = [];

                    const epic = element as EntryEpic;
                    AnchorEngine.output(
                        `this.provider._config!.tags.displayHierarchyInWorkspace: ${
                            this.provider._config!.tags.displayHierarchyInWorkspace
                        }`
                    );

                    if (this.provider._config!.tags.displayHierarchyInWorkspace) {
                        for (const anchor of epic.anchors) {
                            if (anchor.isVisibleInWorkspace) {
                                res.push(anchor.copy(true, false));
                            }
                        }
                    } else {
                        const flattened = flattenAnchors(epic.anchors);
                        
                        for (const anchor of flattened) {
                            if (anchor.isVisibleInWorkspace) {
                                res.push(anchor.copy(false, false));
                            }
                        }
                    }

                    const anchors = res.sort((left, right) => {
                        return left.attributes.seq - right.attributes.seq;
                    });

                    success(anchors);
                } else {
                    AnchorEngine.output("return empty array");
                    success([]);
                }

                return;
            }

            if (!this.provider._config!.workspace.enabled) {
                success([this.provider.errorWorkspaceDisabled]);
                return;
            } else if (!workspace.workspaceFolders) {
                success([this.provider.errorFileOnly]);
                return;
            } else if (this.provider._config!.workspace.lazyLoad && !this.provider.anchorsScanned) {
                success([this.provider.statusScan]);
            } else if (!this.provider.anchorsLoaded) {
                success([this.provider.statusLoading]);
                return;
            }

            const res: EntryEpic[] = [];
            const epicMaps = new Map<string, EntryAnchor[]>();

            // Build the epic entries
            for (const [_, anchorIndex] of this.provider.anchorMaps.entries()) {
                const flattened = flattenAnchors(anchorIndex.anchorTree);

                for (const anchor of flattened) {
                    const epic = anchor.attributes.epic;
                    if (!epic) continue;

                    const anchorEpic = epicMaps.get(epic);

                    if (anchorEpic) {
                        anchorEpic.push(anchor);
                    } else {
                        epicMaps.set(epic, [anchor]);
                    }
                }
            }

            // Sort and build the entry list
            for (const [epic, anchorArr] of epicMaps.entries()) {
                anchorArr.sort((left, right) => {
                    return left.attributes.seq - right.attributes.seq;
                });

                res.push(new EntryEpic(epic, `${epic}`, anchorArr, this.provider));
            }

            if (res.length === 0) {
                success([this.provider.errorEmptyEpics]);
                return;
            }

            success(res);
        });
    }
}

export class EpicAnchorIntelliSenseProvider implements CompletionItemProvider {
    public readonly engine: AnchorEngine;

    public constructor(engine: AnchorEngine) {
        this.engine = engine;
    }

    public provideCompletionItems(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
        _context: CompletionContext
    ): CompletionItem[] | CompletionList {
        const config = this.engine._config!;

        AnchorEngine.output("provideCompletionItems");

        const keyWord = _document.getText(_document.getWordRangeAtPosition(_position.translate(0, -1)));
        const hasKeyWord = [...this.engine.tags.keys()].find((v) => v === keyWord);

        if (hasKeyWord) {
            const epicCtr = new Map<string, number>();

            for (const [_, anchorIndex] of this.engine.anchorMaps.entries()) {
                for (const entryAnchor of anchorIndex.anchorTree) {
                    const { seq, epic } = entryAnchor.attributes;

                    if (epic) {
                        epicCtr.set(epic, Math.max(epicCtr.get(epic) || 0, seq));
                    }
                }
            }

            return [...epicCtr].map(
                ([epic, maxSeq]) => new CompletionItem(`epic=${epic},seq=${maxSeq + config.epic.seqStep}`, CompletionItemKind.Enum)
            );
        }
        return [];
    }
}
