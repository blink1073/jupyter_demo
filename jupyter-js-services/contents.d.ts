/**
 * Options for a contents object.
 */
export interface IContentsOpts {
    type?: string;
    format?: string;
    content?: any;
    ext?: string;
    name?: string;
}
/**
 * Contents model.
 */
export interface IContentsModel {
    name: string;
    path: string;
    type: string;
    writable?: boolean;
    created: string;
    last_modified: string;
    mimetype: string;
    content: string;
    format: string;
}
/**
 * Checkpoint model.
 */
export interface ICheckpointModel {
    id: string;
    last_modified: string;
}
/**
 * Interface that a content manager should implement.
 **/
export interface IContents {
    get(path: string, type: string, options: IContentsOpts): Promise<IContentsModel>;
    newUntitled(path: string, options: IContentsOpts): Promise<IContentsModel>;
    delete(path: string): Promise<void>;
    rename(path: string, newPath: string): Promise<IContentsModel>;
    save(path: string, model: any): Promise<IContentsModel>;
    listContents(path: string): Promise<IContentsModel>;
    copy(path: string, toDir: string): Promise<IContentsModel>;
    createCheckpoint(path: string): Promise<ICheckpointModel>;
    restoreCheckpoint(path: string, checkpointID: string): Promise<void>;
    deleteCheckpoint(path: string, checkpointID: string): Promise<void>;
    listCheckpoints(path: string): Promise<ICheckpointModel[]>;
}
/**
 * A contents handle passing file operations to the back-end.
 * This includes checkpointing with the normal file operations.
 */
export declare class Contents implements IContents {
    /**
     * Create a new contents object.
     */
    constructor(baseUrl: string);
    /**
     * Get a file or directory.
     */
    get(path: string, options: IContentsOpts): Promise<IContentsModel>;
    /**
     * Create a new untitled file or directory in the specified directory path.
     */
    newUntitled(path: string, options?: IContentsOpts): Promise<IContentsModel>;
    /**
     * Delete a file.
     */
    delete(path: string): Promise<void>;
    /**
     * Rename a file.
     */
    rename(path: string, newPath: string): Promise<IContentsModel>;
    /**
     * Save a file.
     */
    save(path: string, model: IContentsOpts): Promise<IContentsModel>;
    /**
     * Copy a file into a given directory via POST
     * The server will select the name of the copied file.
     */
    copy(fromFile: string, toDir: string): Promise<IContentsModel>;
    /**
     * Create a checkpoint for a file.
     */
    createCheckpoint(path: string): Promise<ICheckpointModel>;
    /**
     * List available checkpoints for a file.
     */
    listCheckpoints(path: string): Promise<ICheckpointModel[]>;
    /**
     * Restore a file to a known checkpoint state.
     */
    restoreCheckpoint(path: string, checkpointID: string): Promise<void>;
    /**
     * Delete a checkpoint for a file.
     */
    deleteCheckpoint(path: string, checkpointID: string): Promise<void>;
    /**
     * List notebooks and directories at a given path.
     */
    listContents(path: string): Promise<IContentsModel>;
    /**
     * Get an REST url for this file given a path.
     */
    private _getUrl(...args);
    private _apiUrl;
}
