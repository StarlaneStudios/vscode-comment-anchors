# Change Log

## 1.9.6
- Added new "hidden" scope (#128)
	- Prevents anchors from displaying in the sidebar
	- Useful for creating highlight-only anchors

## 1.9.5
- Replace link anchor CodeLens with clickable link
	- Fixes many issues related to lens jittering such as (#109)

## 1.9.4
- Added Show Cursor setting
	- Renders a sidebar entry representing the current cursor position
	- Useful to view your cursors position relative to your anchors
	- Disabled by default, enable in settings to use

## 1.9.3
- Fixed link anchors not always working in the same file
- Anchor sections are now expanded by default
	- Added a setting to revert to the previous behavior

## 1.9.2
- Added `dist` to default excluded directories (#114)
- Added workspace path support for link anchors (#105)
- Fixed multiple tags starting with the same characters not always working

## 1.9.1
- Fixed IntelliSense breaking few extensions

## 1.9.0
- Added Anchor Epics
	- Used to group anchors into individual groups
	- Specify the epic using an `epic` attribute, example:<br>
	`// EXAMPLE[epic=examples] This anchor appears in the "examples" epic`
	- Anchor ordering can be customized per anchor using the `seq` option
- Add "link" anchor support
	- Enabled on tags by setting `behavior` to `"link"`
	- Allows you to specify an absolute or relative file to travel to
	- Renders a clickable link that opens the file in your editor
	- You can link to specific line numbers
		- Example: `// LINK some/file.txt:50`
	- You can link to specific anchors
		- Example: `// LINK some/file.txt#my-anchor`
		- Takes you to `// ANCHOR[id=my-anchor] This is the destination` 
- Added new default `LINK` tag to use together with the new link behavior functionality
- Increase default `maxFiles` value from 50 to 250
- Deprecated `isRegion` in favor of `behavior` set to `"region"`

## 1.8.0
- Added support for custom icon hex colors
	- Defaults to highlightColor when left out
	- Can be set to "auto" or "default" to use black/white icons based on theme
	- Continued support for legacy color names
- Added specialized region end tag icons
- Added pathFormat setting to improve workspace anchor tree readability
- Use file icon from theme for workspace anchor tree
- Fallback to displaying tag in the sidebar when no comment is found
- Fix setting description inaccuracies
- Fix displayLineNumber setting not working for section tags
- Fix region end tags not verifying start tag

## 1.7.1
- Adopt new Webview API
- Fix anchors not working in certain files
- Provide a "collapse all" button on the anchor trees

## 1.7.0
- Changed some default settings to improve performance
- Workspace lazy loading is now enabled by default
- Fixed issues in the documentation
- Added `displayInRuler` setting to disable anchors displaying in the scrollbar ruler
- Added `provideAutoCompletion` setting to disable auto completion support
- Added `maxFiles` setting to change how many workspace files will be indexed 
- Improved the sidebar anchor icon to fit better with the default VSCode icons
- Improved the rendering of fully styled comments
- Simplified the searching regex in order to improve anchor recognition
- Removed editor folding due to the many issues it caused
- Fixed workspace anchors not opening the correct file

## 1.6.1
- Allow anchor comments to be wrapped in double quotes
	- `// ANCHOR: "Like this!"`
	- Currently the only way to allow non-english comments to be parsed by Comment Anchors
- Prevent workspace scanning from blocking other extensions

## 1.6.0
- Added setting to modify separators
	- "Separators" are the characters you are allowed to place between a tag and its message
	- By default, ` `, `: ` and ` - ` are allowed
	- It is advised to remove " " from the list when disabling case matching, as otherwise many false positives may be detected by accident
- Added IntelliSense autocompletion for anchors
- Fixed issues involving editor folding
- Added setting to change where the editor scrolls to when navigating to an anchor
- Added setting to disable editor folding (May fix fold issues in some languages)
- **Possibly breaking:** Tag matching is now Case Sensitive by default 

## 1.5.0
- Added anchor regions
	- Region tags are defined by setting `isRegion` to `true`
	- Defined with a start and end tag
	- Collapsible in the anchor list and in the editor
	- Support for placing regions within regions
	- Provided default region tag "SECTION"
- Greatly improved matching of tags
- Added new icon colors (teal, pink, blurple, emerald)
	- Added icon hex codes to the extension documentation

## 1.4.3
- Added the ability to disable workspace anchors
- Fixed bad performance by excluding `node_modules` and other folders from the workspace scan by default
- Scanning now no longer triggers other extensions to parse all files
- Improved matching regex
	- Now excludes semicolons and other symbols before the comment (e.g. NOTE - Message, ANCHOR: Message)
	- Matches are now case insensitive (Can be disabled in settings)

## v1.4.0
- Added workspace anchors view
	- Allows the viewing of all anchors within one or multiple workspaces
	- Can be used for navigation
	- Tags can be scoped to display for current file only
- Fixed bugs

## v1.3.0
- Added gutter icons
- Added more tag customization styles
- Added command to toggle tag visibility
- Improved comment detecting (Works for XML/HTML files now)

## v1.2.0
- Added support for background colors

## v1.1.0
- Fixed some minor issues

## v1.0.0
- Initial release
