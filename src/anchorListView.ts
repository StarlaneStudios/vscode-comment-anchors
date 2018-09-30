import * as path from 'path';
import { AnchorEngine } from "./anchorEngine";
import { window, ViewColumn, WebviewPanel, Uri } from "vscode";

let webview: WebviewPanel|null = null;

export default function openAnchorList(engine: AnchorEngine) {
	if(webview) {
		webview.reveal();
	} else {
		webview = window.createWebviewPanel('anchorList', "Comment Anchors Tags", {
			viewColumn: ViewColumn.One
		});

		webview.onDidDispose(() => {
			webview = null;
		});

		webview.webview.html = createViewContent(engine);

		webview.onDidChangeViewState(e => {
			if(e.webviewPanel.visible) {
				webview!.webview.html = createViewContent(engine);
			}
		})
	}
}

function createViewContent(engine: AnchorEngine) : string {
	let tagList = "";

	engine.tags.forEach((tag) => {
		const isDefault = tag.iconColor == 'default';
		const fileIcon = Uri.file(path.join(engine.context.extensionPath, 'res', isDefault ? 'anchor_white.svg' : 'anchor_' + tag.iconColor + '.svg'));
		const icon = fileIcon.with({ scheme: 'vscode-resource' });
		let tagStyle = "";
		let tagFlags = [];

		if(tag.backgroundColor) {
			tagStyle += `background-color: ${tag.backgroundColor};`;
		}

		if(tag.borderRadius) {
			tagStyle += `border-radius: ${tag.borderRadius}px;`;
		}

		if(tag.borderStyle) {
			tagStyle += `border: ${tag.borderStyle};`;
		}

		if(tag.highlightColor) {
			tagStyle += `color: ${tag.highlightColor};`;
		}

		if(tag.isBold || tag.isBold == undefined) {
			tagStyle += 'font-weight: bold;';
		}

		if(tag.isItalic) {
			tagStyle += 'font-style: italic;'
		}

		if(tag.scope == 'workspace') {
			tagFlags.push('Workspace Scope');
		} else {
			tagFlags.push('File Scope');
		}

		if(tag.styleComment) {
			tagFlags.push('Style Comment');
		}

		if(tag.isRegion) {
			tagFlags.push('Region Tag');
		}

		const flags = tagFlags.join(', ');

		tagList += `
		<section class="tag-entry">
			<div class="tag-wrapper">
				<div class="side-container">
					<img class="tag-icon ${isDefault ? 'default-icon' : ''}" src="${icon}">
				</div>
				<div class="tag-content">
					<span class="comment-pre">// </span>
					<span class="anchor-tag" style="${tagStyle}">${tag.tag}</span>
					<span class="tag-flags">(${flags})</span>
				</div>
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

				.tag-wrapper {
					display: flex;
				}

				.side-container, .tag-content {
					flex: 1;
				}

				.side-container {
					max-width: 30px;
				}

				.tag-content {
					padding-top: 3px;
					padding-left: 12px;
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
	`
}