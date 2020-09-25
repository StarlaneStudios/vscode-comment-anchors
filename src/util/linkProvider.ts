import { AnchorEngine } from "../anchorEngine";
import {
  CodeLens,
  CodeLensProvider,
  Disposable,
  Event,
  languages,
  Position,
  TextDocument,
  Uri,
} from "vscode";
import { flattenAnchors } from "./flattener";
import { resolve, join } from "path";
import { asyncDelay } from "./asyncDelay";
import { existsSync, fstat, lstatSync } from "fs";
import EntryAnchor from "../anchor/entryAnchor";
import { OpenFileAndRevealLineOptions } from "../extension";

const LINK_REGEX = /^(.+?)(:\d+)?$/;

class LinkCodeLensProvider implements CodeLensProvider {
  readonly engine: AnchorEngine;

  constructor(engine: AnchorEngine) {
    // this.onDidChangeCodeLenses = engine._onDidChangeLensData.event;
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

    flattened
      .filter((anchor) => {
        const tagId = anchor.anchorTag;
        const tag = this.engine.tags.get(tagId);

        return tag?.behavior == "link";
      })
      .forEach((anchor) => {
        const components = LINK_REGEX.exec(anchor.anchorText)!;
        const lineNum = components[2];
        const filePath = components[1];

        const fullPath = resolve(basePath, filePath);
        const fileUri = Uri.file(fullPath);
        const exists = lstatSync(fullPath).isFile();

        if (exists) {
          let codeLens: CodeLens;

          if (lineNum) {
            const lineNumber = parseInt(lineNum.substr(1)) - 1;
            const options: OpenFileAndRevealLineOptions = {
              uri: fileUri,
              lineNumber: lineNumber,
              at: EntryAnchor.ScrollPosition,
            };

            codeLens = new CodeLens(anchor.lensRange, {
              command: "commentAnchors.openFileAndRevealLine",
              title: "$(chevron-right) Click here to open file",
              arguments: [options],
            });
          } else {
            codeLens = new CodeLens(anchor.lensRange, {
              command: "vscode.open",
              title: "$(chevron-right) Click here to open file",
              arguments: [fileUri],
            });
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
