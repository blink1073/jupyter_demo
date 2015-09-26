// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import * as utils from './utils';
/**
 * The url for the config service.
 */
var SERVICE_CONFIG_URL = 'api/config';
/**
 * Configurable data section.
 */
export class ConfigSection {
    /**
     * Create a config section.
     */
    constructor(sectionName, baseUrl) {
        this._url = "unknown";
        this._data = {};
        this._loaded = null;
        this._oneLoadFinished = false;
        this._finishFirstLoad = null;
        this._url = utils.urlJoinEncode(baseUrl, SERVICE_CONFIG_URL, sectionName);
        this._loaded = new Promise((resolve, reject) => {
            this._finishFirstLoad = resolve;
        });
    }
    /**
     * Get the data for this section.
     */
    get data() {
        return this._data;
    }
    /**
     * Promose fullfilled when the config section is first loaded.
     */
    get onLoaded() {
        return this._loaded;
    }
    /**
     * Retrieve the data for this section.
     */
    load() {
        return utils.ajaxRequest(this._url, {
            method: "GET",
            dataType: "json",
        }).then((success) => {
            if (success.xhr.status !== 200) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            this._data = success.data;
            this._loadDone();
            return this._data;
        });
    }
    /**
     * Modify the config values stored. Update the local data immediately,
     * send the change to the server, and use the updated data from the server
     * when the reply comes.
     */
    update(newdata) {
        this._data = utils.extend(this._data, newdata);
        return utils.ajaxRequest(this._url, {
            method: "PATCH",
            data: JSON.stringify(newdata),
            dataType: "json",
            contentType: 'application/json',
        }).then((success) => {
            if (success.xhr.status !== 200) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            this._data = success.data;
            this._loadDone();
            return this._data;
        });
    }
    /**
     * Handle a finished load, fulfilling the onLoaded promise on the first call.
     */
    _loadDone() {
        if (!this._oneLoadFinished) {
            this._oneLoadFinished = true;
            this._finishFirstLoad(this._data);
        }
    }
}
/**
 * Configurable object with defaults.
 */
export class ConfigWithDefaults {
    /**
     * Create a new config with defaults.
     */
    constructor(section, defaults, classname) {
        this._section = null;
        this._defaults = null;
        this._className = "unknown";
        this._section = section;
        this._defaults = defaults;
        this._className = classname;
    }
    /**
     * Wait for config to have loaded, then get a value or the default.
     *
     * Note: section.load() must be called somewhere else.
     */
    get(key) {
        var that = this;
        return this._section.onLoaded.then(() => {
            return this._classData()[key] || this._defaults[key];
        });
    }
    /**
     * Return a config value. If config is not yet loaded, return the default
     * instead of waiting for it to load.
     */
    getSync(key) {
        return this._classData()[key] || this._defaults[key];
    }
    /**
     * Set a config value. Send the update to the server, and change our
     * local copy of the data immediately.
     */
    set(key, value) {
        var d = {};
        d[key] = value;
        if (this._className) {
            var d2 = {};
            d2[this._className] = d;
            return this._section.update(d2);
        }
        else {
            return this._section.update(d);
        }
    }
    /**
     * Get data from the Section with our classname, if available.
     * If we have no classname, get all of the data in the Section
     */
    _classData() {
        if (this._className) {
            return this._section.data[this._className] || {};
        }
        else {
            return this._section.data;
        }
    }
}
//# sourceMappingURL=config.js.map