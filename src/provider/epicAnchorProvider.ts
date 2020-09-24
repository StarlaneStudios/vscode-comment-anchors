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

/**
 * AnchorProvider implementation in charge of returning the anchors in the current workspace
 */
export class EpicAnchorProvider implements TreeDataProvider<AnyEntry> {
  readonly provider: AnchorEngine;
  readonly onDidChangeTreeData: Event<undefined>;

  constructor(provider: AnchorEngine) {
    this.onDidChangeTreeData = provider._onDidChangeTreeData.event;
    this.provider = provider;
  }

  private generateLabel(i: number, e: EntryAnchor): string {
    return e.label!;
  }

  getTreeItem(element: AnyEntry): TreeItem {
    return element;
  }

  getChildren(element?: AnyEntry): Thenable<AnyEntryArray> {
    AnchorEngine.output(`epic elementType ${typeof element}`);

    return new Promise((success) => {
      // The default is empty, so you have to build a tree
      if (element) {
        if (element instanceof EntryAnchor && element.children) {
          success(
            element.children.map((v, i) => {
              v.label = this.generateLabel(i, v);
              return v;
            })
          );
          return;
        } else if (element instanceof EntryEpic) {
          // it is EntryEpic
          // let res: EntryAnchor[] = [];

          // const cachedFile = (element as EntryCachedFile);

          // if (this.provider._config!.tags.displayHierarchyInWorkspace) {
          //     cachedFile.anchors.forEach((anchor: EntryAnchor) => {
          //         if (!anchor.isVisibleInWorkspace) return;

          //         res.push(anchor.copy(true));
          //     });
          // } else {
          //     EpicAnchorProvider.flattenAnchors(cachedFile.anchors).forEach((anchor: EntryAnchor) => {
          //         if (!anchor.isVisibleInWorkspace) return;

          //         res.push(anchor.copy(false));
          //     });
          // }

          // success(EntryAnchor.sortAnchors(res));
          const res: EntryAnchor[] = [];

          const epic = element as EntryEpic;
          AnchorEngine.output(
            `this.provider._config!.tags.displayHierarchyInWorkspace: ${
              this.provider._config!.tags.displayHierarchyInWorkspace
            }`
          );

          if (this.provider._config!.tags.displayHierarchyInWorkspace) {
            epic.anchors.forEach((anchor: EntryAnchor) => {
              if (!anchor.isVisibleInWorkspace) return;

              res.push(anchor.copy(true, false));
            });
          } else {
            EpicAnchorProvider.flattenAnchors(epic.anchors).forEach(
              (anchor: EntryAnchor) => {
                if (!anchor.isVisibleInWorkspace) return;

                res.push(anchor.copy(false, false));
              }
            );
          }

          const anchors = res
            .sort((left, right) => {
              return left.attributes.seq - right.attributes.seq;
            })
            .map((v, i) => {
              v.label = this.generateLabel(i, v);
              return v;
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
      } else if (
        this.provider._config!.workspace.lazyLoad &&
        !this.provider.anchorsScanned
      ) {
        success([this.provider.statusScan]);
      } else if (!this.provider.anchorsLoaded) {
        success([this.provider.statusLoading]);
        return;
      }

      const res: EntryEpic[] = [];
      const epicMaps = new Map<string, EntryAnchor[]>();

      // Build the epic entries
      Array.from(this.provider.anchorMaps).forEach(
        ([, anchorIndex], _: number) => {
          anchorIndex.anchorTree.forEach((anchor) => {
            const epic = anchor.attributes.epic;
            if (!epic) return;

            const anchorEpic = epicMaps.get(epic);

            if (anchorEpic) {
              anchorEpic.push(anchor);
            } else {
              epicMaps.set(epic, [anchor]);
            }
          });
        }
      );

      // Sort and build the entry list
      epicMaps.forEach((anchorArr: EntryAnchor[], epic: string) => {
        anchorArr.sort((left, right) => {
          return left.attributes.seq - left.attributes.seq;
        });

        res.push(new EntryEpic(epic, `${epic}`, anchorArr, this.provider));
      });

      if (res.length == 0) {
        success([this.provider.errorEmptyEpics]);
        return;
      }

      AnchorEngine.output(
        `put res = ${res.map((r) => r.toString()).join(",")}`
      );

      success(res);

      // this.provider.anchorMaps.forEach((index: AnchorIndex, document: Uri) => {
      //     const anchors = index.anchorTree;

      //     if (anchors.length == 0) return; // Skip empty files

      //     let notVisible = true;

      //     anchors.forEach(anchor => {
      //         if (anchor.isVisibleInWorkspace) notVisible = false;
      //     });

      //     if (!notVisible) {
      //         try {
      //             res.push(new EntryEpic(this.provider, anchors));
      //         } catch (err) {
      //             // Simply ignore, we do not want to push this file
      //         }
      //     }
      // });

      // if (res.length == 0) {
      //     success([this.provider.errorEmptyWorkspace]);
      //     return;
      // }

      // success(res.sort((left, right) => {
      //     return left.label!.localeCompare(right.label!)
      // }));
    });
  }

  /**
   * Flattens hierarchical anchors into a single array
   *
   * @param anchors Array to flatten
   */
  static flattenAnchors(anchors: EntryAnchor[]): EntryAnchor[] {
    const list: EntryAnchor[] = [];

    function crawlList(anchors: EntryAnchor[]) {
      anchors.forEach((anchor) => {
        list.push(anchor);

        crawlList(anchor.children);
      });
    }

    crawlList(anchors);

    return list;
  }
}

export class EpicAnchorIntelliSenseProvider implements CompletionItemProvider {
  public readonly engine: AnchorEngine;

  constructor(engine: AnchorEngine) {
    this.engine = engine;
  }

  provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ): Thenable<CompletionItem[] | CompletionList> {
    const config = this.engine._config!;

    return new Promise((success) => {
      const keyWord = document.getText(
        document.getWordRangeAtPosition(position.translate(0, -1))
      );

      const hasKeyWord = Array.from(this.engine.tags.keys()).find(
        (v) => v.toUpperCase() === keyWord
      );

      if (hasKeyWord) {
        const epicCtr = new Map<string, number>();

        this.engine.anchorMaps.forEach((anchorIndex, uri) => {
          anchorIndex.anchorTree.forEach((entryAnchor) => {
            const { seq, epic } = entryAnchor.attributes;

            if (epic) {
              epicCtr.set(epic, Math.max(epicCtr.get(epic) || 0, seq));
            }
          });
        });

        success(
          Array.from(epicCtr).map(
            ([epic, maxSeq]) =>
              new CompletionItem(
                `epic=${epic},seq=${maxSeq + config.epic.seqStep}`,
                CompletionItemKind.Enum
              )
          )
        );
      }
    });
  }
}
