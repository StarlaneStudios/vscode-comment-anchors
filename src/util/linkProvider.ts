import { AnchorEngine } from "../anchorEngine";
import { CodeLens, CodeLensProvider, Disposable, languages, TextDocument, Uri, window, workspace } from "vscode";
import { flattenAnchors } from "./flattener";
import { resolve, join } from "path";
import { asyncDelay } from "./asyncDelay";
import { lstatSync } from "fs";
import EntryAnchor from "../anchor/entryAnchor";
import { OpenFileAndRevealLineOptions } from "../extension";

const LINK_REGEX = /^(\.{1,2}[/\\])?(.+?)(:\d+|#[\w-]+)?$/;

export class LinkCodeLensProvider implements CodeLensProvider {
    readonly engine: AnchorEngine;

    public lensCache: CodeLens[] = [];

    constructor(engine: AnchorEngine) {
        this.engine = engine;
    }

    async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
        if (document.uri.scheme == "output") {
            return [];
        }

        const index = this.engine.anchorMaps.get(document.uri);
        const list: CodeLens[] = [];

        if (!index) {
            return Promise.resolve(this.lensCache);
        }

        const flattened = flattenAnchors(index.anchorTree);
        const basePath = join(document.uri.fsPath, "..");
        const workspacePath = workspace.getWorkspaceFolder(document.uri)?.uri?.fsPath ?? "";

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

                const fullPath = relativeFolder ? resolve(basePath, relativeFolder, filePath) : resolve(workspacePath, filePath);
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

                        codeLens = new CodeLens(anchor.linkRange, {
                            command: "commentAnchors.openFileAndRevealLine",
                            title: "$(chevron-right) Click here to open file at line " + (lineNumber + 1),
                            arguments: [options],
                        });
                    } else {
                        if (parameter.startsWith("#")) {
                            const targetId = parameter.substr(1);

                            this.engine.revealAnchorOnParse = targetId;

                            if (fileUri.path == window.activeTextEditor?.document?.uri?.path) {
                                const anchors = this.engine.currentAnchors;
                                const flattened = flattenAnchors(anchors);
                                let targetLine;

                                for (const anchor of flattened) {
                                    if (anchor.attributes.id == targetId) {
                                        targetLine = anchor.lineNumber - 1;
                                    }
                                }

                                const options = {
                                    lineNumber: targetLine,
                                    at: "top",
                                };

                                codeLens = new CodeLens(anchor.linkRange, {
                                    command: "revealLine",
                                    title: "$(chevron-right) Click here to go to anchor " + targetId,
                                    arguments: [options],
                                });
                            } else {
                                codeLens = new CodeLens(anchor.linkRange, {
                                    command: "vscode.open",
                                    title: "$(chevron-right) Click here to open file at anchor " + targetId,
                                    arguments: [fileUri],
                                });
                            }
                        } else {
                            codeLens = new CodeLens(anchor.linkRange, {
                                command: "vscode.open",
                                title: "$(chevron-right) Click here to open file",
                                arguments: [fileUri],
                            });
                        }
                    }

                    list.push(codeLens);
                } else {
                    list.push(
                        new CodeLens(anchor.linkRange, {
                            command: "",
                            title: "$(chrome-close) File not found",
                            arguments: [],
                        })
                    );
                }
            });

        this.lensCache = list;

        return list;
    }
}
