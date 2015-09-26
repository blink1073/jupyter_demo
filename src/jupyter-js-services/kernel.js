// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';
import { DisposableDelegate } from 'phosphor-disposable';
import { Signal } from 'phosphor-signaling';
import { KernelStatus } from './ikernel';
import * as serialize from './serialize';
import * as utils from './utils';
import * as validate from './validate';
/**
 * The url for the kernel service.
 */
var KERNEL_SERVICE_URL = 'api/kernels';
/**
 * The url for the kernelspec service.
 */
var KERNELSPEC_SERVICE_URL = 'api/kernelspecs';
/**
 * Fetch the kernel specs via API: GET /kernelspecs
 */
export function getKernelSpecs(baseUrl) {
    var url = utils.urlPathJoin(baseUrl, KERNELSPEC_SERVICE_URL);
    return utils.ajaxRequest(url, {
        method: "GET",
        dataType: "json"
    }).then((success) => {
        var err = new Error('Invalid KernelSpecs Model');
        if (success.xhr.status !== 200) {
            throw new Error('Invalid Response: ' + success.xhr.status);
        }
        var data = success.data;
        if (!data.hasOwnProperty('default') ||
            typeof data.default !== 'string') {
            throw err;
        }
        if (!data.hasOwnProperty('kernelspecs')) {
            throw err;
        }
        if (!data.kernelspecs.hasOwnProperty(data.default)) {
            throw err;
        }
        var keys = Object.keys(data.kernelspecs);
        for (var i = 0; i < keys.length; i++) {
            var ks = data.kernelspecs[keys[i]];
            validate.validateKernelSpec(ks);
        }
        return data;
    });
}
/**
 * Fetch the running kernels via API: GET /kernels
 */
export function listRunningKernels(baseUrl) {
    var url = utils.urlPathJoin(baseUrl, KERNEL_SERVICE_URL);
    return utils.ajaxRequest(url, {
        method: "GET",
        dataType: "json"
    }).then((success) => {
        if (success.xhr.status !== 200) {
            throw Error('Invalid Status: ' + success.xhr.status);
        }
        if (!Array.isArray(success.data)) {
            throw Error('Invalid kernel list');
        }
        for (var i = 0; i < success.data.length; i++) {
            validate.validateKernelId(success.data[i]);
        }
        return success.data;
    }, onKernelError);
}
/**
 * Start a new kernel via API: POST /kernels
 *
 * Wrap the result in an Kernel object. The promise is fulfilled
 * when the kernel is fully ready to send the first message. If
 * the kernel fails to become ready, the promise is rejected.
 */
export function startNewKernel(options) {
    var url = utils.urlPathJoin(options.baseUrl, KERNEL_SERVICE_URL);
    return utils.ajaxRequest(url, {
        method: "POST",
        dataType: "json"
    }).then((success) => {
        if (success.xhr.status !== 201) {
            throw Error('Invalid Status: ' + success.xhr.status);
        }
        validate.validateKernelId(success.data);
        return createKernel(options, success.data.id);
    }, onKernelError);
}
/**
 * Connect to a running kernel.
 *
 * If the kernel was already started via `startNewKernel`, the existing
 * Kernel object is used as the fulfillment value.
 *
 * Otherwise, if `options` are given, we attempt to connect to the existing
 * kernel.  The promise is fulfilled when the kernel is fully ready to send
 * the first message. If the kernel fails to become ready, the promise is
 * rejected.
 *
 * If the kernel was not already started and no `options` are given,
 * the promise is rejected.
 */
export function connectToKernel(id, options) {
    var kernel = runningKernels.get(id);
    if (kernel) {
        return Promise.resolve(kernel);
    }
    if (options === void 0) {
        throw Error('Please specify kernel options');
    }
    return listRunningKernels(options.baseUrl).then((kernelIds) => {
        if (!kernelIds.some(k => k.id === id)) {
            throw new Error('No running kernel with id: ' + id);
        }
        return createKernel(options, id);
    });
}
/**
 * Create a well-formed Kernel Message.
 */
export function createKernelMessage(options, content = {}, metadata = {}, buffers = []) {
    return {
        header: {
            username: options.username || '',
            version: '5.0',
            session: options.session,
            msg_id: options.msgId || utils.uuid(),
            msg_type: options.msgType
        },
        parent_header: {},
        channel: options.channel,
        content: content,
        metadata: metadata,
        buffers: buffers
    };
}
/**
 * Create a Promise for a Kernel object.
 *
 * Fulfilled when the Kernel is Starting, or rejected if Dead.
 */
function createKernel(options, id) {
    return new Promise((resolve, reject) => {
        var kernel = new Kernel(options, id);
        var callback = (sender, status) => {
            if (status === KernelStatus.Starting || status === KernelStatus.Idle) {
                kernel.statusChanged.disconnect(callback);
                runningKernels.set(kernel.id, kernel);
                resolve(kernel);
            }
            else if (status === KernelStatus.Dead) {
                kernel.statusChanged.disconnect(callback);
                reject(new Error('Kernel failed to start'));
            }
        };
        kernel.statusChanged.connect(callback);
    });
}
/**
 * Implementation of the Kernel object
 */
class Kernel {
    /**
     * Construct a kernel object.
     */
    constructor(options, id) {
        this._id = '';
        this._name = '';
        this._baseUrl = '';
        this._status = KernelStatus.Unknown;
        this._clientId = '';
        this._ws = null;
        this._username = '';
        this._futures = null;
        this._commPromises = null;
        this._comms = null;
        this._name = options.name;
        this._id = id;
        this._baseUrl = options.baseUrl;
        this._clientId = options.clientId || utils.uuid();
        this._username = options.username || '';
        this._futures = new Map();
        this._commPromises = new Map();
        this._comms = new Map();
        this._createSocket(options.wsUrl);
    }
    /**
     * The status changed signal for the kernel.
     */
    get statusChanged() {
        return Kernel.statusChangedSignal.bind(this);
    }
    /**
     * The unhandled message signal for the kernel.
     */
    get unhandledMessage() {
        return Kernel.unhandledMessageSignal.bind(this);
    }
    /**
     * The unhandled comm_open message signal for the kernel.
     */
    get commOpened() {
        return Kernel.commOpenedSignal.bind(this);
    }
    /**
     * The id of the server-side kernel.
     */
    get id() {
        return this._id;
    }
    /**
     * The name of the server-side kernel.
     */
    get name() {
        return this._name;
    }
    /**
     * The client username.
     *
     * Read-only
     */
    get username() {
        return this._username;
    }
    /**
     * The client unique id.
     *
     * Read-only
     */
    get clientId() {
        return this._clientId;
    }
    /**
     * The current status of the kernel.
     */
    get status() {
        return this._status;
    }
    /**
     * Send a message to the kernel.
     *
     * The future object will yield the result when available.
     */
    sendShellMessage(msg, expectReply = false) {
        if (this._status === KernelStatus.Dead) {
            throw Error('Cannot send a message to a closed Kernel');
        }
        this._ws.send(serialize.serialize(msg));
        var future = new KernelFutureHandler(expectReply, () => {
            this._futures.delete(msg.header.msg_id);
        });
        this._futures.set(msg.header.msg_id, future);
        return future;
    }
    /**
     * Interrupt a kernel via API: POST /kernels/{kernel_id}/interrupt
     */
    interrupt() {
        return interruptKernel(this, this._baseUrl);
    }
    /**
     * Restart a kernel via API: POST /kernels/{kernel_id}/restart
     *
     * It is assumed that the API call does not mutate the kernel id or name.
     */
    restart() {
        if (this._status === KernelStatus.Dead) {
            return Promise.reject(new Error('Kernel is dead'));
        }
        this._status = KernelStatus.Restarting;
        return restartKernel(this, this._baseUrl);
    }
    /**
     * Delete a kernel via API: DELETE /kernels/{kernel_id}
     *
     * If the given kernel id corresponds to an Kernel object, that
     * object is disposed and its websocket connection is cleared.
     *
     * Any further calls to `sendMessage` for that Kernel will throw
     * an exception.
     */
    shutdown() {
        return shutdownKernel(this, this._baseUrl).then(() => {
            this._ws.close();
        });
    }
    /**
     * Send a "kernel_info_request" message.
     *
     * See https://ipython.org/ipython-doc/dev/development/messaging.html#kernel-info
     */
    kernelInfo() {
        var options = {
            msgType: 'kernel_info_request',
            channel: 'shell',
            username: this._username,
            session: this._clientId
        };
        var msg = createKernelMessage(options);
        return sendKernelMessage(this, msg);
    }
    /**
     * Send a "complete_request" message.
     *
     * See https://ipython.org/ipython-doc/dev/development/messaging.html#completion
     */
    complete(contents) {
        var options = {
            msgType: 'complete_request',
            channel: 'shell',
            username: this._username,
            session: this._clientId
        };
        var msg = createKernelMessage(options, contents);
        return sendKernelMessage(this, msg);
    }
    /**
     * Send an "inspect_request" message.
     *
     * See https://ipython.org/ipython-doc/dev/development/messaging.html#introspection
     */
    inspect(contents) {
        var options = {
            msgType: 'inspect_request',
            channel: 'shell',
            username: this._username,
            session: this._clientId
        };
        var msg = createKernelMessage(options, contents);
        return sendKernelMessage(this, msg);
    }
    /**
     * Send an "execute_request" message.
     *
     * See https://ipython.org/ipython-doc/dev/development/messaging.html#execute
     */
    execute(contents) {
        var options = {
            msgType: 'execute_request',
            channel: 'shell',
            username: this._username,
            session: this._clientId
        };
        var defaults = {
            silent: true,
            store_history: false,
            user_expressions: {},
            allow_stdin: false
        };
        contents = utils.extend(defaults, contents);
        var msg = createKernelMessage(options, contents);
        return this.sendShellMessage(msg, true);
    }
    /**
     * Send an "is_complete_request" message.
     *
     * See https://ipython.org/ipython-doc/dev/development/messaging.html#code-completeness
     */
    isComplete(contents) {
        var options = {
            msgType: 'is_complete_request',
            channel: 'shell',
            username: this._username,
            session: this._clientId
        };
        var msg = createKernelMessage(options, contents);
        return sendKernelMessage(this, msg);
    }
    /**
     * Send a 'comm_info_request', and return the contents of the
     * 'comm_info_reply'.
     */
    commInfo(contents) {
        var options = {
            msgType: 'comm_info_request',
            channel: 'shell',
            username: this._username,
            session: this._clientId
        };
        var msg = createKernelMessage(options, contents);
        return sendKernelMessage(this, msg);
    }
    /**
     * Send an "input_reply" message.
     *
     * https://ipython.org/ipython-doc/dev/development/messaging.html#messages-on-the-stdin-router-dealer-sockets
     */
    sendInputReply(contents) {
        if (this._status === KernelStatus.Dead) {
            throw Error('Cannot send a message to a closed Kernel');
        }
        var options = {
            msgType: 'input_reply',
            channel: 'stdin',
            username: this._username,
            session: this._clientId
        };
        var msg = createKernelMessage(options, contents);
        this._ws.send(serialize.serialize(msg));
    }
    /**
     * Connect to a comm, or create a new one.
     *
     * If a client-side comm already exists, it is returned.
     */
    connectToComm(targetName, commId) {
        if (commId === void 0) {
            commId = utils.uuid();
        }
        var comm = this._comms.get(commId);
        if (!comm) {
            comm = new Comm(targetName, commId, this._sendCommMessage.bind(this), () => {
                this._unregisterComm(comm.commId);
            });
            this._comms.set(commId, comm);
        }
        return comm;
    }
    /**
     * Create the kernel websocket connection and add socket status handlers.
     */
    _createSocket(wsUrl) {
        if (!wsUrl) {
            // trailing 's' in https will become wss for secure web sockets
            wsUrl = (location.protocol.replace('http', 'ws') + "//" + location.host);
        }
        var partialUrl = utils.urlPathJoin(wsUrl, KERNEL_SERVICE_URL, this._id);
        console.log('Starting WebSocket:', partialUrl);
        var url = (utils.urlPathJoin(partialUrl, 'channels') +
            '?session_id=' + this._clientId);
        this._ws = new WebSocket(url);
        // Ensure incoming binary messages are not Blobs
        this._ws.binaryType = 'arraybuffer';
        this._ws.onmessage = (evt) => { this._onWSMessage(evt); };
        this._ws.onopen = (evt) => { this._onWSOpen(evt); };
        this._ws.onclose = (evt) => { this._onWSClose(evt); };
        this._ws.onerror = (evt) => { this._onWSClose(evt); };
    }
    _onWSOpen(evt) {
        // trigger a status response
        this.kernelInfo();
    }
    _onWSMessage(evt) {
        var msg = serialize.deserialize(evt.data);
        var handled = false;
        try {
            validate.validateKernelMessage(msg);
        }
        catch (error) {
            console.error(error.message);
            return;
        }
        if (msg.parent_header) {
            var parentHeader = msg.parent_header;
            var future = this._futures.get(parentHeader.msg_id);
            if (future) {
                future.handleMsg(msg);
                handled = true;
            }
        }
        if (msg.channel === 'iopub') {
            switch (msg.header.msg_type) {
                case 'status':
                    this._updateStatus(msg.content.execution_state);
                    break;
                case 'comm_open':
                    this._handleCommOpen(msg);
                    handled = true;
                    break;
                case 'comm_msg':
                    this._handleCommMsg(msg);
                    handled = true;
                    break;
                case 'comm_close':
                    this._handleCommClose(msg);
                    handled = true;
                    break;
            }
        }
        if (!handled) {
            this.unhandledMessage.emit(msg);
        }
    }
    _onWSClose(evt) {
        this._updateStatus('dead');
    }
    /**
     * Handle status iopub messages from the kernel.
     */
    _updateStatus(state) {
        var status;
        switch (state) {
            case 'starting':
                status = KernelStatus.Starting;
                break;
            case 'idle':
                status = KernelStatus.Idle;
                break;
            case 'busy':
                status = KernelStatus.Busy;
                break;
            case 'restarting':
                status = KernelStatus.Restarting;
                break;
            case 'dead':
                status = KernelStatus.Dead;
                break;
            default:
                console.error('invalid kernel status:', state);
                return;
        }
        if (status !== this._status) {
            this._status = status;
            if (status === KernelStatus.Dead) {
                runningKernels.delete(this._id);
                this._ws.close();
            }
            logKernelStatus(this);
            this.statusChanged.emit(status);
        }
    }
    /**
     * Handle 'comm_open' kernel message.
     */
    _handleCommOpen(msg) {
        if (!validate.validateCommMessage(msg)) {
            console.error('Invalid comm message');
            return;
        }
        var content = msg.content;
        if (!content.target_module) {
            this.commOpened.emit(msg.content);
            return;
        }
        var targetName = content.target_name;
        var moduleName = content.target_module;
        var promise = new Promise((resolve, reject) => {
            // Try loading the module using require.js
            requirejs([moduleName], (mod) => {
                if (mod[targetName] === undefined) {
                    reject(new Error('Target ' + targetName + ' not found in module ' + moduleName));
                }
                var target = mod[targetName];
                var comm = new Comm(content.target_name, content.comm_id, this._sendCommMessage, () => { this._unregisterComm(content.comm_id); });
                try {
                    var response = target(comm, content.data);
                }
                catch (e) {
                    comm.close();
                    this._unregisterComm(comm.commId);
                    console.error("Exception opening new comm");
                    reject(e);
                }
                this._commPromises.delete(comm.commId);
                this._comms.set(comm.commId, comm);
                resolve(comm);
            });
        });
        this._commPromises.set(content.comm_id, promise);
    }
    /**
     * Handle 'comm_close' kernel message.
     */
    _handleCommClose(msg) {
        if (!validate.validateCommMessage(msg)) {
            console.error('Invalid comm message');
            return;
        }
        var content = msg.content;
        var promise = this._commPromises.get(content.comm_id);
        if (!promise) {
            var comm = this._comms.get(content.comm_id);
            if (!comm) {
                console.error('Comm not found for comm id ' + content.comm_id);
                return;
            }
            promise = Promise.resolve(comm);
        }
        promise.then((comm) => {
            this._unregisterComm(comm.commId);
            try {
                var onClose = comm.onClose;
                if (onClose)
                    onClose(msg.content.data);
                comm.dispose();
            }
            catch (e) {
                console.log("Exception closing comm: ", e, e.stack, msg);
            }
        });
    }
    /**
     * Handle 'comm_msg' kernel message.
     */
    _handleCommMsg(msg) {
        if (!validate.validateCommMessage(msg)) {
            console.error('Invalid comm message');
            return;
        }
        var content = msg.content;
        var promise = this._commPromises.get(content.comm_id);
        if (!promise) {
            var comm = this._comms.get(content.comm_id);
            if (!comm) {
                console.error('Comm not found for comm id ' + content.comm_id);
                return;
            }
            else {
                var onMsg = comm.onMsg;
                if (onMsg)
                    onMsg(msg.content.data);
            }
        }
        else {
            promise.then((comm) => {
                try {
                    var onMsg = comm.onMsg;
                    if (onMsg)
                        onMsg(msg.content.data);
                }
                catch (e) {
                    console.log("Exception handling comm msg: ", e, e.stack, msg);
                }
                return comm;
            });
        }
    }
    /**
     * Send a comm message to the kernel.
     */
    _sendCommMessage(payload) {
        var options = {
            msgType: payload.msgType,
            channel: 'shell',
            username: this.username,
            session: this.clientId
        };
        var msg = createKernelMessage(options, payload.content, payload.metadata, payload.buffers);
        return this.sendShellMessage(msg);
    }
    /**
     * Unregister a comm instance.
     */
    _unregisterComm(commId) {
        this._comms.delete(commId);
        this._commPromises.delete(commId);
    }
}
/**
 * A signal emitted when the kernel status changes.
 */
Kernel.statusChangedSignal = new Signal();
/**
 * A signal emitted for unhandled kernel message.
 */
Kernel.unhandledMessageSignal = new Signal();
/**
 * A signal emitted for unhandled comm open message.
 */
Kernel.commOpenedSignal = new Signal();
/**
 * A module private store for running kernels.
 */
var runningKernels = new Map();
/**
 * Restart a kernel via API: POST /kernels/{kernel_id}/restart
 *
 * It is assumed that the API call does not mutate the kernel id or name.
 */
function restartKernel(kernel, baseUrl) {
    var url = utils.urlPathJoin(baseUrl, KERNEL_SERVICE_URL, kernel.id, 'restart');
    return utils.ajaxRequest(url, {
        method: "POST",
        dataType: "json"
    }).then((success) => {
        if (success.xhr.status !== 200) {
            throw Error('Invalid Status: ' + success.xhr.status);
        }
        validate.validateKernelId(success.data);
        return new Promise((resolve, reject) => {
            var waitForStart = () => {
                if (kernel.status === KernelStatus.Starting) {
                    kernel.statusChanged.disconnect(waitForStart);
                    resolve();
                }
                else if (kernel.status === KernelStatus.Dead) {
                    kernel.statusChanged.disconnect(waitForStart);
                    reject(new Error('Kernel is dead'));
                }
            };
            kernel.statusChanged.connect(waitForStart);
        });
    }, onKernelError);
}
/**
 * Interrupt a kernel via API: POST /kernels/{kernel_id}/interrupt
 */
function interruptKernel(kernel, baseUrl) {
    if (kernel.status === KernelStatus.Dead) {
        return Promise.reject(new Error('Kernel is dead'));
    }
    var url = utils.urlPathJoin(baseUrl, KERNEL_SERVICE_URL, kernel.id, 'interrupt');
    return utils.ajaxRequest(url, {
        method: "POST",
        dataType: "json"
    }).then((success) => {
        if (success.xhr.status !== 204) {
            throw Error('Invalid Status: ' + success.xhr.status);
        }
    }, onKernelError);
}
/**
 * Delete a kernel via API: DELETE /kernels/{kernel_id}
 *
 * If the given kernel id corresponds to an Kernel object, that
 * object is disposed and its websocket connection is cleared.
 *
 * Any further calls to `sendMessage` for that Kernel will throw
 * an exception.
 */
function shutdownKernel(kernel, baseUrl) {
    if (kernel.status === KernelStatus.Dead) {
        return Promise.reject(new Error('Kernel is dead'));
    }
    var url = utils.urlPathJoin(baseUrl, KERNEL_SERVICE_URL, kernel.id);
    return utils.ajaxRequest(url, {
        method: "DELETE",
        dataType: "json"
    }).then((success) => {
        if (success.xhr.status !== 204) {
            throw Error('Invalid Status: ' + success.xhr.status);
        }
    }, onKernelError);
}
/**
 * Log the current kernel status.
 */
function logKernelStatus(kernel) {
    if (kernel.status == KernelStatus.Idle ||
        kernel.status === KernelStatus.Busy ||
        kernel.status === KernelStatus.Unknown) {
        return;
    }
    var status = '';
    switch (kernel.status) {
        case KernelStatus.Starting:
            status = 'starting';
            break;
        case KernelStatus.Restarting:
            status = 'restarting';
            break;
        case KernelStatus.Dead:
            status = 'dead';
            break;
    }
    console.log('Kernel: ' + status + ' (' + kernel.id + ')');
}
/**
 * Handle an error on a kernel Ajax call.
 */
function onKernelError(error) {
    console.error("API request failed (" + error.statusText + "): ");
    throw Error(error.statusText);
}
/**
 * Send a kernel message to the kernel and return the contents of the response.
 */
function sendKernelMessage(kernel, msg) {
    var future = kernel.sendShellMessage(msg, true);
    return new Promise((resolve, reject) => {
        future.onReply = (msg) => {
            resolve(msg.content);
        };
    });
}
/**
 * Bit flags for the kernel future state.
 */
var KernelFutureFlag;
(function (KernelFutureFlag) {
    KernelFutureFlag[KernelFutureFlag["GotReply"] = 1] = "GotReply";
    KernelFutureFlag[KernelFutureFlag["GotIdle"] = 2] = "GotIdle";
    KernelFutureFlag[KernelFutureFlag["IsDone"] = 4] = "IsDone";
})(KernelFutureFlag || (KernelFutureFlag = {}));
/**
 * Implementation of a kernel future.
 */
class KernelFutureHandler extends DisposableDelegate {
    constructor(expectShell, cb) {
        super(cb);
        this._status = 0;
        this._stdin = null;
        this._iopub = null;
        this._reply = null;
        this._done = null;
        if (!expectShell) {
            this._setFlag(KernelFutureFlag.GotReply);
        }
    }
    /**
     * Check for message done state.
     */
    get isDone() {
        return this._testFlag(KernelFutureFlag.IsDone);
    }
    /**
     * Get the reply handler.
     */
    get onReply() {
        return this._reply;
    }
    /**
     * Set the reply handler.
     */
    set onReply(cb) {
        this._reply = cb;
    }
    /**
     * Get the iopub handler.
     */
    get onIOPub() {
        return this._iopub;
    }
    /**
     * Set the iopub handler.
     */
    set onIOPub(cb) {
        this._iopub = cb;
    }
    /**
     * Get the done handler.
     */
    get onDone() {
        return this._done;
    }
    /**
     * Set the done handler.
     */
    set onDone(cb) {
        this._done = cb;
    }
    /**
     * Get the stdin handler.
     */
    get onStdin() {
        return this._stdin;
    }
    /**
     * Set the stdin handler.
     */
    set onStdin(cb) {
        this._stdin = cb;
    }
    /**
     * Dispose and unregister the future.
     */
    dispose() {
        this._stdin = null;
        this._iopub = null;
        this._reply = null;
        this._done = null;
        super.dispose();
    }
    /**
     * Handle an incoming kernel message.
     */
    handleMsg(msg) {
        switch (msg.channel) {
            case 'shell':
                this._handleReply(msg);
                break;
            case 'stdin':
                this._handleStdin(msg);
                break;
            case 'iopub':
                this._handleIOPub(msg);
                break;
        }
    }
    _handleReply(msg) {
        var reply = this._reply;
        if (reply)
            reply(msg);
        this._setFlag(KernelFutureFlag.GotReply);
        if (this._testFlag(KernelFutureFlag.GotIdle)) {
            this._handleDone(msg);
        }
    }
    _handleStdin(msg) {
        var stdin = this._stdin;
        if (stdin)
            stdin(msg);
    }
    _handleIOPub(msg) {
        var iopub = this._iopub;
        if (iopub)
            iopub(msg);
        if (msg.header.msg_type === 'status' &&
            msg.content.execution_state === 'idle') {
            this._setFlag(KernelFutureFlag.GotIdle);
            if (this._testFlag(KernelFutureFlag.GotReply)) {
                this._handleDone(msg);
            }
        }
    }
    _handleDone(msg) {
        if (this.isDone) {
            return;
        }
        this._setFlag(KernelFutureFlag.IsDone);
        var done = this._done;
        if (done)
            done(msg);
        this._done = null;
        this.dispose();
    }
    /**
     * Test whether the given future flag is set.
     */
    _testFlag(flag) {
        return (this._status & flag) !== 0;
    }
    /**
     * Set the given future flag.
     */
    _setFlag(flag) {
        this._status |= flag;
    }
    /**
     * Clear the given future flag.
     */
    _clearFlag(flag) {
        this._status &= ~flag;
    }
}
/**
 * Comm channel handler.
 */
class Comm extends DisposableDelegate {
    /**
     * Construct a new comm channel.
     */
    constructor(target, id, msgFunc, disposeCb) {
        super(disposeCb);
        this._target = '';
        this._id = '';
        this._onClose = null;
        this._onMsg = null;
        this._msgFunc = null;
        this._target = target;
        this._id = id;
        this._msgFunc = msgFunc;
    }
    /**
     * Get the uuid for the comm channel.
     *
     * Read-only
     */
    get commId() {
        return this._id;
    }
    /**
     * Get the target name for the comm channel.
     *
     * Read-only
     */
    get targetName() {
        return this._target;
    }
    /**
     * Get the onClose handler.
     */
    get onClose() {
        return this._onClose;
    }
    /**
     * Set the onClose handler.
     */
    set onClose(cb) {
        this._onClose = cb;
    }
    /**
     * Get the onMsg handler.
     */
    get onMsg() {
        return this._onMsg;
    }
    /**
     * Set the onMsg handler.
     */
    set onMsg(cb) {
        this._onMsg = cb;
    }
    /**
     * Initialize a comm with optional data.
     */
    open(data, metadata) {
        var content = {
            comm_id: this._id,
            target_name: this._target,
            data: data || {}
        };
        var payload = {
            msgType: 'comm_open', content: content, metadata: metadata
        };
        return this._msgFunc(payload);
    }
    /**
     * Send a comm message to the kernel.
     */
    send(data, metadata = {}, buffers = []) {
        if (this.isDisposed) {
            throw Error('Comm is closed');
        }
        var content = { comm_id: this._id, data: data };
        var payload = {
            msgType: 'comm_msg',
            content: content,
            metadata: metadata,
            buffers: buffers,
        };
        return this._msgFunc(payload);
    }
    /**
     * Close the comm.
     */
    close(data, metadata) {
        if (this.isDisposed) {
            return;
        }
        var onClose = this._onClose;
        if (onClose)
            onClose(data);
        if (this._msgFunc === void 0) {
            return;
        }
        var content = { comm_id: this._id, data: data || {} };
        var payload = {
            msgType: 'comm_close', content: content, metadata: metadata
        };
        var future = this._msgFunc(payload);
        this.dispose();
        return future;
    }
    /**
     * Clear internal state when disposed.
     */
    dispose() {
        this._onClose = null;
        this._onMsg = null;
        this._msgFunc = null;
        super.dispose();
    }
}
//# sourceMappingURL=kernel.js.map