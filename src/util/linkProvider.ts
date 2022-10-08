import { CancellationToken, DocumentLink, DocumentLinkProvider, ProviderResult, TextDocument, Uri, window, workspace } from "vscode";
import { join, resolve } from "path";

import { AnchorEngine } from "../anchorEngine";
import { flattenAnchors } from "./flattener";
import { existsSync, lstatSync } from "fs";

const LINK_REGEX = /^(\.{1,2}[/\\])?([^:#]+)?(:\d+|#[\w-]+)?$/;

export class LinkProvider implements DocumentLinkProvider {
	
    public readonly engine: AnchorEngine;

    public constructor(engine: AnchorEngine) {
        this.engine = engine;
    }

    public createTarget(uri: Uri, line: number): Uri {
        return Uri.parse(`file://${uri.path}#${line}`);
    }

    public provideDocumentLinks(document: TextDocument, _token: CancellationToken): ProviderResult<DocumentLink[]> {
        if (document.uri.scheme == "output") {
            return [];
        }

        const index = this.engine.anchorMaps.get(document.uri);
        const list: DocumentLink[] = [];

        if (!index) {
            return [];
        }

        const flattened = flattenAnchors(index.anchorTree);
        const basePath = join(document.uri.fsPath, "..");
        const workspacePath = workspace.getWorkspaceFolder(document.uri)?.uri?.fsPath ?? "";
        const tasks: Promise<unknown>[] = [];

        flattened
            .filter((anchor) => {
                const tagId = anchor.anchorTag;
                const tag = this.engine.tags.get(tagId);

                return tag?.behavior == "link";
            })
            .forEach((anchor) => {
                const components = LINK_REGEX.exec(anchor.anchorText)!;
                const parameter = components[3] || '';
                const filePath = components[2] || document?.uri?.fsPath || '';
                const relativeFolder = components[1];
                const fullPath = relativeFolder ? resolve(basePath, relativeFolder, filePath) : resolve(workspacePath, filePath);
                const fileUri = Uri.file(fullPath);

                if (!existsSync(fullPath) || !lstatSync(fullPath).isFile()) {
                    return;
                }

                const anchorRange = anchor.getAnchorRange(document, true);
                let docLink: DocumentLink;
                let task: Promise<unknown>;

                if (parameter.startsWith(":")) {
                    const lineNumber = parseInt(parameter.substr(1));
                    const targetURI = this.createTarget(fileUri, lineNumber);

                    docLink = new DocumentLink(anchorRange, targetURI);
                    docLink.tooltip = "Click here to open file at line " + (lineNumber + 1);
                    task = Promise.resolve();
                } else {
                    if (parameter.startsWith("#")) {
                        const targetId = parameter.substr(1);

                        task = this.engine.getAnchors(fileUri).then((anchors) => {
                            const flattened = flattenAnchors(anchors);
                            let targetLine = 0;

                            for (const anchor of flattened) {
                                if (anchor.attributes.id == targetId) {
                                    targetLine = anchor.lineNumber;
                                }
                            }

                            const targetURI = this.createTarget(fileUri, targetLine);

                            if (fileUri.path == window.activeTextEditor?.document?.uri?.path) {
                                docLink = new DocumentLink(anchorRange, targetURI);
                                docLink.tooltip = "Click here to go to anchor " + targetId;
                            } else {
                                docLink = new DocumentLink(anchorRange, targetURI);
                                docLink.tooltip = "Click here to open file at anchor " + targetId;
                            }
                        });
                    } else {
                        docLink = new DocumentLink(anchorRange, fileUri);
                        docLink.tooltip = "Click here to open file";
                        task = Promise.resolve();
                    }
                }

                const completion = task.then(() => {
                    list.push(docLink);
                });

                tasks.push(completion);
            });

        return Promise.all(tasks).then(() => {
            return list;
        });
    }
}
