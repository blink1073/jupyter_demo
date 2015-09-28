// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
var utils = require('./utils');
/**
 * The url for the config service.
 */
var SERVICE_CONFIG_URL = 'api/config';
/**
 * Configurable data section.
 */
var ConfigSection = (function () {
    /**
     * Create a config section.
     */
    function ConfigSection(sectionName, baseUrl) {
        var _this = this;
        this._url = "unknown";
        this._data = {};
        this._loaded = null;
        this._oneLoadFinished = false;
        this._finishFirstLoad = null;
        this._url = utils.urlJoinEncode(baseUrl, SERVICE_CONFIG_URL, sectionName);
        this._loaded = new Promise(function (resolve, reject) {
            _this._finishFirstLoad = resolve;
        });
    }
    Object.defineProperty(ConfigSection.prototype, "data", {
        /**
         * Get the data for this section.
         */
        get: function () {
            return this._data;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ConfigSection.prototype, "onLoaded", {
        /**
         * Promose fullfilled when the config section is first loaded.
         */
        get: function () {
            return this._loaded;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Retrieve the data for this section.
     */
    ConfigSection.prototype.load = function () {
        var _this = this;
        return utils.ajaxRequest(this._url, {
            method: "GET",
            dataType: "json",
        }).then(function (success) {
            if (success.xhr.status !== 200) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            _this._data = success.data;
            _this._loadDone();
            return _this._data;
        });
    };
    /**
     * Modify the config values stored. Update the local data immediately,
     * send the change to the server, and use the updated data from the server
     * when the reply comes.
     */
    ConfigSection.prototype.update = function (newdata) {
        var _this = this;
        this._data = utils.extend(this._data, newdata);
        return utils.ajaxRequest(this._url, {
            method: "PATCH",
            data: JSON.stringify(newdata),
            dataType: "json",
            contentType: 'application/json',
        }).then(function (success) {
            if (success.xhr.status !== 200) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            _this._data = success.data;
            _this._loadDone();
            return _this._data;
        });
    };
    /**
     * Handle a finished load, fulfilling the onLoaded promise on the first call.
     */
    ConfigSection.prototype._loadDone = function () {
        if (!this._oneLoadFinished) {
            this._oneLoadFinished = true;
            this._finishFirstLoad(this._data);
        }
    };
    return ConfigSection;
})();
exports.ConfigSection = ConfigSection;
/**
 * Configurable object with defaults.
 */
var ConfigWithDefaults = (function () {
    /**
     * Create a new config with defaults.
     */
    function ConfigWithDefaults(section, defaults, classname) {
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
    ConfigWithDefaults.prototype.get = function (key) {
        var _this = this;
        var that = this;
        return this._section.onLoaded.then(function () {
            return _this._classData()[key] || _this._defaults[key];
        });
    };
    /**
     * Return a config value. If config is not yet loaded, return the default
     * instead of waiting for it to load.
     */
    ConfigWithDefaults.prototype.getSync = function (key) {
        return this._classData()[key] || this._defaults[key];
    };
    /**
     * Set a config value. Send the update to the server, and change our
     * local copy of the data immediately.
     */
    ConfigWithDefaults.prototype.set = function (key, value) {
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
    };
    /**
     * Get data from the Section with our classname, if available.
     * If we have no classname, get all of the data in the Section
     */
    ConfigWithDefaults.prototype._classData = function () {
        if (this._className) {
            return this._section.data[this._className] || {};
        }
        else {
            return this._section.data;
        }
    };
    return ConfigWithDefaults;
})();
exports.ConfigWithDefaults = ConfigWithDefaults;
//# sourceMappingURL=config.js.map