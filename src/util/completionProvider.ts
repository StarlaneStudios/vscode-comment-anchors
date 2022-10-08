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

    public constructor(engine: AnchorEngine) {
        this.engine = engine;
    }

    public provideCompletionItems(
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
            const name = `${tag.tag} Anchor`;
            const item = new CompletionItem(name, CompletionItemKind.Event);

            item.insertText = tag.tag + separator;
            item.detail = `Insert ${tag.tag} anchor`;

            ret.items.push(item);

            if (tag.behavior == "region") {
                const endItem = new CompletionItem(endTag + name, CompletionItemKind.Event);

                endItem.insertText = endTag + tag.tag;
                endItem.detail = `Insert ${endTag + tag.tag} comment anchor`;
                item.keepWhitespace = true;

                ret.items.push(endItem);
            }
        }

        return ret;
    }
}

export function setupCompletionProvider(engine: AnchorEngine): Disposable {
    const prefixes = engine._config!.tags.matchPrefix;
    const triggers = [...new Set<string>(prefixes.map((p: string) => p[p.length - 1]))];

    return languages.registerCompletionItemProvider(
        { language: "*" },
        new TagCompletionProvider(engine),
        ...triggers
    );
}
