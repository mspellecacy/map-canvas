class MapDialog extends FormApplication {

    constructor(object, options) {
        super(object, options);
        window['mapcanvas'].dialogActive = true;
        window['mapcanvas'].apiLoaded = false;

        Hooks.once('renderApplication', async () => {
            const MAPS_API_KEY = game.settings.get("MapCanvas", "MAPS_API_KEY");
            if(!window['mapcanvas'].apiLoaded) {
                await $.getScript('https://polyfill.io/v3/polyfill.min.js?features=default', () => {});
                await $.getScript('https://maps.googleapis.com/maps/api/js?libraries=places&v=weekly&key='+MAPS_API_KEY, () => {});
                window['mapcanvas'].apiLoaded = true;
            }
            MapDialog.initMap();
        });
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

    static initMap(center = { lat: -34.397, lng: 150.644 }) {

        MapDialog.mapPortal = {};
        MapDialog.placesService = {};
        MapDialog.mapPortalElem = document.querySelector('#mapPortal');
        MapDialog.searchBoxElem = document.querySelector('#mapCanvasSearchBox');
        MapDialog.zoomLevelElem = document.querySelector('#mapCanvasZoomLevel');

        MapDialog.mapPortal = new google.maps.Map(MapDialog.mapPortalElem, {
            center: center,
            zoom: 8,
            disableDefaultUI: false,
            mapTypeId: google.maps.MapTypeId.HYBRID,
            rotateControl: true,
            scaleControl: true,
            styles: [
                {
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#ebe3cd"
                        }
                    ]
                },
                {
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "color": "#523735"
                        }
                    ]
                },
                {
                    "elementType": "labels.text.stroke",
                    "stylers": [
                        {
                            "color": "#f5f1e6"
                        }
                    ]
                },
                {
                    "featureType": "administrative",
                    "elementType": "geometry.stroke",
                    "stylers": [
                        {
                            "color": "#c9b2a6"
                        }
                    ]
                },
                {
                    "featureType": "administrative.land_parcel",
                    "elementType": "geometry.stroke",
                    "stylers": [
                        {
                            "color": "#dcd2be"
                        }
                    ]
                },
                {
                    "featureType": "administrative.land_parcel",
                    "elementType": "labels",
                    "stylers": [
                        {
                            "visibility": "off"
                        }
                    ]
                },
                {
                    "featureType": "administrative.land_parcel",
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "color": "#ae9e90"
                        }
                    ]
                },
                {
                    "featureType": "landscape.natural",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#dfd2ae"
                        }
                    ]
                },
                {
                    "featureType": "poi",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#dfd2ae"
                        }
                    ]
                },
                {
                    "featureType": "poi",
                    "elementType": "labels.text",
                    "stylers": [
                        {
                            "visibility": "off"
                        }
                    ]
                },
                {
                    "featureType": "poi",
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "color": "#93817c"
                        }
                    ]
                },
                {
                    "featureType": "poi.business",
                    "stylers": [
                        {
                            "visibility": "off"
                        }
                    ]
                },
                {
                    "featureType": "poi.park",
                    "elementType": "geometry.fill",
                    "stylers": [
                        {
                            "color": "#a5b076"
                        }
                    ]
                },
                {
                    "featureType": "poi.park",
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "color": "#447530"
                        }
                    ]
                },
                {
                    "featureType": "road",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#f5f1e6"
                        }
                    ]
                },
                {
                    "featureType": "road",
                    "elementType": "labels.icon",
                    "stylers": [
                        {
                            "visibility": "off"
                        }
                    ]
                },
                {
                    "featureType": "road.arterial",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#fdfcf8"
                        }
                    ]
                },
                {
                    "featureType": "road.highway",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#f8c967"
                        }
                    ]
                },
                {
                    "featureType": "road.highway",
                    "elementType": "geometry.stroke",
                    "stylers": [
                        {
                            "color": "#e9bc62"
                        }
                    ]
                },
                {
                    "featureType": "road.highway.controlled_access",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#e98d58"
                        }
                    ]
                },
                {
                    "featureType": "road.highway.controlled_access",
                    "elementType": "geometry.stroke",
                    "stylers": [
                        {
                            "color": "#db8555"
                        }
                    ]
                },
                {
                    "featureType": "road.local",
                    "elementType": "labels",
                    "stylers": [
                        {
                            "visibility": "off"
                        }
                    ]
                },
                {
                    "featureType": "road.local",
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "color": "#806b63"
                        }
                    ]
                },
                {
                    "featureType": "transit",
                    "stylers": [
                        {
                            "visibility": "off"
                        }
                    ]
                },
                {
                    "featureType": "transit.line",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#dfd2ae"
                        }
                    ]
                },
                {
                    "featureType": "transit.line",
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "color": "#8f7d77"
                        }
                    ]
                },
                {
                    "featureType": "transit.line",
                    "elementType": "labels.text.stroke",
                    "stylers": [
                        {
                            "color": "#ebe3cd"
                        }
                    ]
                },
                {
                    "featureType": "transit.station",
                    "elementType": "geometry",
                    "stylers": [
                        {
                            "color": "#dfd2ae"
                        }
                    ]
                },
                {
                    "featureType": "water",
                    "elementType": "geometry.fill",
                    "stylers": [
                        {
                            "color": "#b9d3c2"
                        }
                    ]
                },
                {
                    "featureType": "water",
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "color": "#92998d"
                        }
                    ]
                }
            ]
        });

        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', (e) => {
            MapDialog.zoomLevelElem.value = MapDialog.mapPortal.getZoom();
        });


        MapDialog.placesService = new google.maps.places.PlacesService(MapDialog.mapPortal);

        const searchBox = new google.maps.places.SearchBox(MapDialog.searchBoxElem);

        MapDialog.searchBoxElem.addEventListener("keyup", (e) => {
            e.preventDefault();
            if (e.key === "Enter") {
                let searchRequest = {query: e.target.value, fields: ["name", "geometry"]}
                MapDialog.placesService.findPlaceFromQuery(searchRequest, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        MapDialog.mapPortal.setCenter(results[0].geometry.location);
                    }
                });
            }
        });
    }

    getData(options = {}) {
        return super.getData().object;
    }

    activateListeners(html) {
        super.activateListeners(html);
    }

    async _updateObject(event, formData) {
        const portalFrame = $(this.element).find('[name="mapCanvasFrame"]')[0];
        window['mapcanvas'].lastSearch = formData.mapCanvasSearchValue
        this.object = { searchValue: formData.mapCanvasSearchValue, portalActive: true };

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
        Hooks.on('mapCanvasGenerateScene', this.handleSceneRequest);
        Hooks.on('mapCanvasUpdateScene', this.updateScene);
        Hooks.once('canvasReady', () => {
            MapCanvas.registerSettings().then(() => console.log("MapCanvas Settings Registered."));
        });
    }

    addControls(controls) {
        if (game.user.isGM) {

            const canvasTools = [
                {
                    active: true,
                    name: "maplocker",
                    title: "Lock Map",
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
                    title: "Purge Temp Scenes",
                    icon: "fas fa-backspace",
                    button: true,
                    toggle: true,
                    onClick: _ => {
                        const SCENE_NAME = game.settings.get("MapCanvas", "DEFAULT_SCENE");
                        game.scenes.filter(s => s.name.startsWith(SCENE_NAME+"_")).forEach((a) => {
                            game.scenes.get(a.id).delete();
                        });
                    }
                }
            ]

            const hudControl = {
                name: "mapcanvas",
                title: "MapCanvas",
                icon: "fas fa-globe",
                layer: "controls",
                tools: canvasTools,
            }

            controls.push(hudControl);
        }
    }

    openDialog() {
        if (!window['mapcanvas'].dialogActive) { window['mapcanvas'].dialogActive = true } else { return }
        window['mapcanvas'].dialog = new MapDialog({ searchValue: window['mapcanvas'].lastSearch || "Anchorage, AK"});
        window['mapcanvas'].dialog.render(true);
    }

    async handleSceneRequest() {
        MapCanvas.getMapCanvasImage().then(image => {
            MapCanvas.generateScene(image.dataUrl, image.dems);
        });
    };

    async updateScene() {
        MapCanvas.getMapCanvasImage().then(image => {
            const SCENE_NAME = game.settings.get("MapCanvas", "DEFAULT_SCENE");
            const scene = game.scenes.find(s => s.name.startsWith(SCENE_NAME));
            const updates = [
                {
                    _id: scene.id,
                    img: image.dataUrl,
                    bgSource: image.dataUrl,
                    height: 3000,
                    width: 4000,
                    padding: 0.01,
                    gridType: 0
                }
            ]
            console.log(updates);
            Scene.updateDocuments(updates);
        });
    }

    static async getMapCanvasImage() {
        let tempImage = new Image();
        let imageDems = {};
        await html2canvas(document.querySelector("#mapPortal"), { useCORS: true }).then( mapCanvas => {
            // simple hack to get image size from data urls.
            tempImage.onload = (_) => {
                imageDems = { width: _.currentTarget.naturalWidth, height: _.currentTarget.naturalHeight }
            };
            tempImage.src = mapCanvas.toDataURL();
        });

        return { dataUrl: tempImage.src, dems: imageDems} ;
    }


    // Todo: DRY out generateScene() and updateScene() in to a unified method.
    static async generateScene(img, dems) {
        const SCENE_NAME = game.settings.get("MapCanvas", "DEFAULT_SCENE");
        // At some point I could make these options user defined, but for now they're hardcoded.
        const sceneDataOpts = {
            name: SCENE_NAME+"_"+new Date().getTime(),
            img: img,
            bgSource: img,
            height: 3000,
            width: 4000,
            padding: 0.01,
            gridType: 0
        }

        await Scene.create(sceneDataOpts).then(scene => {
            console.log('Generated Scene: ', scene);
        });
    }

    static async registerSettings() {
        await game.settings.register('MapCanvas', 'MAPS_API_KEY', {
            name: 'Google Maps Javascript API Key',
            hint: 'Google how to get a Maps Javascript API Key.',
            scope: 'world',
            config: true,
            type: String,
            default: "",
            filePicker: false,  // set true with a String `type` to use a file picker input
        });
        await game.settings.register('MapCanvas', 'DEFAULT_SCENE', {
            name: 'Default Scene Name',
            hint: 'Used when running canvas updates.',
            scope: 'world',
            config: true,
            type: String,
            default: "MapCanvasScene",
            filePicker: false,
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