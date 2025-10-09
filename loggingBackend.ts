/**
 * Different logging levels, in ascending order of priority.
 *
 * - `ignore`: Never logged (I mean, you *can* configure things to log these, but that isn't the intention).
 * - `debug`: Temporarily added logging calls for debugging. Should be removed before release.
 * - `trace`: Information about the flow of logic in some code.
 * - `info`: Interesting but non-critical, user-facing information.
 * - `warn`: Inform about recoverable but undesirable state.
 * - `error`: Information about an irrecoverable fault.
 */
export type LogLevel = "ignore" | "debug" | "trace" | "info" | "warn" | "error";

function levelToInt(level: LogLevel): number {
  if (level === "ignore") {
    return 0;
  } else if (level === "debug") {
    return 1;
  } else if (level === "trace") {
    return 2;
  } else if (level === "info") {
    return 3;
  } else if (level === "warn") {
    return 4;
  } else {
    return 5;
  }
}

/**
 * Return if the first logging level is of strictly lower priority than the
 * second logging level.
 */
export function logLt(fst: LogLevel, snd: LogLevel): boolean {
  return levelToInt(fst) < levelToInt(snd);
}

/**
 * Return if the first logging level is of lower or equal priority as the
 * second logging level.
 */
export function logLte(fst: LogLevel, snd: LogLevel): boolean {
  return levelToInt(fst) <= levelToInt(snd);
}

/**
 * Return if the first logging level is of strictly greater priority than the
 * second logging level.
 */
export function logGt(fst: LogLevel, snd: LogLevel): boolean {
  return levelToInt(fst) > levelToInt(snd);
}

/**
 * Return if the first logging level is of greater or equal priority as the
 * second logging level.
 */
export function logGte(fst: LogLevel, snd: LogLevel): boolean {
  return levelToInt(fst) >= levelToInt(snd);
}

/**
 * Return the lesser of the two given logging levels.
 */
export function logMin(fst: LogLevel, snd: LogLevel): LogLevel {
  return levelToInt(fst) <= levelToInt(snd) ? fst : snd;
}

/**
 * Return the greater of the two given logging levels.
 */
export function logMax(fst: LogLevel, snd: LogLevel): LogLevel {
  return levelToInt(fst) >= levelToInt(snd) ? fst : snd;
}

/**
 * The interface we require for the logging backend.
 */
export interface LoggingBackend {
  /**
   * Logs some data at the given {@linkcode LogLevel}.
   */
  // deno-lint-ignore no-explicit-any
  log(level: LogLevel, ...data: any[]): void;

  /**
   * Adds an empty line to the log.
   */
  logEmptyLine(): void;

  /**
   * Starts grouping the presentation of the next {@linkcode log} calls until the next call to {@linkcode endGroup}.
   */
  startGroup(): void;

  /**
   * Ends the grouping introduced by the previous call to {@linkcode startGroup}.
   */
  endGroup(): void;
}

/**
 * Test
 *
 * @public
 */
export interface LoggingFormatter {
  /**
   * Format a string such that the logger will render it with black background.
   */
  bgBlack(s: string): string;

  /**
   * Format a string such that the logger will render it with blue background.
   */
  bgBlue(s: string): string;

  /**
   * Format a string such that the logger will render it with bright black background.
   */
  bgBrightBlack(s: string): string;

  /**
   * Format a string such that the logger will render it with bright blue background.
   */
  bgBrightBlue(s: string): string;

  /**
   * Format a string such that the logger will render it with bright cyan background.
   */
  bgBrightCyan(s: string): string;

  /**
   * Format a string such that the logger will render it with bright green background.
   */
  bgBrightGreen(s: string): string;

  /**
   * Format a string such that the logger will render it with bright magenta background.
   */
  bgBrightMagenta(s: string): string;

  /**
   * Format a string such that the logger will render it with bright red background.
   */
  bgBrightRed(s: string): string;

  /**
   * Format a string such that the logger will render it with bright white background.
   */
  bgBrightWhite(s: string): string;

  /**
   * Format a string such that the logger will render it with bright yellow background.
   */
  bgBrightYellow(s: string): string;

  /**
   * Format a string such that the logger will render it with cyan background.
   */
  bgCyan(s: string): string;

  /**
   * Format a string such that the logger will render it with green background.
   */
  bgGreen(s: string): string;

  /**
   * Format a string such that the logger will render it with magenta background.
   */
  bgMagenta(s: string): string;

  /**
   * Format a string such that the logger will render it with red background.
   */
  bgRed(s: string): string;

  /**
   * Format a string such that the logger will render it with white background.
   */
  bgWhite(s: string): string;

  /**
   * Format a string such that the logger will render it with yellow background.
   */
  bgYellow(s: string): string;

  /**
   * Format a string such that the logger will render it with black text colour.
   */
  black(s: string): string;

  /**
   * Format a string such that the logger will render it with blue text colour.
   */
  blue(s: string): string;

  /**
   * Format a string such that the logger will render it bold.
   */
  bold(s: string): string;

  /**
   * Format a string such that the logger will render it with bright black text colour.
   */
  brightBlack(s: string): string;

  /**
   * Format a string such that the logger will render it with bright blue text colour.
   */
  brightBlue(s: string): string;

  /**
   * Format a string such that the logger will render it with bright cyan text colour.
   */
  brightCyan(s: string): string;

  /**
   * Format a string such that the logger will render it with bright green text colour.
   */
  brightGreen(s: string): string;

  /**
   * Format a string such that the logger will render it with bright magenta text colour.
   */
  brightMagenta(s: string): string;

  /**
   * Format a string such that the logger will render it with bright red text colour.
   */
  brightRed(s: string): string;

  /**
   * Format a string such that the logger will render it with bright white text colour.
   */
  brightWhite(s: string): string;

  /**
   * Format a string such that the logger will render it with bright yellow text colour.
   */
  brightYellow(s: string): string;

  /**
   * Format a string such that the logger will render it with cyan text colour.
   */
  cyan(s: string): string;

  /**
   * Format a string such that the logger will render it with dim text colour.
   */
  dim(s: string): string;

  /**
   * Format a string such that the logger will render it with grey text colour.
   */
  grey(s: string): string;

  /**
   * Format a string such that the logger will render it with green text colour.
   */
  green(s: string): string;

  /**
   * Format a string such that the logger will render it italic.
   */
  italic(s: string): string;

  /**
   * Format a string such that the logger will render it with magenta text colour.
   */
  magenta(s: string): string;

  /**
   * Format a string such that the logger will render it with red text colour.
   */
  red(s: string): string;

  /**
   * Format a string such that the logger will render it with a horizontal line through the text.
   */
  strikethrough(s: string): string;

  /**
   * Format a string such that the logger will render it with an underline.
   */
  underline(s: string): string;

  /**
   * Format a string such that the logger will render it with white text colour.
   */
  white(s: string): string;

  /**
   * Format a string such that the logger will render it with yellow text colour.
   */
  yellow(s: string): string;
}
