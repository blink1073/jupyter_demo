import { IKernelMessage } from './ikernel';
/**
 * Deserialize and return the unpacked message.
 */
export declare function deserialize(data: ArrayBuffer | string): IKernelMessage;
/**
 * Serialize a kernel message for transport.
 */
export declare function serialize(msg: IKernelMessage): string | ArrayBuffer;
