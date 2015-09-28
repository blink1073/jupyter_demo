// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';
/**
 * Copy the contents of one object to another, recursively.
 *
 * http://stackoverflow.com/questions/12317003/something-like-jquery-extend-but-standalone
 */
function extend(target, source) {
    target = target || {};
    for (var prop in source) {
        if (typeof source[prop] === 'object') {
            target[prop] = extend(target[prop], source[prop]);
        }
        else {
            target[prop] = source[prop];
        }
    }
    return target;
}
exports.extend = extend;
/**
 * Get a random 128b hex string (not a formal UUID)
 */
function uuid() {
    var s = [];
    var hexDigits = "0123456789abcdef";
    var nChars = hexDigits.length;
    for (var i = 0; i < 32; i++) {
        s[i] = hexDigits.charAt(Math.floor(Math.random() * nChars));
    }
    return s.join("");
}
exports.uuid = uuid;
/**
 * Join a sequence of url components with '/'.
 */
function urlPathJoin() {
    var paths = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        paths[_i - 0] = arguments[_i];
    }
    var url = '';
    for (var i = 0; i < paths.length; i++) {
        var path = paths[i];
        if (path === '') {
            continue;
        }
        if (i > 0) {
            path = path.replace(/\/\/+/, '/');
        }
        if (url.length > 0 && url.charAt(url.length - 1) != '/') {
            url = url + '/' + paths[i];
        }
        else {
            url = url + paths[i];
        }
    }
    return url;
}
exports.urlPathJoin = urlPathJoin;
/**
 * Encode just the components of a multi-segment uri,
 * leaving '/' separators.
 */
function encodeURIComponents(uri) {
    return uri.split('/').map(encodeURIComponent).join('/');
}
exports.encodeURIComponents = encodeURIComponents;
/**
 * Join a sequence of url components with '/',
 * encoding each component with encodeURIComponent.
 */
function urlJoinEncode() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    return encodeURIComponents(urlPathJoin.apply(null, args));
}
exports.urlJoinEncode = urlJoinEncode;
/**
 * Return a serialized object string suitable for a query.
 *
 * http://stackoverflow.com/a/30707423
 */
function jsonToQueryString(json) {
    return '?' + Object.keys(json).map(function (key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(json[key]);
    }).join('&');
}
exports.jsonToQueryString = jsonToQueryString;
/**
 * Asynchronous XMLHTTPRequest handler.
 *
 * http://www.html5rocks.com/en/tutorials/es6/promises/#toc-promisifying-xmlhttprequest
 */
function ajaxRequest(url, settings) {
    return new Promise(function (resolve, reject) {
        var req = new XMLHttpRequest();
        req.open(settings.method, url);
        if (settings.contentType) {
            req.setRequestHeader('Content-Type', settings.contentType);
        }
        req.onload = function () {
            var response = req.response;
            if (settings.dataType === 'json' && req.response) {
                response = JSON.parse(req.response);
            }
            resolve({ data: response, statusText: req.statusText, xhr: req });
        };
        req.onerror = function (err) {
            reject({ xhr: req, statusText: req.statusText, error: err });
        };
        if (settings.data) {
            req.send(settings.data);
        }
        else {
            req.send();
        }
    });
}
exports.ajaxRequest = ajaxRequest;
/**
 * A Promise that can be resolved or rejected by another object.
 */
var PromiseDelegate = (function () {
    /**
     * Construct a new Promise delegate.
     */
    function PromiseDelegate() {
        var _this = this;
        this._promise = new Promise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }
    Object.defineProperty(PromiseDelegate.prototype, "promise", {
        /**
         * Get the underlying Promise.
         */
        get: function () {
            return this._promise;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Resolve the underlying Promise with an optional value or another Promise.
     */
    PromiseDelegate.prototype.resolve = function (value) {
        // Note: according to the Promise spec, and the `this` context for resolve 
        // and reject are ignored
        this._resolve(value);
    };
    /**
     * Reject the underlying Promise with an optional reason.
     */
    PromiseDelegate.prototype.reject = function (reason) {
        // Note: according to the Promise spec, and the `this` context for resolve 
        // and reject are ignored
        this._reject(reason);
    };
    return PromiseDelegate;
})();
exports.PromiseDelegate = PromiseDelegate;
//# sourceMappingURL=utils.js.map