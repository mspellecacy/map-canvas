# Changelog
## v0.0.13
- Change: Swap html2canvas for the maintained html-to-image library, reducing bundle weight and avoiding extra Google capture APIs.
- Fix: Wide captures now auto-fallback to html2canvas when foreignObject rendering would duplicate tiles, restoring accurate imagery for ultra-wide scenes.
- Fix: html2canvas renders at a fixed scale to eliminate the white seam artifacts that appeared between Google map tiles on very large captures.
- Fix: Generated scenes are now gridless by default to prevent the white overlay from appearing on large captures (you can re-enable a grid later if desired).
- Improvement: Capture flow now decodes the generated PNG to derive dimensions, keeping scene sizing accurate while remaining fully client-side.

## v0.0.12
- Change: Default window spawn size set to at least 640x480 for both Foundry ApplicationV2 (v13+) and legacy FormApplication (v9–v12). This ensures the Map Canvas dialog opens at a usable size by default.

## v0.0.11
- Bugfix: Labels button works correctly after switching to Satellite view.
  - In Satellite view, the Labels toggle now switches between HYBRID (labels on) and SATELLITE (labels off).
  - The Map/Sat toggle preserves the current label state: entering Satellite picks HYBRID or SATELLITE based on label state; returning to Map reapplies label styles appropriately.

## v0.0.10
- Bugfix: Custom controls and overlays no longer appear in captured images when generating or updating scenes.
  - During capture, the toolbar (#inputHolder) and loading overlay are temporarily hidden and explicitly
    excluded via html2canvas ignoreElements. Google default UI remains disabled throughout capture.
  - Restores UI state immediately after capture.

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
