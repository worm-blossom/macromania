import type { LoggingFormatter, LogLevel } from "./loggingBackend.ts";
import {
  bgBlack,
  bgBlue,
  bgBrightBlack,
  bgBrightBlue,
  bgBrightCyan,
  bgBrightGreen,
  bgBrightMagenta,
  bgBrightRed,
  bgBrightWhite,
  bgBrightYellow,
  bgCyan,
  bgGreen,
  bgMagenta,
  bgRed,
  bgWhite,
  bgYellow,
  black,
  blue,
  bold,
  brightBlack,
  brightBlue,
  brightCyan,
  brightGreen,
  brightMagenta,
  brightRed,
  brightWhite,
  brightYellow,
  cyan,
  dim,
  gray,
  green,
  italic,
  magenta,
  red,
  strikethrough,
  underline,
  white,
  yellow,
} from "@std/fmt/colors";
import type { LoggingBackend } from "./loggingBackend.ts";

/**
 * The default logger used by macromania logs to the console.
 */
export class DefaultLogger implements LoggingBackend, LoggingFormatter {
  groupDepth: number;
  constructor() {
    this.groupDepth = 0;
  }

  // deno-lint-ignore no-explicit-any
  log(level: LogLevel, ...data: any[]): void {
    const indentation = "".padStart(2 * this.groupDepth, " ");
    switch (level) {
      case "ignore":
        return console.log(this.dim("[nope] "), indentation, ...data);
      case "debug":
        return console.log(this.magenta("[debug]"), indentation, ...data);
      case "trace":
        return console.log(this.brightGreen("[trace]"), indentation, ...data);
      case "info":
        return console.log(this.blue("[blue] "), indentation, ...data);
      case "warn":
        return console.log(this.yellow("[warn] "), indentation, ...data);
      case "error":
        return console.log(this.red("[error]"), indentation, ...data);
    }
  }

  startGroup() {
    this.groupDepth += 1;
  }

  endGroup() {
    this.groupDepth -= 1;
  }

  bgBlack(s: string): string {
    return bgBlack(s);
  }

  bgBlue(s: string): string {
    return bgBlue(s);
  }

  bgBrightBlack(s: string): string {
    return bgBrightBlack(s);
  }

  bgBrightBlue(s: string): string {
    return bgBrightBlue(s);
  }

  bgBrightCyan(s: string): string {
    return bgBrightCyan(s);
  }

  bgBrightGreen(s: string): string {
    return bgBrightGreen(s);
  }

  bgBrightMagenta(s: string): string {
    return bgBrightMagenta(s);
  }

  bgBrightRed(s: string): string {
    return bgBrightRed(s);
  }

  bgBrightWhite(s: string): string {
    return bgBrightWhite(s);
  }

  bgBrightYellow(s: string): string {
    return bgBrightYellow(s);
  }

  bgCyan(s: string): string {
    return bgCyan(s);
  }

  bgGreen(s: string): string {
    return bgGreen(s);
  }

  bgMagenta(s: string): string {
    return bgMagenta(s);
  }

  bgRed(s: string): string {
    return bgRed(s);
  }

  bgWhite(s: string): string {
    return bgWhite(s);
  }

  bgYellow(s: string): string {
    return bgYellow(s);
  }

  black(s: string): string {
    return black(s);
  }

  blue(s: string): string {
    return blue(s);
  }

  bold(s: string): string {
    return bold(s);
  }

  brightBlack(s: string): string {
    return brightBlack(s);
  }

  brightBlue(s: string): string {
    return brightBlue(s);
  }

  brightCyan(s: string): string {
    return brightCyan(s);
  }

  brightGreen(s: string): string {
    return brightGreen(s);
  }

  brightMagenta(s: string): string {
    return brightMagenta(s);
  }

  brightRed(s: string): string {
    return brightRed(s);
  }

  brightWhite(s: string): string {
    return brightWhite(s);
  }

  brightYellow(s: string): string {
    return brightYellow(s);
  }

  cyan(s: string): string {
    return cyan(s);
  }

  dim(s: string): string {
    return dim(s);
  }

  grey(s: string): string {
    return gray(s);
  }

  green(s: string): string {
    return green(s);
  }

  italic(s: string): string {
    return italic(s);
  }

  magenta(s: string): string {
    return magenta(s);
  }

  red(s: string): string {
    return red(s);
  }

  strikethrough(s: string): string {
    return strikethrough(s);
  }

  underline(s: string): string {
    return underline(s);
  }

  white(s: string): string {
    return white(s);
  }

  yellow(s: string): string {
    return yellow(s);
  }
}
