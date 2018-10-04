import { ExtensionContext, window } from "vscode";
import * as pkg from '../package.json';
import * as opn from 'opn';

export default class UpdateMonitor {

	public constructor(
		private context: ExtensionContext
	) {
	}

	checkForUpdate() {
		const lastVersion = this.context.globalState.get('ca_last_version');

		if(lastVersion != pkg.version) {
			this.context.globalState.update('ca_last_version', pkg.version);

			window.showInformationMessage("⚓ Comment Anchors has been updated to version " + pkg.version + "!", "Changelog").then(button => {
				if(button == "Changelog") {
					opn("https://github.com/ExodiusStudios/vscode-comment-anchors/blob/master/CHANGELOG.md")
				}
			})
		}
	}

}