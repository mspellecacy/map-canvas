import {MAP_STYLES} from "./map-canvas-styles.js";
import {ImageDataConverter} from "./image-data-converter.js";

class MapDialog extends FormApplication {

    constructor(object, options) {
        super(object, options);

        // Using window['mapcanvas'] as a way to track dialog state. Not ideal.
        window['mapcanvas'].dialogActive = true;
        window['mapcanvas'].apiLoaded = false;

        Hooks.once('renderApplication', async () => {
            const MAPS_API_KEY = game.settings.get("map-canvas", "MAPS_API_KEY");
            if(!window['mapcanvas'].apiLoaded) {
                await $.getScript('https://polyfill.io/v3/polyfill.min.js?features=default', () => {});
                await $.getScript('https://maps.googleapis.com/maps/api/js?libraries=places&v=weekly&key='+MAPS_API_KEY, () => {});
                window['mapcanvas'].apiLoaded = true;  // We assume.
            }

            MapDialog.initMap();
        });

        Hooks.on('mapCanvasToggleLabels', this.toggleLabels);
        MapDialog.labelsOn = true;
    }

    static get defaultOptions() {
        let opts = super.defaultOptions;
        opts.id = "mapCanvasDialog";
        opts.base = "mc_";
        opts.title = "Map Canvas";
        opts.template = "modules/map-canvas/templates/map-canvas.html";
        opts.resizable = true;
        opts.isEditable = false;
        opts.closeOnSubmit = false;
        opts.popOut = true;
        return opts;
    }

    static getMapStyle() {
        let styleJSON = [];
        const mapCanvasStyle = game.settings.get("map-canvas", "DEFAULT_MAP_STYLE");

        if(mapCanvasStyle.toUpperCase() === "CUSTOM" ) { // If they're using custom we have to parse the string to JSON.
            styleJSON = JSON.parse(game.settings.get("map-canvas", "CUSTOM_MAP_STYLE_JSON"));
        } else {
            styleJSON = MAP_STYLES[mapCanvasStyle.toUpperCase()];
        }

        return styleJSON;
    }

    // 40.7571, -73.8458 - Citi Field, Queens, NY - LET'S GO METS!
    static initMap(center = { lat: 40.7571, lng: -73.8458 }) {

        MapDialog.mapPortal = {};
        MapDialog.placesService = {};
        MapDialog.mapPortalElem = document.querySelector('#mapPortal');
        MapDialog.searchBoxElem = document.querySelector('#mapCanvasSearchBox');
        MapDialog.zoomLevelElem = document.querySelector('#mapCanvasZoomLevel');

        const opts = {
            center: center,
            zoom: 17,
            tilt: 0, // Suppress tilting on zoom in by default. (users can still toggle it on)
            scaleControl: true,
            disableDefaultUI: false,
            streetViewControl: false, // TODO: Figure out how to make Street View capture properly.
            mapTypeId: google.maps.MapTypeId[game.settings.get("map-canvas", "DEFAULT_MAP_MODE")],
            styles: this.getMapStyle()
        }

        MapDialog.mapPortal = new google.maps.Map(MapDialog.mapPortalElem, opts);

        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', (e) => {
            MapDialog.zoomLevelElem.value = MapDialog.mapPortal.getZoom();
        });

        MapDialog.placesService = new google.maps.places.PlacesService(MapDialog.mapPortal);

        MapDialog.initAutocomplete(MapDialog.mapPortal, MapDialog.searchBoxElem);
    }

    // Adapted from: https://developers.google.com/maps/documentation/javascript/examples/places-searchbox
    static initAutocomplete(map, input) {
        const searchBox = new google.maps.places.SearchBox(input);

        map.addListener("bounds_changed", () => {
            searchBox.setBounds(map.getBounds());
        });

        // Listen for the event fired when the user selects a prediction and retrieve
        // more details for that place.
        searchBox.addListener("places_changed", () => {
            const places = searchBox.getPlaces();

            if (places.length === 0) {
                return;
            }

            // For each place, get the icon, name and location.
            const bounds = new google.maps.LatLngBounds();

            places.forEach((place) => {
                if (!place.geometry || !place.geometry.location) {
                    console.log("Returned place contains no geometry");
                    return;
                }

                if (place.geometry.viewport) {
                    // Only geocodes have viewport.
                    bounds.union(place.geometry.viewport);
                } else {
                    bounds.extend(place.geometry.location);
                }
            });
            map.fitBounds(bounds);
        });

    }

    toggleLabels() {
        // Unfortunately this will effectively overwrite label visibility styling defined by any custom style.
        if(MapDialog.labelsOn) {
            MapDialog.mapPortal.set('styles', MAP_STYLES.LABELS_OFF);
            MapDialog.labelsOn = false;
        } else {
            MapDialog.mapPortal.set('styles', MAP_STYLES.LABELS_ON);
            MapDialog.labelsOn = true;
        }

    }

    getData(options = {}) {
        return super.getData().object;
    }

    activateListeners(html) {
        super.activateListeners(html);
    }

    async _updateObject(event, formData) {
        // TODO: Rethink / Reimplement how we can properly rehydrate a dialog box where users last left it.
        window['mapcanvas'].lastSearch = formData.mapCanvasSearchBox
        this.object = { searchValue: formData.mapCanvasSearchBox, portalActive: true };
    }

    async close() {
        window['mapcanvas'].dialogActive = false;
        window['mapcanvas'].dialog = {}
        await super.close();
    }
}

class MapCanvas extends Application {

    constructor(object, options) {
        super(object, options)

        window['mapcanvas'] = { dialogActive: false, apiLoaded: false };

        $.getScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.3.2/html2canvas.min.js', () => { /* import html2canvas */ });

        Hooks.on("getSceneControlButtons", (controls) => this.addControls(controls));
        Hooks.on('mapCanvasGenerateScene', () => this.updateScene(true));
        Hooks.on('mapCanvasUpdateScene', this.updateScene);

        // Register our settings
        Hooks.once('init', () => {
            MapCanvas.registerSettings().then(() => console.log("MapCanvas Settings Registered."));
        });
    }

    addControls(controls) {
        if (game.user.isGM) {

            const canvasTools = [
                {
                    active: true,
                    name: "mapdialog",
                    title: "Open Map Dialog",
                    icon: "fas fa-map-marker-alt",
                    button: true,
                    toggle: true,
                    onClick: _ => {
                        this.openDialog();
                    }
                },
                {
                    active: false,
                    name: "purgetemp",
                    title: "Purge Generated Scenes",
                    icon: "fas fa-backspace",
                    button: true,
                    toggle: true,
                    onClick: _ => {
                        const SCENE_NAME = game.settings.get("map-canvas", "DEFAULT_SCENE");
                        game.scenes.filter(s => s.name.startsWith(SCENE_NAME+"_")).forEach((a) => {
                            game.scenes.get(a.id).delete();
                        });
                    }
                }
            ]

            const hudControl = {
                name: "mapcanvas",
                title: "Map Canvas",
                icon: "fas fa-globe",
                layer: "controls",
                tools: canvasTools,
            }

            controls.push(hudControl);
        }
    }

    openDialog() {
        if (!window['mapcanvas'].dialogActive) { window['mapcanvas'].dialogActive = true } else { return }
        window['mapcanvas'].dialog = new MapDialog();
        window['mapcanvas'].dialog.render(true);
    }

    async updateScene(generateNewScene = false) {
        const USE_STORAGE = game.settings.get("map-canvas", "USE_STORAGE");
        const DEFAULT_SCENE = game.settings.get("map-canvas", "DEFAULT_SCENE");
        const sceneName = (generateNewScene) ? DEFAULT_SCENE+"_"+new Date().getTime() : DEFAULT_SCENE;
        let scene = game.scenes.find(s => s.name.startsWith(sceneName));

        if(!scene) {
            // Create our scene if we don't have it.
            await Scene.create({name: sceneName }).then(s => {
                scene = s;
                ui.notifications.info('Map Canvas | Created scene: '+sceneName);
            });
        }

        await MapCanvas.getMapCanvasImage().then(async (image) => {
            // TODO: Make some of these user-definable. Perhaps leveraging Scene.createDialog().
            let updates = {
                _id: scene.id,
                img: image.dataUrl,
                bgSource: image.dataUrl,
                width: 4000,
                height: 3000,
                padding: 0.01,
                gridType: 0
            }

            if(USE_STORAGE) {
                const fileName = `${DEFAULT_SCENE}_${new Date().getTime()}_BG.png`
                const blob = new ImageDataConverter(image.dataUrl).dataURItoBlob();
                const tempFile = new File([blob], fileName, {
                    type: "image/png",
                    lastModified: new Date(),
                });

                await FilePicker.createDirectory('user', 'map-canvas').catch((e) => {
                    if (!e.startsWith("EEXIST")) console.log(e);
                });

                await FilePicker.upload('data', 'map-canvas', tempFile).then((res) => {
                    updates.bgSource = res.path;
                    updates.img = res.path;
                });

            }

            await Scene.updateDocuments([updates]).then(() => {
                ui.notifications.info(" Map Canvas | Updated Scene: " + sceneName)
            });
        });
    }

    // TODO: Kinda violates single-responsibility principle, method should be moved to the MapDialog class.
    static async getMapCanvasImage() {
        let tempImage = new Image();
        let imageDems = {};

        // TODO: Refactor this hacky fix to remove the map controls when capturing the background image.
        function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms) ) }
        MapDialog.mapPortal.setOptions({ disableDefaultUI: true }); // Remove controls before taking map capture.
        await sleep(100); // Hack to give the maps api time to remove the controls.

        await html2canvas(document.querySelector("#mapPortal"), { useCORS: true }).then( mapCanvas => {
           // simple hack to get image size from data urls.
           tempImage.onload = (_) => {
               imageDems = { width: _.currentTarget.naturalWidth, height: _.currentTarget.naturalHeight }
           };
           tempImage.src = mapCanvas.toDataURL();
        });

        MapDialog.mapPortal.setOptions({ disableDefaultUI: false }); // Put the map controls back.

        return { dataUrl: tempImage.src, dems: imageDems } ;
    }

    static async registerSettings() {

        await game.settings.register('map-canvas', 'MAPS_API_KEY', {
            name: 'Google Maps Javascript API Key',
            hint: 'Google how to get a Maps Javascript API Key.',
            scope: 'world',
            config: true,
            type: String,
            default: "",
            filePicker: false,
        });

        await game.settings.register('map-canvas', 'DEFAULT_SCENE', {
            name: 'Default Scene Name',
            hint: 'Used when running canvas updates.',
            scope: 'world',
            config: true,
            type: String,
            default: "MapCanvasScene",
            filePicker: false,
        });

        await game.settings.register('map-canvas', 'USE_STORAGE', {
            name: 'Store Images [Experimental]',
            hint: 'Stores images instead of embedding them in the scene document, should speed up image propagation.',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false,
            filePicker: false,
        });

        await game.settings.register('map-canvas', 'DEFAULT_MAP_MODE', {
            name: 'Default Map Mode',
            hint: 'Determines what display mode loads by default when opening the map dialog.',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                HYBRID: 'HYBRID',
                ROADMAP: 'ROADMAP',
                SATELLITE: 'SATELLITE',
                TERRAIN: 'TERRAIN',
            },
        });

        await game.settings.register('map-canvas', "DEFAULT_MAP_STYLE", {
            name: 'Default Maps Style',
            hint: 'See: https://mapstyle.withgoogle.com/',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                Standard: "Standard",
                Silver: "Silver",
                Retro: "Retro",
                Dark: "Dark",
                Night: "Night",
                Aubergine: "Aubergine",
                Custom: "Custom"
            },
        });

        await game.settings.register('map-canvas', "CUSTOM_MAP_STYLE_JSON", {
            name: 'Custom Map Styling JSON',
            hint: 'Optional: Used when selecting \'Custom\' from the styles drop down.',
            scope: 'world',
            config: true,
            type: String,
        });

    }

    // A failed stab at canvas based image scaling lifted from SO for rendering cleaner scaled scene backgrounds.
    static canvasScale(img, dems, scale = 2) {
        let src_canvas = document.createElement('canvas');
        src_canvas.width = dems.width;
        src_canvas.height = dems.height;

        console.log("Dems: ", dems.width);

        let src_ctx = src_canvas.getContext('2d');
        src_ctx.drawImage(img, 0, 0);
        let src_data = src_ctx.getImageData(0, 0, 640, 480).data;

        let sw = dems.width * scale;
        let sh = dems.height * scale;

        console.log({ sw: sw, sh: sh });
        let dst_canvas = document.createElement('canvas');
        dst_canvas.width = sw;
        dst_canvas.height = sh;
        let dst_ctx = dst_canvas.getContext('2d');

        let dst_imgdata = dst_ctx.createImageData(200, 200);
        let dst_data = dst_imgdata.data;

        let src_p = 0;
        let dst_p = 0;
        for (let y = 0; y < this.height; ++y) {
            for (let i = 0; i < scale; ++i) {
                for (let x = 0; x < this.width; ++x) {
                    let src_p = 4 * (y * this.width + x);
                    for (let j = 0; j < scale; ++j) {
                        let tmp = src_p;
                        dst_data[dst_p++] = src_data[tmp++];
                        dst_data[dst_p++] = src_data[tmp++];
                        dst_data[dst_p++] = src_data[tmp++];
                        dst_data[dst_p++] = src_data[tmp++];
                    }
                }
            }
        }
        dst_ctx.putImageData(dst_imgdata, 0, 0);
        console.log(dst_canvas);
        return dst_canvas.toDataURL();
    }

}

const mapCanvas = new MapCanvas();