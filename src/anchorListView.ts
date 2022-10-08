import { AnchorEngine } from "./anchorEngine";
import { Webview } from "vscode";

/**
 * Generate the contents of the anchor list view
 *
 * @param engine Engine reference
 * @param webview The website used to display
 */
export function createViewContent(engine: AnchorEngine, webview: Webview): string {
    let tagList = "";

    engine.tags.forEach((tag) => {
        const isDefault = tag.iconColor == "default";
        const tagFlags = [];

        let tagStyle = "";

        if (tag.backgroundColor) {
            tagStyle += `background-color: ${tag.backgroundColor};`;
        }

        if (tag.borderRadius) {
            tagStyle += `border-radius: ${tag.borderRadius}px;`;
        }

        if (tag.borderStyle) {
            tagStyle += `border: ${tag.borderStyle};`;
        }

        if (tag.highlightColor) {
            tagStyle += `color: ${tag.highlightColor};`;
        }

        if (tag.isBold || tag.isBold == undefined) {
            tagStyle += "font-weight: bold;";
        }

        if (tag.isItalic) {
            tagStyle += "font-style: italic;";
        }

        if (tag.scope == "workspace") {
            tagFlags.push("Workspace Scope");
        } else {
            tagFlags.push("File Scope");
        }

        if (tag.styleMode) {
            tagFlags.push(`Style mode: ${tag.styleMode}`);
        }

        if (tag.behavior == "region") {
            tagFlags.push("Region Tag");
        } else if (tag.behavior == "link") {
            tagFlags.push("Link Tag");
        }

        const flags = tagFlags.join(", ");

        tagList += `
		<section class="tag-entry">
			<div class="tag-wrapper">
				<span class="comment-pre">// </span>
				<span class="anchor-tag" style="${tagStyle}">${tag.tag}</span>
				<span class="tag-flags">(${flags})</span>
			</div>
		</section>
		`;
    });

    return `
	<html>
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<style>
				.tag-list {
					font-size: 1.4em;
				}

				.tag-entry {
					background-color: rgba(120,120,120,0.1);
					margin: 1em 0;
					padding: 12px;
				}

				.tag-content {
					padding-top: 3px;
				}

				.tag-icon {
					width: 30px;
					vertical-align: top;
					padding-right: 1em;
				}

				.comment-pre {
					color: rgb(110,110,110);
				}

				.anchor-tag {
					padding: 1px 5px;
				}

				.tag-flags {
					color: rgb(155,155,155);
				}

				body.vscode-light .tag-icon.default-icon {
					filter: invert();
				}
			</style>
		</head>
		<body>
			<h2>Configured Anchor Tags (${engine.tags.size})</h2>
			<div class="tag-list">${tagList}</div>
		</body>
	</html>
	`;
}
