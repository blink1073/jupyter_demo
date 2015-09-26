import { IKernel, IKernelId, IKernelMessage, IKernelMessageOptions, IKernelOptions, IKernelSpecIds } from './ikernel';
/**
 * Fetch the kernel specs via API: GET /kernelspecs
 */
export declare function getKernelSpecs(baseUrl: string): Promise<IKernelSpecIds>;
/**
 * Fetch the running kernels via API: GET /kernels
 */
export declare function listRunningKernels(baseUrl: string): Promise<IKernelId[]>;
/**
 * Start a new kernel via API: POST /kernels
 *
 * Wrap the result in an Kernel object. The promise is fulfilled
 * when the kernel is fully ready to send the first message. If
 * the kernel fails to become ready, the promise is rejected.
 */
export declare function startNewKernel(options: IKernelOptions): Promise<IKernel>;
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
export declare function connectToKernel(id: string, options?: IKernelOptions): Promise<IKernel>;
/**
 * Create a well-formed Kernel Message.
 */
export declare function createKernelMessage(options: IKernelMessageOptions, content?: any, metadata?: any, buffers?: (ArrayBuffer | ArrayBufferView)[]): IKernelMessage;
