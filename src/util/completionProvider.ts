import { AnchorEngine } from "../anchorEngine";
import {
    CancellationToken,
    CompletionContext,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    Disposable,
    languages,
    Position,
    ProviderResult,
    TextDocument,
} from "vscode";

class TagCompletionProvider implements CompletionItemProvider {
    private engine: AnchorEngine;

    constructor(engine: AnchorEngine) {
        this.engine = engine;
    }

    provideCompletionItems(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
        _context: CompletionContext
    ): ProviderResult<CompletionList> {
        const ret = new CompletionList();
        const config = this.engine._config!;
        const separator = config.tags.separators[0];
        const endTag = config.tags.endTag;

        for (const tag of this.engine.tags.values()) {
            const item = new CompletionItem(tag.tag + " Anchor", CompletionItemKind.Reference);

            item.documentation = `Insert ${tag.tag} comment anchor`;
            item.insertText = tag.tag + separator;
            ret.items.push(item);

            if (tag.behavior == "region") {
                const endItem = new CompletionItem(endTag + tag.tag + " Anchor", CompletionItemKind.Reference);

                endItem.insertText = endTag + tag.tag + separator;
                endItem.documentation = `Insert ${endTag + tag.tag} comment anchor`;
                ret.items.push(endItem);
            }
        }

        return ret;
    }
}

export function setupCompletionProvider(engine: AnchorEngine): Disposable {
    return languages.registerCompletionItemProvider({ language: "*" }, new TagCompletionProvider(engine));
}
