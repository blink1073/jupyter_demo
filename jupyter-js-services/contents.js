// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
var utils = require('./utils');
/**
 * The url for the contents service.
 */
var SERVICE_CONTENTS_URL = 'api/contents';
/**
 * A contents handle passing file operations to the back-end.
 * This includes checkpointing with the normal file operations.
 */
var Contents = (function () {
    /**
     * Create a new contents object.
     */
    function Contents(baseUrl) {
        this._apiUrl = "unknown";
        this._apiUrl = utils.urlPathJoin(baseUrl, SERVICE_CONTENTS_URL);
    }
    /**
     * Get a file or directory.
     */
    Contents.prototype.get = function (path, options) {
        var settings = {
            method: "GET",
            dataType: "json",
        };
        var url = this._getUrl(path);
        var params = {};
        if (options.type) {
            params.type = options.type;
        }
        if (options.format) {
            params.format = options.format;
        }
        if (options.content === false) {
            params.content = '0';
        }
        url = url + utils.jsonToQueryString(params);
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 200) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            validateContentsModel(success.data);
            return success.data;
        });
    };
    /**
     * Create a new untitled file or directory in the specified directory path.
     */
    Contents.prototype.newUntitled = function (path, options) {
        var settings = {
            method: "POST",
            dataType: "json",
        };
        if (options) {
            var data = JSON.stringify({
                ext: options.ext,
                type: options.type
            });
            settings.data = data;
            settings.contentType = 'application/json';
        }
        var url = this._getUrl(path);
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 201) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            validateContentsModel(success.data);
            return success.data;
        });
    };
    /**
     * Delete a file.
     */
    Contents.prototype.delete = function (path) {
        var settings = {
            method: "DELETE",
            dataType: "json",
        };
        var url = this._getUrl(path);
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 204) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
        }, // Translate certain errors to more specific ones.
        function (error) {
            // TODO: update IPEP27 to specify errors more precisely, so
            // that error types can be detected here with certainty.
            if (error.xhr.status === 400) {
                throw new Error('Directory not found');
            }
            throw error;
        });
    };
    /**
     * Rename a file.
     */
    Contents.prototype.rename = function (path, newPath) {
        var data = { path: newPath };
        var settings = {
            method: "PATCH",
            data: JSON.stringify(data),
            dataType: "json",
            contentType: 'application/json',
        };
        var url = this._getUrl(path);
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 200) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            validateContentsModel(success.data);
            return success.data;
        });
    };
    /**
     * Save a file.
     */
    Contents.prototype.save = function (path, model) {
        var settings = {
            method: "PUT",
            dataType: "json",
            data: JSON.stringify(model),
            contentType: 'application/json',
        };
        var url = this._getUrl(path);
        return utils.ajaxRequest(url, settings).then(function (success) {
            // will return 200 for an existing file and 201 for a new file
            if (success.xhr.status !== 200 && success.xhr.status !== 201) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            validateContentsModel(success.data);
            return success.data;
        });
    };
    /**
     * Copy a file into a given directory via POST
     * The server will select the name of the copied file.
     */
    Contents.prototype.copy = function (fromFile, toDir) {
        var settings = {
            method: "POST",
            data: JSON.stringify({ copy_from: fromFile }),
            contentType: 'application/json',
            dataType: "json",
        };
        var url = this._getUrl(toDir);
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 201) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            validateContentsModel(success.data);
            return success.data;
        });
    };
    /**
     * Create a checkpoint for a file.
     */
    Contents.prototype.createCheckpoint = function (path) {
        var settings = {
            method: "POST",
            dataType: "json",
        };
        var url = this._getUrl(path, 'checkpoints');
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 201) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            validateCheckpointModel(success.data);
            return success.data;
        });
    };
    /**
     * List available checkpoints for a file.
     */
    Contents.prototype.listCheckpoints = function (path) {
        var settings = {
            method: "GET",
            dataType: "json",
        };
        var url = this._getUrl(path, 'checkpoints');
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 200) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
            if (!Array.isArray(success.data)) {
                throw Error('Invalid Checkpoint list');
            }
            for (var i = 0; i < success.data.length; i++) {
                validateCheckpointModel(success.data[i]);
            }
            return success.data;
        });
    };
    /**
     * Restore a file to a known checkpoint state.
     */
    Contents.prototype.restoreCheckpoint = function (path, checkpointID) {
        var settings = {
            method: "POST",
            dataType: "json",
        };
        var url = this._getUrl(path, 'checkpoints', checkpointID);
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 204) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
        });
    };
    /**
     * Delete a checkpoint for a file.
     */
    Contents.prototype.deleteCheckpoint = function (path, checkpointID) {
        var settings = {
            method: "DELETE",
            dataType: "json",
        };
        var url = this._getUrl(path, 'checkpoints', checkpointID);
        return utils.ajaxRequest(url, settings).then(function (success) {
            if (success.xhr.status !== 204) {
                throw Error('Invalid Status: ' + success.xhr.status);
            }
        });
    };
    /**
     * List notebooks and directories at a given path.
     */
    Contents.prototype.listContents = function (path) {
        return this.get(path, { type: 'directory' });
    };
    /**
     * Get an REST url for this file given a path.
     */
    Contents.prototype._getUrl = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var url_parts = [this._apiUrl].concat(Array.prototype.slice.apply(args));
        return utils.urlPathJoin.apply(null, url_parts);
    };
    return Contents;
})();
exports.Contents = Contents;
/**
 * Validate a Contents Model.
 */
function validateContentsModel(model) {
    var err = new Error('Invalid Contents Model');
    if (!model.hasOwnProperty('name') || typeof model.name !== 'string') {
        throw err;
    }
    if (!model.hasOwnProperty('path') || typeof model.path !== 'string') {
        throw err;
    }
    if (!model.hasOwnProperty('type') || typeof model.type !== 'string') {
        throw err;
    }
    if (!model.hasOwnProperty('created') || typeof model.created !== 'string') {
        throw err;
    }
    if (!model.hasOwnProperty('last_modified') ||
        typeof model.last_modified !== 'string') {
        throw err;
    }
    if (!model.hasOwnProperty('mimetype')) {
        throw err;
    }
    if (!model.hasOwnProperty('content')) {
        throw err;
    }
    if (!model.hasOwnProperty('format')) {
        throw err;
    }
}
/**
 * Validate a Checkpoint model.
 */
function validateCheckpointModel(model) {
    var err = new Error('Invalid Checkpoint Model');
    if (!model.hasOwnProperty('id') || typeof model.id !== 'string') {
        throw err;
    }
    if (!model.hasOwnProperty('last_modified') ||
        typeof model.last_modified !== 'string') {
        throw err;
    }
}
//# sourceMappingURL=contents.js.map
