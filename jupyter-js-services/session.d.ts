import { INotebookSession, ISessionId, ISessionOptions } from './isession';
/**
 * Fetch the running sessions via API: GET /sessions
 */
export declare function listRunningSessions(baseUrl: string): Promise<ISessionId[]>;
/**
 * Start a new session via API: POST /kernels
 *
 * Wrap the result in an NotebookSession object. The promise is fulfilled
 * when the session is fully ready to send the first message. If
 * the session fails to become ready, the promise is rejected.
 */
export declare function startNewSession(options: ISessionOptions): Promise<INotebookSession>;
/**
 * Connect to a running notebook session.
 *
 * If the session was already started via `startNewSession`, the existing
 * NotebookSession object is used as the fulfillment value.
 *
 * Otherwise, if `options` are given, we attempt to connect to the existing
 * session.  The promise is fulfilled when the session is fully ready to send
 * the first message. If the session fails to become ready, the promise is
 * rejected.
 *
 * If the session was not already started and no `options` are given,
 * the promise is rejected.
 */
export declare function connectToSession(id: string, options?: ISessionOptions): Promise<INotebookSession>;
