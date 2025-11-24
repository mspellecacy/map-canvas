# Map Canvas
Map Canvas provides a dialog box containing a Google Maps view port allowing you to export the corresponding 'maps image' as a scene for use in play.

Quickly turn contemporary maps in to scenes:
![Example1](https://i.imgur.com/DYtGEZw.png)

Use roadmaps and remove labels
![Example12](https://i.imgur.com/WTCZsq8.png)

Configure the map's default behaviour and styling.
![Configuration](https://i.imgur.com/pKtMufp.png)

Also supports custom styling using: [https://mapstyle.withgoogle.com/](https://mapstyle.withgoogle.com/)

**You will need to provide your own Google Maps Javascript API Key in the world module settings.**  

## Image capture pipeline
Map Canvas captures the Google Maps viewport with the [html-to-image](https://github.com/bubkoo/html-to-image) library for typical scenes, and automatically falls back to [html2canvas](https://html2canvas.hertzen.com/) for ultra-wide captures where foreignObject rendering starts duplicating tiles. The html2canvas path renders at a fixed scale to avoid the white seam artifacts that appear between Google map tiles on very large captures. Generated scenes are saved with Foundry's grid disabled, so you only see the raw satellite imagery unless you explicitly add a grid yourself later. Both capture paths stay completely client-side and require no additional Google export APIs.

# [Demo Video](https://www.youtube.com/watch?v=UEGUJxZJl_Y)

