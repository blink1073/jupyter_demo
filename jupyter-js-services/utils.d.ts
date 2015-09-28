/**
 * Copy the contents of one object to another, recursively.
 *
 * http://stackoverflow.com/questions/12317003/something-like-jquery-extend-but-standalone
 */
export declare function extend(target: any, source: any): any;
/**
 * Get a random 128b hex string (not a formal UUID)
 */
export declare function uuid(): string;
/**
 * Join a sequence of url components with '/'.
 */
export declare function urlPathJoin(...paths: string[]): string;
/**
 * Encode just the components of a multi-segment uri,
 * leaving '/' separators.
 */
export declare function encodeURIComponents(uri: string): string;
/**
 * Join a sequence of url components with '/',
 * encoding each component with encodeURIComponent.
 */
export declare function urlJoinEncode(...args: string[]): string;
/**
 * Return a serialized object string suitable for a query.
 *
 * http://stackoverflow.com/a/30707423
 */
export declare function jsonToQueryString(json: any): string;
/**
 * Input settings for an AJAX request.
 */
export interface IAjaxSettings {
    method: string;
    dataType: string;
    contentType?: string;
    data?: any;
}
/**
 * Success handler for AJAX request.
 */
export interface IAjaxSuccess {
    data: any;
    statusText: string;
    xhr: XMLHttpRequest;
}
/**
 * Error handler for AJAX request.
 */
export interface IAjaxError {
    xhr: XMLHttpRequest;
    statusText: string;
    error: ErrorEvent;
}
/**
 * Asynchronous XMLHTTPRequest handler.
 *
 * http://www.html5rocks.com/en/tutorials/es6/promises/#toc-promisifying-xmlhttprequest
 */
export declare function ajaxRequest(url: string, settings: IAjaxSettings): Promise<any>;
/**
 * A Promise that can be resolved or rejected by another object.
 */
export declare class PromiseDelegate<T> {
    /**
     * Construct a new Promise delegate.
     */
    constructor();
    /**
     * Get the underlying Promise.
     */
    promise: Promise<T>;
    /**
     * Resolve the underlying Promise with an optional value or another Promise.
     */
    resolve(value?: T | Thenable<T>): void;
    /**
     * Reject the underlying Promise with an optional reason.
     */
    reject(reason?: any): void;
    private _promise;
    private _resolve;
    private _reject;
}
