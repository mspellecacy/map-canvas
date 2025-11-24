import {MAP_STYLES} from "./map-canvas-styles.js";
import {ImageDataConverter} from "./image-data-converter.js";

const MAP_CANVAS_STATE = {
    dialogActive: false,
    apiLoaded: false,
    mapInitialized: false,
    dialog: null
};

if (typeof window !== "undefined") {
    window.mapcanvas = MAP_CANVAS_STATE;
}

// Prefer ApplicationV2 when available (Foundry v13+), fall back to FormApplication for older versions
const __MC_AppV2 = (globalThis.foundry?.applications?.api?.ApplicationV2) ?? null;
const __MC_Handlebars = (globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin) ?? null;
const __MC_USE_V2 = !!(__MC_AppV2 && __MC_Handlebars);
const __MC_BaseApp = __MC_USE_V2 ? __MC_Handlebars(__MC_AppV2) : FormApplication;

class MapDialog extends __MC_BaseApp {

    constructor(object, options) {
        // ApplicationV2 expects only an options object; FormApplication expects (object, options)
        if (__MC_USE_V2) {
            super(options);
        } else {
            super(object, options);
        }

        MAP_CANVAS_STATE.dialogActive = true;
        MAP_CANVAS_STATE.dialog = this;

        // Initialization of Google Maps is ensured after render when DOM exists.
        Hooks.on('mapCanvasToggleLabels', MapDialog.toggleLabels);
        MapDialog.labelsOn = true;
    }

    // v13+ ApplicationV2 configuration
    static DEFAULT_OPTIONS = __MC_USE_V2 ? {
        id: "mapCanvasDialog-{id}",
        tag: "div",
        window: {
            frame: true,
            positioned: true,
            title: "Map Canvas",
            icon: "",
            minimizable: true,
            resizable: true,
            contentTag: "section",
            contentClasses: []
        },
        actions: {},
        form: {
            handler: undefined,
            submitOnChange: false,
            closeOnSubmit: false
        },
        position: {
            // Default spawn size 830x660 for ApplicationV2
            width: 830,
            height: 660
        }
    } : undefined;

    // Handlebars template parts for V2
    static PARTS = __MC_USE_V2 ? {
        root: {
            template: "modules/map-canvas/templates/map-canvas.html",
            id: "root",
            root: true,
            scrollable: [""]
        }
    } : undefined;

    // Backwards-compat defaultOptions for FormApplication (v9–v12)
    static get defaultOptions() {
        if (__MC_USE_V2) return super.defaultOptions ?? {};
        let opts = super.defaultOptions;
        opts.id = "mapCanvasDialog";
        opts.base = "mc_";
        opts.title = "Map Canvas";
        opts.template = "modules/map-canvas/templates/map-canvas.html";
        opts.resizable = true;
        opts.isEditable = false;
        opts.closeOnSubmit = false;
        opts.popOut = true;
        // Default spawn size 830x660 on legacy Application API
        opts.width = 830;
        opts.height = 660;
        return opts;
    }

    // Title accessor used by ApplicationV2 window title resolution
    get title() { return "Map Canvas"; }

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
            scaleControl: false,
            disableDefaultUI: true, // Replace Google's controls with our own
            streetViewControl: false, // TODO: Figure out how to make Street View capture properly.
            mapTypeId: google.maps.MapTypeId[game.settings.get("map-canvas", "DEFAULT_MAP_MODE")],
           // mapTypeId: google.maps.MapTypeId.SATELLITE,
            styles: this.getMapStyle()
        }

        MapDialog.mapPortal = new google.maps.Map(MapDialog.mapPortalElem, opts);

        // Move our existing inputs and action buttons into Google Maps Custom Controls
        try {
            const inputHolder = document.getElementById('inputHolder');
            if (inputHolder && MapDialog.mapPortal?.controls) {
                // Ensure interactions are allowed for our overlay controls
                inputHolder.style.pointerEvents = 'auto';
                // Place the whole toolbar as a single control to preserve its layout and styling
                MapDialog.mapPortal.controls[google.maps.ControlPosition.TOP_CENTER].push(inputHolder);
            }
        } catch (e) {
            console.warn('map-canvas: failed to attach custom controls to Google Maps', e);
        }

        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', () => {
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

    static setLoadingState(isVisible) {
        const indicator = document.getElementById('loadingIndicator');
        if (!indicator) return;
        indicator.classList.toggle('is-visible', Boolean(isVisible));
        indicator.setAttribute('aria-busy', Boolean(isVisible));
    }

    static toggleLabels() {
        // When viewing vector map types (e.g., ROADMAP), we can toggle labels via styles.
        // For satellite imagery, Google provides two types: SATELLITE (no labels) and HYBRID (with labels).
        // In satellite domain, switch the mapTypeId between SATELLITE and HYBRID to emulate label toggling.
        try {
            const mt = MapDialog.mapPortal.getMapTypeId?.();
            const isSatelliteDomain = (mt === google.maps.MapTypeId.SATELLITE) || (mt === google.maps.MapTypeId.HYBRID);

            if (isSatelliteDomain) {
                // Toggle between SATELLITE (labels off) and HYBRID (labels on)
                if (MapDialog.labelsOn) {
                    // Turn labels off
                    MapDialog.mapPortal.setOptions({ styles: null });
                    MapDialog.mapPortal.setMapTypeId(google.maps.MapTypeId.SATELLITE);
                    MapDialog.labelsOn = false;
                } else {
                    // Turn labels on
                    MapDialog.mapPortal.setOptions({ styles: null });
                    MapDialog.mapPortal.setMapTypeId(google.maps.MapTypeId.HYBRID);
                    MapDialog.labelsOn = true;
                }
            } else {
                // ROADMAP/TERRAIN/etc.: toggle using style sets
                if (MapDialog.labelsOn) {
                    MapDialog.mapPortal.set('styles', MAP_STYLES.LABELS_OFF);
                    MapDialog.labelsOn = false;
                } else {
                    MapDialog.mapPortal.set('styles', MAP_STYLES.LABELS_ON);
                    MapDialog.labelsOn = true;
                }
            }
        } catch (e) {
            console.warn('map-canvas: toggleLabels failed', e);
        }

    }

    getData(options = {}) {
        // In ApplicationV2 there is no getData pattern; template is static.
        if (__MC_USE_V2) return {};
        // FormApplication provides getData which returns an object containing {object, ...}
        try {
            return super.getData()?.object ?? {};
        } catch (e) {
            return {};
        }
    }

    async activateListeners(html) {
        // Only used by FormApplication (v1 API). For V2, listeners are wired in _onRender.
        if (!__MC_USE_V2) {
            super.activateListeners(html);
            console.log('map-canvas: MapDialog.activateListeners (v1)');
            await this.ensureMapsApiAndInit();
            this.#wireEventHandlers();
        }
    }

    // ApplicationV2: called after the application has rendered and DOM is ready
    async _onRender(context, options) {
        if (__MC_USE_V2) {
            await super._onRender?.(context, options);
            console.log('map-canvas: MapDialog._onRender (v2)');
            await this.ensureMapsApiAndInit();
            this.#wireEventHandlers();
        }
    }

    // Private helper to wire up button clicks
    #wireEventHandlers() {
        const addClick = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler, { passive: true });
        };
        // Zoom controls (custom, replacing Google's)
        addClick('mapCanvasZoomIn', () => {
            try {
                const curr = MapDialog.mapPortal.getZoom?.() ?? 0;
                MapDialog.mapPortal.setZoom?.(curr + 1);
            } catch (e) { console.warn('map-canvas: zoom in failed', e); }
        });
        addClick('mapCanvasZoomOut', () => {
            try {
                const curr = MapDialog.mapPortal.getZoom?.() ?? 0;
                MapDialog.mapPortal.setZoom?.(curr - 1);
            } catch (e) { console.warn('map-canvas: zoom out failed', e); }
        });
        // Map/Satellite toggle
        addClick('mapCanvasToggleMapType', () => {
            try {
                const mt = MapDialog.mapPortal.getMapTypeId?.();
                const isSatelliteDomain = (mt === google.maps.MapTypeId.SATELLITE) || (mt === google.maps.MapTypeId.HYBRID);

                if (isSatelliteDomain) {
                    // Switch back to ROADMAP and re-apply label styling based on current label state
                    MapDialog.mapPortal.setMapTypeId(google.maps.MapTypeId.ROADMAP);
                    MapDialog.mapPortal.set('styles', MapDialog.labelsOn ? MAP_STYLES.LABELS_ON : MAP_STYLES.LABELS_OFF);
                } else {
                    // Enter satellite domain; clear styles and pick HYBRID (labels) or SATELLITE (no labels)
                    MapDialog.mapPortal.setOptions({ styles: null });
                    const next = MapDialog.labelsOn ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.SATELLITE;
                    MapDialog.mapPortal.setMapTypeId(next);
                }
            } catch (e) { console.warn('map-canvas: toggle map type failed', e); }
        });
        addClick('mapCanvasUpdateScene', () => MapCanvas.updateScene(false));
        addClick('mapCanvasGenerateScene', () => MapCanvas.updateScene(true));
        addClick('mapCanvasToggleLabels', () => MapDialog.toggleLabels());
        addClick('mapCanvasMaximize', () => this.maximizeDialog());
        // Guards for potential future controls
        addClick('mapCanvasMoveLeft', () => MapDialog.moveToAdjacentZone?.('left'));
        addClick('mapCanvasMoveRight', () => MapDialog.moveToAdjacentZone?.('right'));
        addClick('mapCanvasMoveUp', () => MapDialog.moveToAdjacentZone?.('up'));
        addClick('mapCanvasMoveDown', () => MapDialog.moveToAdjacentZone?.('down'));
        addClick('mapCanvasGenerateExpandedScene', () => MapDialog.captureSurroundingZones?.());
    }

    async ensureMapsApiAndInit() {
        try {
            const MAPS_API_KEY = game.settings.get('map-canvas', 'MAPS_API_KEY');
            if (!MAP_CANVAS_STATE.apiLoaded) {
                await $.getScript('https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=default');
                await $.getScript('https://maps.googleapis.com/maps/api/js?libraries=places&v=weekly&key=' + MAPS_API_KEY);
                MAP_CANVAS_STATE.apiLoaded = true; // Assume load succeeded if no exception
                console.log('map-canvas: Google Maps API loaded');
            }
            if (!MAP_CANVAS_STATE.mapInitialized) {
                MapDialog.initMap();
                MAP_CANVAS_STATE.mapInitialized = true;
                console.log('map-canvas: Map initialized');
            }
        } catch (e) {
            console.error('map-canvas: Failed to load Google Maps API or initialize map', e);
        }
    }

    async _updateObject(event, formData) {
        // Legacy FormApplication submit handler (not used by V2)
        if (__MC_USE_V2) return;
        // TODO: Rethink / Reimplement how we can properly rehydrate a dialog box where users last left it.
        MAP_CANVAS_STATE.lastSearch = formData.mapCanvasSearchBox;
        this.object = { searchValue: formData.mapCanvasSearchBox, portalActive: true };
        // jQuery element is available in v1 Application only
        try {
            this.element?.css?.({
                height: '100vh',
                top: 0,
                left: 0
            });
        } catch (e) {
            // noop
        }
    }

    async close() {
        Hooks.off('mapCanvasToggleLabels', MapDialog.toggleLabels);
        MAP_CANVAS_STATE.dialogActive = false;
        MAP_CANVAS_STATE.dialog = null;
        MAP_CANVAS_STATE.mapInitialized = false;
        await super.close?.();
    }

    // Convenience for the Maximize button
    async maximizeDialog() {
        try {
            if (typeof this.maximize === 'function') await this.maximize();
        } catch (e) {
            console.warn('map-canvas: maximizeDialog failed', e);
        }
    }
}

class MapCanvas extends Application {

    constructor(object, options) {
        super(object, options)

        MAP_CANVAS_STATE.dialogActive = false;
        MAP_CANVAS_STATE.dialog = null;
        window.mapCanvasState = MAP_CANVAS_STATE;
        // Expose the instance for event handlers defined outside of this class scope
        window.mapCanvasInstance = this;

        // MapCanvas.loadHtml2Canvas();

        Hooks.on("getSceneControlButtons", (controls) => this.addControls(controls));

        // Defensive: Intercept clicks on the tool by delegating to the document.
        // This ensures the button works even if Foundry changes the expected tool callback prop.
        Hooks.on('renderSceneControls', () => {
            try {
                $(document).off('.mapcanvas');
                const sel = [
                    '[data-tool="mapdialog"]',
                    '[data-action="mapdialog"]',
                    'li.control-tool[data-tool="mapdialog"]',
                    'li.control-tool[data-action="mapdialog"]',
                    'li.control-tool[title="Open Map Dialog"]',
                    'button.control-tool[data-tool="mapdialog"]',
                    'button[data-tool="mapdialog"]',
                    'button[title="Open Map Dialog"]',
                    'a.control-tool[data-tool="mapdialog"]'
                ].join(',');
                $(document).on('click.mapcanvas', sel, (ev) => {
                    console.log("map-canvas: delegated handler (click) fired for 'mapdialog'", ev.currentTarget);
                    window.mapCanvasInstance?.openDialog?.();
                });
                $(document).on('pointerdown.mapcanvas', sel, (ev) => {
                    console.log("map-canvas: delegated handler (pointerdown) fired for 'mapdialog'", ev.currentTarget);
                    // Only act on primary button
                    if (ev.button === 0) window.mapCanvasInstance?.openDialog?.();
                });
            } catch (e) {
                console.error('map-canvas: failed to bind delegated click handler', e);
            }
        });

        // Also bind once at ready as a fallback, in case renderSceneControls doesn't fire as expected.
        Hooks.once('ready', () => {
            try {
                $(document).off('.mapcanvas');
                const sel = [
                    '[data-tool="mapdialog"]',
                    '[data-action="mapdialog"]',
                    'li.control-tool[data-tool="mapdialog"]',
                    'li.control-tool[data-action="mapdialog"]',
                    'li.control-tool[title="Open Map Dialog"]',
                    'button.control-tool[data-tool="mapdialog"]',
                    'button[data-tool="mapdialog"]',
                    'button[title="Open Map Dialog"]',
                    'a.control-tool[data-tool="mapdialog"]'
                ].join(',');
                $(document).on('click.mapcanvas', sel, (ev) => {
                    console.log("map-canvas: delegated handler (ready click) fired for 'mapdialog'", ev.currentTarget);
                    window.mapCanvasInstance?.openDialog?.();
                });
                $(document).on('pointerdown.mapcanvas', sel, (ev) => {
                    console.log("map-canvas: delegated handler (ready pointerdown) fired for 'mapdialog'", ev.currentTarget);
                    if (ev.button === 0) window.mapCanvasInstance?.openDialog?.();
                });

                // Capture-phase listeners to bypass stopPropagation from core
                const captureHandler = (ev) => {
                    try {
                        const target = ev.target;
                        if (!target) return;
                        const match = target.closest(sel);
                        if (match) {
                            console.log('map-canvas: capture handler fired for mapdialog', match);
                            window.mapCanvasInstance?.openDialog?.();
                        }
                    } catch (e) {
                        console.error('map-canvas: capture handler error', e);
                    }
                };
                // Store refs so we could remove later if needed
                window.__mapcanvasCaptureHandlers = window.__mapcanvasCaptureHandlers || [];
                document.addEventListener('click', captureHandler, true);
                document.addEventListener('pointerdown', captureHandler, true);
                window.__mapcanvasCaptureHandlers.push(captureHandler);
            } catch (e) {
                console.error('map-canvas: failed to bind delegated click handler at ready', e);
            }
        });

        // Register our settings
        Hooks.once('init', () => {
            MapCanvas.registerSettings().then(() => console.log("MapCanvas Settings Registered."));
            try {
                game.keybindings.register('map-canvas', 'open-dialog', {
                    name: 'Map Canvas: Open Dialog',
                    hint: 'Open the Map Canvas dialog',
                    editable: [
                        { key: 'M', modifiers: ['ALT'] }
                    ],
                    restricted: true,
                    onDown: () => {
                        console.log('map-canvas: keybinding fired (Alt+M)');
                        window.mapCanvasInstance?.openDialog?.();
                        return true;
                    }
                });
            } catch (e) {
                console.warn('map-canvas: failed to register keybinding (non-fatal)', e);
            }
        });
    }

    addControls(controls) {
        if (game.user.isGM) {

            const canvasTools = [
                {
                    // "active" is not needed for plain buttons in v13
                    name: "mapdialog",
                    title: "Open Map Dialog",
                    icon: "fas fa-map-marker-alt",
                    button: true,
                    // In v13, tools should be either a button or a toggle – not both.
                    // Use a plain button so the onClick fires reliably.
                    toggle: false,
                    visible: true,
                    onClick: () => {
                        console.log("map-canvas: 'Open Map Dialog' clicked");
                        // Use the global instance to avoid any context issues
                        if (window?.mapCanvasInstance?.openDialog) return window.mapCanvasInstance.openDialog();
                        if (typeof mapCanvas !== 'undefined' && mapCanvas.openDialog) return mapCanvas.openDialog();
                        try { this.openDialog(); } catch (e) { console.error('map-canvas: openDialog() failed from tool click', e); }
                    },
                    // Some cores use `callback` for buttons; provide it as well
                    callback: () => {
                        console.log("map-canvas: 'Open Map Dialog' callback fired");
                        if (window?.mapCanvasInstance?.openDialog) return window.mapCanvasInstance.openDialog();
                        if (typeof mapCanvas !== 'undefined' && mapCanvas.openDialog) return mapCanvas.openDialog();
                        try { this.openDialog(); } catch (e) { console.error('map-canvas: openDialog() failed from tool callback', e); }
                    },
                    // Extremely defensive: some modules used `onclick` lowercase historically
                    onclick: () => {
                        console.log("map-canvas: 'Open Map Dialog' onclick fired");
                        if (window?.mapCanvasInstance?.openDialog) return window.mapCanvasInstance.openDialog();
                        if (typeof mapCanvas !== 'undefined' && mapCanvas.openDialog) return mapCanvas.openDialog();
                        try { this.openDialog(); } catch (e) { console.error('map-canvas: openDialog() failed from tool onclick', e); }
                    }
                },
                {
                    // "active" is not needed for plain buttons in v13
                    name: "purgetemp",
                    title: "Purge Generated Scenes",
                    icon: "fas fa-backspace",
                    button: true,
                    toggle: false,
                    visible: true,
                    onClick: () => {
                        console.log("map-canvas: 'Purge Generated Scenes' clicked");
                        const SCENE_NAME = game.settings.get("map-canvas", "DEFAULT_SCENE");
                        game.scenes.filter(s => s.name.startsWith(SCENE_NAME+"_")).forEach((a) => {
                            game.scenes.get(a.id).delete();
                        });
                    },
                    callback: () => {
                        console.log("map-canvas: 'Purge Generated Scenes' callback fired");
                        const SCENE_NAME = game.settings.get("map-canvas", "DEFAULT_SCENE");
                        game.scenes.filter(s => s.name.startsWith(SCENE_NAME+"_")).forEach((a) => {
                            game.scenes.get(a.id).delete();
                        });
                    },
                    onclick: () => {
                        console.log("map-canvas: 'Purge Generated Scenes' onclick fired");
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
                visible: true,
                tools: canvasTools,
            }

            // Foundry v12 provided an Array here; v13 provides a plain object whose
            // keys are control set names. Support both shapes.
            try {
                if (Array.isArray(controls)) {
                    controls.push(hudControl);
                } else if (controls && Array.isArray(controls.controls)) {
                    // Some versions expose the array under `controls`
                    controls.controls.push(hudControl);
                } else if (controls && Array.isArray(controls.tools)) {
                    // Fallback: if tools array is provided directly
                    controls.tools.push(hudControl);
                } else if (controls && typeof controls === 'object') {
                    // v13-style object map of control groups
                    controls[hudControl.name] = hudControl;
                } else {
                    console.warn("map-canvas: Unexpected controls structure in getSceneControlButtons hook; skipping control injection.", controls);
                }
                console.log("map-canvas: Scene Controls injected (mapcanvas)");
            } catch (e) {
                console.error("map-canvas: Failed to add scene control: ", e);
            }
        }
    }

    openDialog() {
        console.log("map-canvas: openDialog() invoked");
        if (MAP_CANVAS_STATE.dialogActive) { 
            console.log("map-canvas: dialog already active; skipping new render");
            return;
        }
        MAP_CANVAS_STATE.dialogActive = true;
    
        try {
            MAP_CANVAS_STATE.dialog = new MapDialog();
        } catch (e) {
            console.error("map-canvas: Failed to construct MapDialog", e);
            MAP_CANVAS_STATE.dialogActive = false;
            return;
        }
        // Render depending on the underlying Application API version
        try {
            if ((globalThis.foundry?.applications?.api?.ApplicationV2)) {
                // ApplicationV2 signature uses an options object; {force:true} focuses and brings to front
                MAP_CANVAS_STATE.dialog.render({ force: true });
            } else {
                // FormApplication signature expects boolean force
                MAP_CANVAS_STATE.dialog.render(true);
            }
        } catch (e) {
            console.error('map-canvas: failed to render MapDialog', e);
        }
    
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
        sceneName += " Zoom:" +currentZoom;
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

            console.log("Scene:", scene);
        }

        MapDialog.setLoadingState(true);
        try {
            const image = await MapCanvas.getMapCanvasImage();
            const USE_STORAGE = game.settings.get("map-canvas", "USE_STORAGE");
            const DEFAULT_SCENE = game.settings.get("map-canvas", "DEFAULT_SCENE");
            const width = image?.dems?.width || 4000;
            const height = image?.dems?.height || 3000;

            let updates = {
                _id: scene.id,
                background: { src: image.dataUrl },
                width,
                height,
                padding: 0.01,
                "grid.type": GRIDLESS_TYPE,
                "grid.alpha": 0
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
                    console.log("UploadRes:", res)
                    updates.background = { src: res.path };
                });

            }

            console.log("Image: ", updates);

            await Scene.updateDocuments([updates]).then(() => {
                ui.notifications.info(" Map Canvas | Updated Scene: " + sceneName)
            });
        } finally {
            MapDialog.setLoadingState(false);
        }
    }

    // TODO: Kinda violates single-responsibility principle, method should be moved to the MapDialog class.
    static async getMapCanvasImage() {
        const target = document.querySelector('#mapPortal');
        if (!target) {
            throw new Error('map-canvas: Unable to locate #mapPortal for capture');
        }

        const bounds = target.getBoundingClientRect();
        const preferHtml2Canvas = MapCanvas.shouldUseHtml2Canvas(bounds);

        // Hide our custom toolbar and loading overlay before taking the capture
        const toolbar = document.getElementById('inputHolder');
        const loader = document.getElementById('loadingIndicator');
        const prevToolbarDisplay = toolbar?.style?.display;
        const prevLoaderDisplay = loader?.style?.display;
        const filter = (node) => {
            try {
                if (!node) return true;
                if (node.id === 'inputHolder') return false;
                if (typeof node.closest === 'function' && node.closest('#inputHolder')) return false;
            } catch (_) { /* noop */ }
            return true;
        };
        const restoreUi = () => {
            try {
                MapDialog.mapPortal?.setOptions({ disableDefaultUI: true });
                if (toolbar) toolbar.style.display = prevToolbarDisplay ?? '';
                if (loader) loader.style.display = prevLoaderDisplay ?? '';
            } catch (_) { /* noop */ }
        };

        function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

        try {
            if (toolbar) toolbar.style.display = 'none';
            if (loader) loader.style.display = 'none';
        } catch (_) { /* noop */ }
        MapDialog.mapPortal?.setOptions({ disableDefaultUI: true });
        await sleep(100); // Wait for map to update view

        let useHtml2Canvas = preferHtml2Canvas;
        let dataUrl;
        let imageDems;

        if (!useHtml2Canvas) {
            try {
                await MapCanvas.loadHtmlToImage();
                const htmlToImage = window.htmlToImage;
                if (!htmlToImage?.toPng) {
                    throw new Error('map-canvas: html-to-image failed to load');
                }
                dataUrl = await htmlToImage.toPng(target, {
                    cacheBust: true,
                    filter
                });
                imageDems = await MapCanvas.decodeImageDimensions(dataUrl);
            } catch (err) {
                console.warn('map-canvas: html-to-image capture failed, falling back to html2canvas', err);
                useHtml2Canvas = true;
            }
        }

        if (useHtml2Canvas) {
            await MapCanvas.loadHtml2Canvas();
            const html2canvas = window.html2canvas;
            if (typeof html2canvas !== 'function') {
                restoreUi();
                throw new Error('map-canvas: html2canvas failed to load');
            }
            const canvas = await html2canvas(target, {
                useCORS: true,
                backgroundColor: null,
                logging: false,
                scale: 1, // prevent fractional tile joins that show white seams on large captures
                ignoreElements: (node) => !filter(node)
            });
            dataUrl = canvas.toDataURL();
            imageDems = { width: canvas.width, height: canvas.height };
        }

        restoreUi();
        return { dataUrl, dems: imageDems };
    }

    static shouldUseHtml2Canvas(bounds) {
        const pixelRatio = window.devicePixelRatio || 1;
        const maxDimension = Math.max(bounds.width, bounds.height) * pixelRatio;
        // html-to-image relies on foreignObject which breaks with extremely large translations/dimensions.
        // Empirically, keep it under ~1600px to avoid the repeating tile artefact shown in wide captures.
        const FOREIGN_OBJECT_SAFE_LIMIT = 1600;
        return maxDimension > FOREIGN_OBJECT_SAFE_LIMIT;
    }

    static async decodeImageDimensions(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height
            });
            image.onerror = (err) => reject(err);
            image.src = dataUrl;
            if (typeof image.decode === 'function') {
                image.decode().catch((err) => reject(err));
            }
        });
    }
    
    static loadHtmlToImage() {
        if (!MapCanvas.htmlToImagePromise) {
            MapCanvas.htmlToImagePromise = new Promise((resolve, reject) => {
                $.getScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js')
                    .done(() => resolve())
                    .fail((_, __, exception) => {
                        const error = exception || new Error('Failed to load html-to-image');
                        reject(error);
                    });
            });
        }
        return MapCanvas.htmlToImagePromise;
    }

    static loadHtml2Canvas() {
        if (!MapCanvas.html2CanvasPromise) {
            MapCanvas.html2CanvasPromise = new Promise((resolve, reject) => {
                $.getScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
                    .done(() => resolve())
                    .fail((_, __, exception) => {
                        const error = exception || new Error('Failed to load html2canvas');
                        reject(error);
                    });
            });
        }
        return MapCanvas.html2CanvasPromise;
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

MapCanvas.htmlToImagePromise = null;
MapCanvas.html2CanvasPromise = null;

const mapCanvas = new MapCanvas();