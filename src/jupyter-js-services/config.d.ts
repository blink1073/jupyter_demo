/**
 * Configurable data section.
 */
export declare class ConfigSection {
    /**
     * Create a config section.
     */
    constructor(sectionName: string, baseUrl: string);
    /**
     * Get the data for this section.
     */
    data: any;
    /**
     * Promose fullfilled when the config section is first loaded.
     */
    onLoaded: Promise<any>;
    /**
     * Retrieve the data for this section.
     */
    load(): Promise<any>;
    /**
     * Modify the config values stored. Update the local data immediately,
     * send the change to the server, and use the updated data from the server
     * when the reply comes.
     */
    update(newdata: any): Promise<any>;
    /**
     * Handle a finished load, fulfilling the onLoaded promise on the first call.
     */
    private _loadDone();
    private _url;
    private _data;
    private _loaded;
    private _oneLoadFinished;
    private _finishFirstLoad;
}
/**
 * Configurable object with defaults.
 */
export declare class ConfigWithDefaults {
    /**
     * Create a new config with defaults.
     */
    constructor(section: ConfigSection, defaults: any, classname?: string);
    /**
     * Wait for config to have loaded, then get a value or the default.
     *
     * Note: section.load() must be called somewhere else.
     */
    get(key: string): Promise<any>;
    /**
     * Return a config value. If config is not yet loaded, return the default
     * instead of waiting for it to load.
     */
    getSync(key: string): any;
    /**
     * Set a config value. Send the update to the server, and change our
     * local copy of the data immediately.
     */
    set(key: string, value: any): Promise<any>;
    /**
     * Get data from the Section with our classname, if available.
     * If we have no classname, get all of the data in the Section
     */
    private _classData();
    private _section;
    private _defaults;
    private _className;
}
