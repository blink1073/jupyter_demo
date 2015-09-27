
declare module 'term.js' {

  /**
   * A terminal configuration.
   */
  export
    interface ITerminalConfig {
    convertEol?: boolean;
    termName?: string;
    rows?: number;
    cols?: number;
    cursorBlink?: boolean;
    visualBell?: boolean;
    popOnBell?: boolean;
    scrollback?: number;
    screenKeys?: number;
    useStyle?: boolean;
  }


  /**
   * Typing for a term.js terminal object.
   */
  export 
  class Terminal {
    constructor(config: ITerminalConfig);

    options: ITerminalConfig;

    element: HTMLElement;

    colors: number[];

    rows: number;

    cols: number;

    open(el: HTMLElement): void;

    write(msg: string): void;

    resize(width: number, height: number): void;

    destroy(): void;

  }
}
