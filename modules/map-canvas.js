import {MAP_STYLES} from "./map-canvas-styles.js";
import {ImageDataConverter} from "./image-data-converter.js";

//register updattable properties
Hooks.once('ready', async function() {
    // Register last used scene name setting
    

    // ... other code for your module setup ...
});



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

    static zoneWidth = 0; 
    static zoneHeight = 0; 

    static async updateScenery(){
        let zoom_multipler = 4;
        if (window.screen.height == 2880) {
            zoom_multipler = 8;
        }
        const map_scale = {};
        for (let i = 21; i > 0; i--) {
            map_scale[i] = Math.pow(2, 21 - i) * zoom_multipler;
        }
    
        const USE_STORAGE = game.settings.get("map-canvas", "USE_STORAGE");
        const DEFAULT_SCENE = game.settings.get("map-canvas", "DEFAULT_SCENE");
    
        let sceneName = document.querySelector('#mapCanvasSceneName').value;
        if (!sceneName) {
            sceneName = (generateNewScene) ? DEFAULT_SCENE + "_" + new Date().getTime() : DEFAULT_SCENE;
        }

        // Save the scene name for future use
        game.settings.set("map-canvas", "LAST_USED_SCENE_NAME", sceneName);

        const currentZoom = MapDialog.mapPortal.getZoom();
        sceneName+= " Zoom:" +currentZoom;
        let scene = game.scenes.find(s => s.name.startsWith(sceneName));
    
        if (!scene) {
            // Create our scene if we don't have it.
            await Scene.create({ name: sceneName }).then(s => {
                scene = s;
                ui.notifications.info('Map Canvas | Created scene: ' + sceneName);
            });
    
            const currentZoom = MapDialog.mapPortal.getZoom();
            await scene.update({ "grid.distance": map_scale[currentZoom] }).then(updatedScene => {
                ui.notifications.info("Scene grid updated successfully");
            });
            // Save the current zoom level for future use
            game.settings.set("map-canvas", "LAST_USED_ZOOM", currentZoom);
           
        }
        return scene;
    }

    
    static  async captureSurroundingZones() {

        function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
        document.getElementById('loadingIndicator').style.display = 'block';

        // Disable all buttons
        const buttons = document.querySelectorAll('#mapPortalForm input[type="button"]');
        buttons.forEach(button => button.disabled = true);
    

        let capturedImages = {center:{},left:{},right:{},up:{},down:{}, upleft:{}, upright:{}, downleft:{}, downright:{}};
    
        ui.notifications.info("capturing center image");
        capturedImages.center = await MapCanvas.getMapCanvasImage();
       
        ui.notifications.info("capturing left image");
        await MapDialog.moveToAdjacentZone('left');
        await sleep(2000);
        capturedImages.left = await MapCanvas.getMapCanvasImage();
        
        ui.notifications.info("capturing right image");
        await MapDialog.moveToAdjacentZone('right');
        await sleep(2000);
        await MapDialog.moveToAdjacentZone('right');
        await sleep(2000);
        capturedImages.right = await MapCanvas.getMapCanvasImage();

        ui.notifications.info("capturing up image");
        await MapDialog.moveToAdjacentZone('left');
        await sleep(2000);
        await MapDialog.moveToAdjacentZone('up');
        await sleep(2000);
        capturedImages.up = await MapCanvas.getMapCanvasImage();

        ui.notifications.info("capturing up-left image");
        await MapDialog.moveToAdjacentZone('left');
        await sleep(2000);
        capturedImages.upleft = await MapCanvas.getMapCanvasImage()
        
        ui.notifications.info("capturing up right-image");
        await MapDialog.moveToAdjacentZone('right');
        await sleep(2000);
        await MapDialog.moveToAdjacentZone('right');
        await sleep(2000);
        capturedImages.upright = await MapCanvas.getMapCanvasImage();


        ui.notifications.info("capturing down image");
        await MapDialog.moveToAdjacentZone('left');
        await sleep(2000);
        await MapDialog.moveToAdjacentZone('down');
        await sleep(2000);
        await MapDialog.moveToAdjacentZone('down');
        await sleep(2000);
        capturedImages.down = await MapCanvas.getMapCanvasImage();

        ui.notifications.info("capturing down-right image");
        await MapDialog.moveToAdjacentZone('left');
        await sleep(2000);
        capturedImages.downleft = await MapCanvas.getMapCanvasImage();

        ui.notifications.info("capturing down-left images");
        await MapDialog.moveToAdjacentZone('right');
        await sleep(2000);

        await MapDialog.moveToAdjacentZone('right');
        await sleep(2000);
        capturedImages.downright = await MapCanvas.getMapCanvasImage();
        await MapDialog.moveToAdjacentZone('left');
        await sleep(2000);


    
        ui.notifications.info("stiching image together");
        const stitchedImage = await MapDialog.stitchImages(capturedImages); // Implement the stitching logic

        // Get dimensions from the map element
        var mapElement = document.getElementById('mapPortal');
        var height = mapElement.scrollHeight * 3;
        var width = mapElement.scrollWidth * 3;
   
        let scene = await MapDialog.updateScenery();
        const response = await fetch(stitchedImage);
        const blob = await response.blob();
        // Prepare updates for the scene
        let updates = {
            _id: scene.id,
            img: stitchedImage,
            bgSource: stitchedImage,   
            width: width,
            height: height,
            padding: 0.01,
            gridType: 0
        };
        const USE_STORAGE = game.settings.get("map-canvas", "USE_STORAGE");
        const DEFAULT_SCENE = game.settings.get("map-canvas", "DEFAULT_SCENE");

        if (USE_STORAGE) {
            const fileName = `${DEFAULT_SCENE}_${new Date().getTime()}_BG.png`;
            const tempFile = new File([blob], fileName, {
                type: "image/png",
                lastModified: new Date(),
            });

            // Create directory and upload file
            await FilePicker.createDirectory('user', 'map-canvas').catch(console.error);
            await FilePicker.upload('data', 'map-canvas', tempFile).then((res) => {
                updates.bgSource = res.path;
                updates.img = res.path;
            }).catch(console.error);
        }
        document.getElementById('loadingIndicator').style.display = 'none';
        // Enable all buttons
        buttons.forEach(button => button.disabled = false);

        // Update the scene with new data
        await Scene.updateDocuments([updates]).then(() => {
            ui.notifications.info("Map Canvas | Updated Scene");
        }).catch(console.error);

        return stitchedImage;
    }

    static async stitchImages(capturedImages) {
        const canvasWidth = 4000 * 3; // 3 images horizontally
        const canvasHeight = 3000 * 3; // 3 images vertically
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
    
        await  MapDialog.loadAndPlaceImages(capturedImages, ctx);
        
        let image = new Promise(async (resolve) => {
            canvas.toBlob((blob) => {
                resolve(URL.createObjectURL(blob));
            }, 'image/png');
        });
        return image
    }

    static async loadAndPlaceImages (capturedImages, ctx) {
        await MapDialog.loadImage(capturedImages.upleft, 0, 0, ctx);
        await MapDialog.loadImage(capturedImages.up, 4000, 0, ctx);
        await MapDialog.loadImage(capturedImages.upright, 8000, 0, ctx);
        await MapDialog.loadImage(capturedImages.left, 0, 3000, ctx);
        await MapDialog.loadImage(capturedImages.center, 4000, 3000, ctx);
        await MapDialog.loadImage(capturedImages.right, 8000, 3000, ctx);
        await MapDialog.loadImage(capturedImages.downleft, 0, 6000, ctx);
        await MapDialog.loadImage(capturedImages.down, 4000, 6000, ctx);
        await MapDialog.loadImage(capturedImages.downright, 8000, 6000, ctx);
    };


    static async loadImage (imgData, x, y, ctx)  {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onerror = (error) => {
                console.error('Error loading image:', error);
                reject(error);
            };
            img.onload = () => {
                ctx.drawImage(img, x, y, 4000, 3000);
                resolve();
            };
   
            img.src = imgData.dataUrl;
        });
    };
    
    
    static directionsMoved={left:0, right:0, up:0, down:0}
    static moveToAdjacentZone(direction) {
        const currentCenter = MapDialog.mapPortal.getCenter();
        this.calculateZoneSize();
        let lat = currentCenter.lat();
        let lng = currentCenter.lng();
    
        // Define the movement increment (adjust these values as needed)
        const latIncrement = MapDialog.zoneWidth; // Latitude increment for each movement
        const lngIncrement = MapDialog.zoneHeight; // Longitude increment for each movement

        let longMultiplier = document.querySelector('#mapCanvasLongMult').value;
        let latMultiplier = document.querySelector('#mapCanvasLatMult').value;

        

        switch (direction) {
            case 'left':
                lng -= lngIncrement* longMultiplier;

                break;
            case 'right':
                lng += lngIncrement * longMultiplier;
                break;
            case 'up':
                lat += latIncrement * latMultiplier;

                break;
            case 'down':
                lat -= latIncrement * latMultiplier;
                break;
        }
       
    
        // Pan the map to the new center
        MapDialog.mapPortal.panTo(new google.maps.LatLng(lat, lng));
        const sceneNameElement = document.querySelector('#mapCanvasSceneName');
    }

    static calculateZoneSize = () => {
        const bounds = MapDialog.mapPortal.getBounds();
        const ne = bounds.getNorthEast(); // North East corner
        const sw = bounds.getSouthWest(); // South West corner

        // Calculate zone width and height in terms of latitude and longitude
        MapDialog.zoneWidth = Math.abs(ne.lng() - sw.lng());
        MapDialog.zoneHeight = Math.abs(ne.lat() - sw.lat());

        console.log('Zone Width:', MapDialog.zoneWidth, 'Zone Height:', MapDialog.zoneHeight);
        // Now zoneWidth and zoneHeight hold the lng and lat differences of the visible area
    };  
    static zoneWidth = 0;
    static zoneHeight = 0;

    // 40.7571, -73.8458 - Citi Field, Queens, NY - LET'S GO METS!
    static initMap(center = { lat: 40.7571, lng: -73.8458 }) {
        
        const lastUsedLat = game.settings.get('map-canvas', 'LAST_USED_LAT');
        const lastUsedLng = game.settings.get('map-canvas', 'LAST_USED_LNG');
        if(lastUsedLat && lastUsedLng){
            center = { lat: lastUsedLat, lng: lastUsedLng };
        }


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
           // mapTypeId: google.maps.MapTypeId.SATELLITE,
            styles: this.getMapStyle()
        }

        MapDialog.mapPortal = new google.maps.Map(MapDialog.mapPortalElem, opts);

        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', (e) => {
            MapDialog.zoomLevelElem.value = MapDialog.mapPortal.getZoom();
        });
        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', (e) => {
            MapDialog.zoomLevelElem.value = MapDialog.mapPortal.getZoom();
        });
    
        // Set the last used zoom level and scene name
        const lastUsedZoom = game.settings.get("map-canvas", "LAST_USED_ZOOM");
        if (lastUsedZoom) {
            MapDialog.mapPortal.setZoom(lastUsedZoom);
            MapDialog.zoomLevelElem.value = lastUsedZoom;
        }
    
        const sceneNameElement = document.querySelector('#mapCanvasSceneName');
        const lastUsedSceneName = game.settings.get("map-canvas", "LAST_USED_SCENE_NAME");
        if (lastUsedSceneName) {
            
            if (sceneNameElement) {
                sceneNameElement.value = lastUsedSceneName;
            }
        }


        MapDialog.searchBoxElem.addEventListener('input', (event) => {
            // For demonstration, directly using the search input value
            // You can replace this with more complex logic as needed
            sceneNameElement.value = event.target.value;
        });

        
        MapDialog.placesService = new google.maps.places.PlacesService(MapDialog.mapPortal);

        MapDialog.initAutocomplete(MapDialog.mapPortal, MapDialog.searchBoxElem);

        google.maps.event.addListener(MapDialog.mapPortal, 'center_changed', () => {
            const newCenter = MapDialog.mapPortal.getCenter();
            game.settings.set('map-canvas', 'LAST_USED_LAT', newCenter.lat());
            game.settings.set('map-canvas', 'LAST_USED_LNG', newCenter.lng());
        });

        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', () => {
            const newZoom = MapDialog.mapPortal.getZoom();
            game.settings.set('map-canvas', 'LAST_USED_ZOOM', newZoom);
        });
        google.maps.event.addListenerOnce(MapDialog.mapPortal, 'idle', () => {
        const bounds = MapDialog.mapPortal.getBounds();
        const ne = bounds.getNorthEast(); // North East corner
        const sw = bounds.getSouthWest(); // South West corner

        //google.maps.event.addListenerOnce(MapDialog.mapPortal, 'idle', MapDialog.calculateZoneSize);
        //google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', MapDialog.calculateZoneSize);
    
        });

        let previousWindowHeight = window.innerHeight;

        function adjustMapPortalHeight() {
            var windowHeight = window.innerHeight;
            var mapPortal = document.getElementById('mapPortal');
        
            // Check if the window height has changed
            if (windowHeight !== previousWindowHeight) {
                mapPortal.style.height = Math.min(windowHeight * 0.75, windowHeight) + 'px';
                previousWindowHeight = windowHeight;
            }
        }
        
        // Call the function initially
        adjustMapPortalHeight();
        
        // Set an interval to check for window resize every 500 milliseconds
        setInterval(adjustMapPortalHeight, 500);

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
            if (places.length > 0 && places[0].geometry && places[0].geometry.location) {
                // Save the new location
                const newCenter = places[0].geometry.location;
                game.settings.set('map-canvas', 'LAST_USED_LAT', newCenter.lat());
                game.settings.set('map-canvas', 'LAST_USED_LNG', newCenter.lng());
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
        document.getElementById('mapCanvasUpdateScene').addEventListener('click', () => MapCanvas.updateScene(false));
        document.getElementById('mapCanvasGenerateScene').addEventListener('click', () => MapCanvas.updateScene(true));
        document.getElementById('mapCanvasToggleLabels').addEventListener('click', () => this.toggleLabels());
        document.getElementById('mapCanvasMaximize').addEventListener('click', () => this.maximizeDialog());
        document.getElementById('mapCanvasMoveLeft').addEventListener('click', () => MapDialog.moveToAdjacentZone('left'));
        document.getElementById('mapCanvasMoveRight').addEventListener('click', () => MapDialog.moveToAdjacentZone('right'));
        document.getElementById('mapCanvasMoveUp').addEventListener('click', () => MapDialog.moveToAdjacentZone('up'));
        document.getElementById('mapCanvasMoveDown').addEventListener('click', () => MapDialog.moveToAdjacentZone('down'));
        document.getElementById('mapCanvasGenerateExpandedScene').addEventListener('click', () => MapDialog.captureSurroundingZones());
        
    
    }

    maximizeDialog() {
        this.element.css({
            height: '100vh',
            width: '100vw',
            top: 0,
            left: 0
        });
    }

    async _updateObject(event, formData) {
        // TODO: Rethink / Reimplement how we can properly rehydrate a dialog box where users last left it.
        window['mapcanvas'].lastSearch = formData.mapCanvasSearchBox
        this.object = { searchValue: formData.mapCanvasSearchBox, portalActive: true };
        this.element.css({
            height: '100vh',

            top: 0,
            left: 0
        });

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
        Hooks.on('mapCanvasGenerateScene', () => MapCanvas.updateScene(true));
        Hooks.on('mapCanvasUpdateScene', MapCanvas.updateScene);

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
        if (!window['mapcanvas'].dialogActive) { 
            window['mapcanvas'].dialogActive = true;
        } else { 
            return;
        }
    
        window['mapcanvas'].dialog = new MapDialog();
        window['mapcanvas'].dialog.render(true);
    
        // Set the last used scene name and zoom in the dialog box when UI is opened
    }
    
    
    static async updateScene(generateNewScene = false) {
        let zoom_multipler = 4;
        if (window.screen.height === 2880) {
            zoom_multipler = 8;
        }
        const map_scale = {};
        for (let i = 21; i > 0; i--) {
            map_scale[i] = Math.pow(2, 21 - i) * zoom_multipler;
        }
        const DEFAULT_SCENE = game.settings.get("map-canvas", "DEFAULT_SCENE");
    
        let sceneName = document.querySelector('#mapCanvasSceneName').value;
        if (!sceneName) {
            sceneName = (generateNewScene) ? DEFAULT_SCENE + "_" + new Date().getTime() : DEFAULT_SCENE;
        }

        // Save the scene name for future use
        game.settings.set("map-canvas", "LAST_USED_SCENE_NAME", sceneName);

        const currentZoom = MapDialog.mapPortal.getZoom();
        sceneName+= " Zoom:" +currentZoom;
        let scene = game.scenes.find(s => s.name.startsWith(sceneName));
    
        if (!scene) {
            // Create our scene if we don't have it.
            await Scene.create({ name: sceneName }).then(s => {
                scene = s;
                ui.notifications.info('Map Canvas | Created scene: ' + sceneName);
            });
    
            const currentZoom = MapDialog.mapPortal.getZoom();
            await scene.update({ "grid.distance": map_scale[currentZoom] }).then(updatedScene => {
                ui.notifications.info("Scene grid updated successfully");
            });
            // Save the current zoom level for future use
            game.settings.set("map-canvas", "LAST_USED_ZOOM", currentZoom);
           
        }
    
    

        await MapCanvas.getMapCanvasImage().then(async (image) => {
            const USE_STORAGE = game.settings.get("map-canvas", "USE_STORAGE");
            const DEFAULT_SCENE = game.settings.get("map-canvas", "DEFAULT_SCENE");

            // TODO: Make some of these user-definable. Perhaps leveraging Scene.createDialog().
            MapDialog.calculateZoneSize();
            var mapElement = document.getElementById('mapPortal');
            // Getting the scrollHeight and scrollWidth
            var height = mapElement.scrollHeight;
            var width = mapElement.scrollWidth;


            let updates = {
                _id: scene.id,
                img: image.dataUrl,
                bgSource: image.dataUrl,   
                width: width,
                //width: 4000,
                height: height,
               // height: 3000,
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
                console.log(e);
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
        const mapPortal = document.getElementById('mapPortal');
    
        // Remove controls before taking map capture
        MapDialog.mapPortal.setOptions({ disableDefaultUI: true });
        await sleep(100); // Wait for map to update view
    
    
        let tempImage = new Image();
        let imageDems = {};
    
        // Capture the map image
        function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
        
        await html2canvas(document.querySelector("#mapPortal"), { useCORS: true }).then(mapCanvas => {
            tempImage.onload = (_) => {
                imageDems = { width: _.currentTarget.naturalWidth, height: _.currentTarget.naturalHeight };
            };
            tempImage.src = mapCanvas.toDataURL();
        });
    
      
        MapDialog.mapPortal.setOptions({ disableDefaultUI: false });
       
    
        return { dataUrl: tempImage.src, dems: imageDems };
    }
    
    static async registerSettings() {
        game.settings.register('map-canvas', 'LAST_USED_SCENE_NAME', {
            name: 'Last Used Scene Name',
            hint: 'Stores the last used scene name for the map canvas.',
            scope: 'client', // This specifies that the setting is stored for each individual user.
            config: false, // This specifies that the setting does not appear in the settings menu.
            type: String,
            default: ''
        });
    
        // Register last used zoom setting
        game.settings.register('map-canvas', 'LAST_USED_ZOOM', {
            name: 'Last Used Zoom Level',
            hint: 'Stores the last used zoom level for the map canvas.',
            scope: 'client',
            config: false,
            type: Number,
            default: 1 // Default zoom level, adjust as needed
        });
        // Register setting for latitude
        game.settings.register('map-canvas', 'LAST_USED_LAT', {
            name: 'Last Used Latitude',
            scope: 'client',
            config: false,
            type: Number,
            default: 40.7571, // Default latitude, adjust as needed
        });
    
        // Register setting for longitude
        game.settings.register('map-canvas', 'LAST_USED_LNG', {
            name: 'Last Used Longitude',
            scope: 'client',
            config: false,
            type: Number,
            default: -73.8458, // Default longitude, adjust as needed
        });
        await game.settings.register('map-canvas', 'MAPS_API_KEY', {
            name: 'Google Maps Javascript API Key',
            hint: 'Google how to get a Maps Javascript API Key.',
            scope: 'world',
            config: true,
            type: String,
            filePicker: false,
            default: "",
        });

        await game.settings.register('map-canvas', 'DEFAULT_SCENE', {
            name: 'Default Scene Name',
            hint: 'Used when running canvas updates.',
            scope: 'world',
            config: true,
            type: String,
            filePicker: false,
            default: "MapCanvasScene",
        });

        await game.settings.register('map-canvas', 'USE_STORAGE', {
            name: 'Store Images [Experimental]',
            hint: 'Stores images instead of embedding them in the scene document, should speed up image propagation.',
            scope: 'world',
            config: true,
            type: Boolean,
            filePicker: false,
            default: false,
        });

        await game.settings.register('map-canvas', 'DEFAULT_MAP_MODE', {
            name: 'Default Map Mode',
            hint: 'Determines what display mode loads by default when opening the map dialog.',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                HYBRID: "HYBRID",
                ROADMAP: "ROADMAP",
                SATELLITE: "SATELLITE",
                TERRAIN: "TERRAIN",
            },
            default: "HYBRID"
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
            default: "Standard"
        });

        await game.settings.register('map-canvas', "CUSTOM_MAP_STYLE_JSON", {
            name: 'Custom Map Styling JSON',
            hint: 'Optional: Used when selecting \'Custom\' from the styles drop down.',
            scope: 'world',
            config: true,
            type: String,
            default: ""
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