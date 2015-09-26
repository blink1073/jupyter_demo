import { IKernelId, IKernelMessage, IKernelSpecId } from './ikernel';
import { INotebookId, ISessionId } from './isession';
/**
 * Validate an Kernel Message as being a valid Comm Message.
 */
export declare function validateCommMessage(msg: IKernelMessage): boolean;
/**
 * Validate an object as being of IKernelMessage type.
 */
export declare function validateKernelMessage(msg: IKernelMessage): void;
/**
 * Validate an object as being of IKernelID type
 */
export declare function validateKernelId(info: IKernelId): void;
/**
 * Validate an object as being of ISessionId type.
 */
export declare function validateSessionId(info: ISessionId): void;
/**
 * Validate an object as being of INotebookId type.
 */
export declare function validateNotebookId(model: INotebookId): void;
/**
 * Validate an object as being of IKernelSpecID type.
 */
export declare function validateKernelSpec(info: IKernelSpecId): void;
