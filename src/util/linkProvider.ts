import { AnchorEngine } from "../anchorEngine";
import {
    CodeLens,
    CodeLensProvider,
    Disposable,
    languages,
    TextDocument,
    Uri,
    workspace,
} from "vscode";
import { flattenAnchors } from "./flattener";
import { resolve, join } from "path";
import { asyncDelay } from "./asyncDelay";
import { lstatSync } from "fs";
import EntryAnchor from "../anchor/entryAnchor";
import { OpenFileAndRevealLineOptions } from "../extension";
import { throws } from "assert";

const LINK_REGEX = /^(\.{1,2}[/\\])?(.+?)(:\d+|#[\w-]+)?$/;

class LinkCodeLensProvider implements CodeLensProvider {
    readonly engine: AnchorEngine;

    constructor(engine: AnchorEngine) {
        this.engine = engine;
    }

    async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
        if (document.uri.scheme == "output") {
            return [];
        }

        // While this seems like an extremely crude solution,
        // it does provide a much better visual experience
        // compared to directly parsing anchors.
        while (this.engine.anchorsDirty) {
            await asyncDelay(100);
        }

        const index = this.engine.anchorMaps.get(document.uri);
        const list: CodeLens[] = [];

        if (!index) {
            return [];
        }

        const flattened = flattenAnchors(index.anchorTree);
        const basePath = join(document.uri.fsPath, "..");
        const workspacePath =
            workspace.getWorkspaceFolder(document.uri)?.uri?.fsPath ?? "";

        flattened
            .filter((anchor) => {
                const tagId = anchor.anchorTag;
                const tag = this.engine.tags.get(tagId);

                return tag?.behavior == "link";
            })
            .forEach((anchor) => {
                const components = LINK_REGEX.exec(anchor.anchorText)!;
                const parameter = components[3] || "";
                const filePath = components[2];
                const relativeFolder = components[1];

                const fullPath = relativeFolder
                    ? resolve(basePath, relativeFolder, filePath)
                    : resolve(workspacePath, filePath);
                const fileUri = Uri.file(fullPath);
                const exists = lstatSync(fullPath).isFile();

                if (exists) {
                    let codeLens: CodeLens;

                    if (parameter.startsWith(":")) {
                        const lineNumber = parseInt(parameter.substr(1)) - 1;
                        const options: OpenFileAndRevealLineOptions = {
                            uri: fileUri,
                            lineNumber: lineNumber,
                            at: EntryAnchor.ScrollPosition,
                        };

                        codeLens = new CodeLens(anchor.lensRange, {
                            command: "commentAnchors.openFileAndRevealLine",
                            title:
                                "$(chevron-right) Click here to open file at line " +
                                (lineNumber + 1),
                            arguments: [options],
                        });
                    } else {
                        if (parameter.startsWith("#")) {
                            const targetId = parameter.substr(1);

                            this.engine.revealAnchorOnParse = targetId;

                            // if (anchor.file.path == process.cwd()) {
                            //     const anchors = this.engine.currentAnchors;
                            //     const flattened = flattenAnchors(anchors);
                            //     let targetLine;

                            //     for (const anchor of flattened) {
                            //         if (anchor.attributes.id == targetId) {
                            //             targetLine = anchor.lineNumber - 1;
                            //         }
                            //     }

                            //     const options = {
                            //         lineNumber: targetLine,
                            //         at: 'top'
                            //     }

                            //     codeLens = new CodeLens(anchor.lensRange, {
                            //         command: "revealLine",
                            //         title:
                            //             "$(chevron-right) Click here to go to anchor " +
                            //             targetId,
                            //         arguments: [options],
                            //     });
                            // } else {
                            codeLens = new CodeLens(anchor.lensRange, {
                                command: "vscode.open",
                                title:
                                    "$(chevron-right) Click here to open file at anchor " +
                                    targetId,
                                arguments: [fileUri],
                            });
                            // }
                        } else {
                            codeLens = new CodeLens(anchor.lensRange, {
                                command: "vscode.open",
                                title: "$(chevron-right) Click here to open file",
                                arguments: [fileUri],
                            });
                        }
                    }

                    list.push(codeLens);
                } else {
                    list.push(
                        new CodeLens(anchor.lensRange, {
                            command: "",
                            title: "$(chrome-close) File not found",
                            arguments: [],
                        })
                    );
                }
            });

        return list;
    }
}

export function setupLinkProvider(engine: AnchorEngine): Disposable {
    return languages.registerCodeLensProvider(
        { language: "*" },
        new LinkCodeLensProvider(engine)
    );
}
