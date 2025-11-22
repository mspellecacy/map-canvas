# Changelog
## Unreleased
- Add My Maps overlay controls that accept Google "My Maps" embed/KML links, convert them into a KML layer on the main viewport, and persist the last URL for quick reloads.

## v0.0.9
- Replace deprecated FormApplication usage with ApplicationV2 when available (Foundry v13+),
  falling back to FormApplication for older versions. This removes deprecation warnings on v13
  and preserves backward compatibility.
- MapDialog now renders via Handlebars ApplicationV2 (v13) and initializes Google Maps after render; 
  no functional changes expected.
- UI: Tightened the header form so controls fit on at most two rows. Search and Scene Name fields
  now flex to share the first row while action buttons flow to a compact second row.

## v0.0.7
- Updated to support FoundryVTT v10's module manifest
- Add new feature for generating expanded scenes (Huge thanks thomasjeffreyandersontwin!)
- Map Dialog now opens where you last left it (Another thanks to thomasjeffreyandersontwin!)
- Fixes bug where single-image scenes were not generating properly

## v0.0.6
- Updated to support FoundryVTT v10

## v0.0.5
- Added experimental feature to store images instead of embedding them in the Scene document. This should help speedup the Scene update process.
- Added configuration to toggle image storage. 
- Forced the scale control to always show when rendering the map.
- DRY'd out some internal functions.  

## v0.0.4

- Updated README.md with new pictures. 
- Added button to toggle labels to take cleaner map captures.

## v0.0.3

- Updated modules.json to better support releases. 
- Added GitHub workflow to streamline the release process.
- fleshed out module file structure for future needs.
- Added a License file.
- Added CHANGELOG.md.

## v0.0.2

- Changed settings registration hook to 'init', this should fix bug #1.
- Changed over to esmodules.
- Added configuration option for Default Map Mode.
- Added configuration option for Default Map Style
- Added configuration option ofr Custom Map Styles.
- Added check when updating scene to generate the default Scene if it doesn't exist.
- Added several canned themes for the maps from: https://mapstyle.withgoogle.com/
- Added a (hacky?) method of temporarily dropping the Maps Controls to take unobstructed captures. Google copyrights and watermarks persist by design.
- Iterated a bit on the current Places Search implementation, not great but better. 

## v0.0.1

- Initial Release
