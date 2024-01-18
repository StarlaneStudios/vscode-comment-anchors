import { WorkspaceConfiguration } from "vscode";
import { TagEntry } from "../anchorEngine";

type TagConfig = Omit<TagEntry, 'tag'>;

/**
 * Parse and register custom anchors to the tagMap
 *
 * @param config The extension configuration
 * @param tagMap The tagMap reference
 */
export function parseCustomAnchors(config: WorkspaceConfiguration, tagMap: Map<string, TagEntry>): void {
    const legacy: TagEntry[] = config.tags.list || [];
    const custom: Record<string, TagConfig> = {...config.tags.anchors};

    // Parse legacy configuration format
    for (const tag of legacy) {
        custom[tag.tag] = tag;
    }

    // Parse custom tags
    for (const [tag, config] of Object.entries(custom)) {
        const def = tagMap.get(tag) || {};
        const opts: any = { ...def, ...config };

        // Skip disabled default tags
        if (config.enabled === false) {
            tagMap.delete(tag);
            continue;
        }

        // Migrate the isRegion property
        if (opts.isRegion) {
            opts.behavior = "region";
        }

        // Migrate the styleComment property
        if (opts.styleComment) {
            opts.styleMode = "comment";
        }

        tagMap.set(tag, {
            ...opts,
            tag: tag
        });
    }
}