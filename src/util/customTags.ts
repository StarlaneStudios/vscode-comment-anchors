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
    const custom: Record<string, TagConfig> = config.tags.anchors || {};

    // Parse legacy configuration format
    legacy.forEach((tag: TagEntry) => {
        const def = tagMap.get(tag.tag) || {};
        const opts = { ...def, ...tag };

        // Skip disabled default tags
        if (tag.enabled === false) {
            tagMap.delete(tag.tag);
            return;
        }

        // Fix legacy isRegion tag
        if (opts.isRegion) {
            opts.behavior = "region";
        }

        tagMap.set(tag.tag, opts);
    });

    // Parse custom tags
    Object.entries(custom).forEach(([tag, config]) => {
        const def = tagMap.get(tag) || {};
        const opts = { ...def, ...config };

        // Skip disabled default tags
        if (config.enabled === false) {
            tagMap.delete(tag);
            return;
        }

        // Fix legacy isRegion tag
        if (opts.isRegion) {
            opts.behavior = "region";
        }

        tagMap.set(tag, {
            ...opts,
            tag: tag
        });
    });
}