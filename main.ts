/*

888b     d888                                                                   d8b
8888b   d8888                                                                   Y8P
88888b.d88888
888Y88888P888  8888b.   .d8888b 888d888 .d88b.  88888b.d88b.   8888b.  88888b.  888  8888b.
888 Y888P 888     "88b d88P"    888P"  d88""88b 888 "888 "88b     "88b 888 "88b 888     "88b
888  Y8P  888 .d888888 888      888    888  888 888  888  888 .d888888 888  888 888 .d888888
888   "   888 888  888 Y88b.    888    Y88..88P 888  888  888 888  888 888  888 888 888  888
888       888 "Y888888  "Y8888P 888     "Y88P"  888  888  888 "Y888888 888  888 888 "Y888888

*/

import * as Colors from "https://deno.land/std@0.204.0/fmt/colors.ts";
import { new_stack, Stack } from "./stack.ts";

/**
 * An expression, to be evaluated to a string.
 *
 * Evaluation is not a pure function, but threads a {@linkcode Context} value
 * through the evaluation, which can be read and manipulated by the functions
 * that get called as part of evaluating certain expressions.
 */
export type Expression =
  /**
   * Every string evaluates to itself.
   */
  | string
  /**
   * An array of expressions is evaluated by evaluating its subexpressions and
   * concatenating the result.
   */
  | Expression[]
  /**
   * An impure expression maps the evaluation {@linkcode Context} to another
   * expression. The function can also return `null`, signalling that it
   * cannot be evaluated just yet. In that case, it is called again in the
   * next evaluation round.
   */
  | { impure: (ctx: Context) => Expression | null }
  /**
   * Call a function for its side-effects before attempting to evaluate a
   * wrapped expression.
   */
  | {
    preprocess: {
      exp: Expression;
      fun: (ctx: Context) => void;
    };
  }
  /**
   * Call a function for its side-effects after attempting to evaluate a
   * wrapped expression.
   */
  | {
    postprocess: {
      exp: Expression;
      fun: (ctx: Context) => void;
    };
  }
  /**
   * Evaluate an expression to a string and then map that string to an
   * arbitrary new expression.
   */
  | {
    map: {
      exp: Expression;
      fun: (evaluated: string, ctx: Context) => Expression;
    };
  }
  /**
   * Attach debugging information to an expression. This makes the expression
   * appear in stack traces in case of failed evaluation.
   */
  | {
    debug: {
      exp: Expression;
      info: DebuggingInformation;
    };
  };

function expIsImpure(
  exp: Expression,
): exp is { impure: (ctx: Context) => Expression | null } {
  return (typeof exp !== "string") && !Array.isArray(exp) && ("impure" in exp);
}

function expIsPreprocess(
  exp: Expression,
): exp is {
  preprocess: {
    exp: Expression;
    fun: (ctx: Context) => void;
  };
} {
  return (typeof exp !== "string") && !Array.isArray(exp) &&
    ("preprocess" in exp);
}

function expIsPostprocess(
  exp: Expression,
): exp is {
  postprocess: {
    exp: Expression;
    fun: (ctx: Context) => void;
  };
} {
  return (typeof exp !== "string") && !Array.isArray(exp) &&
    ("postprocess" in exp);
}

function expIsMap(
  exp: Expression,
): exp is {
  map: {
    exp: Expression;
    fun: (evaluated: string, ctx: Context) => Expression;
  };
} {
  return (typeof exp !== "string") && !Array.isArray(exp) && ("map" in exp);
}

function expIsDebug(
  exp: Expression,
): exp is {
  debug: {
    exp: Expression;
    info: DebuggingInformation;
  };
} {
  return (typeof exp !== "string") && !Array.isArray(exp) && ("debug" in exp);
}

/**
 * Debugging information that can be attached to {@linkcode Expression}s via
 * {@linkcode StacktracingExpression}s.
 */
export interface DebuggingInformation {
  /**
   * The file in which the annotated {@linkcode Expression} was created.
   */
  file?: string;
  /**
   * The line in which the annotated {@linkcode Expression} was created.
   */
  line?: number;
  /**
   * The column in which the annotated {@linkcode Expression} was created.
   */
  column?: number;
  /**
   * The name of the function (macro) that created the annotated
   * {@linkcode Expression}.
   */
  name?: string;
}

/**
 * Style {@linkcode DebuggingInformation} for terminal output.
 * @param info The {@linkcode DebuggingInformation} to tyle
 * @returns The {@linkcode DebuggingInformation}, converted to a string with
 * pretty ansi escapes.
 */
export function formatDebuggingInformation(
  info: DebuggingInformation,
): string {
  const name = Colors.bold(Colors.italic(info.name ?? "anonymous"));
  const file = info.file ? ` in ${styleFile(info.file)}` : "";
  const position = info.file && info.line
    ? Colors.yellow(`:${info.line}${info.column ? `:${info.column}` : ""}`)
    : "";
  return `${name}${file}${position}`;
}

/**
 * Style a filename for terminal output.
 * @param s The name to style.
 * @returns The name with ansi escape sequences for styling.
 */
export function styleFile(s: string): string {
  return Colors.cyan(s);
}

/**
 * Shared state during an evaluation that can be freely used by macros.
 *
 * The itention is for macro authors to keep the symbols they use private, and
 * to export strongly typed functions for interacting with their parts of the
 * state instead. See {@linkcode createSubstate}.
 */
// deno-lint-ignore no-explicit-any
export type State = Map<symbol, any>;

/**
 * Create a getter and a setter for a unique, statically typed portion of the
 * {@linkcode State} of a {@linkcode Context}.
 * @param name Name of the substate, for debugging puroses only.
 * @param initial The initial state.
 * @returns A getter and a setter for the substate.
 */
export function createSubstate<S>(
  name: string,
  initial: S,
): [(ctx: Context) => S, (ctx: Context, newState: S) => void] {
  const key = Symbol(name);

  const get = (ctx: Context) => {
    const got = ctx.getState().get(key);

    if (got === undefined) {
      ctx.getState().set(key, structuredClone(initial));
      return ctx.getState().get(key)!;
    } else {
      return got;
    }
  };

  const set = (ctx: Context, newState: S) => {
    ctx.getState().set(key, newState);
  };

  return [get, set];
}

// Throwing the following symbol immediately terminates evaluation. This value
// is not exposed, it is an implementation detail of `Context.halt()`.
const haltEvaluation = Symbol("Halt Evaluation");

/**
 * The state that is threaded through an evaluation process.
 */
export class Context {
  // The shared mutable state.
  private state: State;
  // Like a callstack, but for the DebuggingInformation of
  // debug expressions.
  private stack: Stack<DebuggingInformation>;
  // True when evaluation would halt if no impure expression rturns non-null.
  private haveToMakeProgress: boolean;
  // Count the number of evaluation rounds.
  private round: number;
  // To determine whether `haveToMakeProgress` needs to be set after an
  // evaluation round, we track whether at least one impure expression returned
  // non-null in the current round.
  private madeProgressThisRound: boolean;
  // Track whether at least one warning or error was logged.
  private warnOrWorse;
  // Only log messages of at least this severity.
  private loggingLevel: LoggingLevel;
  // The Context provides several methods for logging. This field provides the
  // backend for the logging methods.
  private console: Console;

  /**
   * Create a new `Context`, logging at the given logging lever to the given
   * `Console`.
   * @param loggingLevel The logging level below which to not log anything.
   * Defaults to `"warn"`.
   * @param console_ The `Console` to use for the logging methods on `Context`.
   * Defaults to the global console.
   */
  /**
   * @param loggingLevel
   * @param console_
   */
  constructor(loggingLevel?: LoggingLevel, console_?: Console) {
    this.state = new Map();
    this.stack = new_stack();
    this.haveToMakeProgress = false;
    this.round = 0;
    this.madeProgressThisRound = false;
    this.warnOrWorse = false;

    this.loggingLevel = loggingLevel ?? "warn";
    this.console = console_ ? console_ : console /*the global typescript one*/;
  }

  /**
   * @returns The {@linkcode State} for this evaluation.
   */
  public getState(): State {
    return this.state;
  }

  /**
   * @returns A stack of all the {@linkcode DebuggingInformation} of all
   * ancestor {@linkcode StacktracingExpression}s of the currently evaluated
   * expression.
   */
  public getDebuggingStack(): Stack<DebuggingInformation> {
    return this.stack;
  }

  /**
   * @returns The {@linkcode DebuggingInformation} of the
   * {@linkcode StacktracingExpression} closest to the currently evaluated
   * expression. An empty object if there is none.
   */
  public getCurrentDebuggingInformation(): DebuggingInformation {
    return this.stack.peek() ?? {};
  }

  /**
   * When no impure expression makes progress in an evaluation
   * round, another round is started, in which this function returns `true`.
   * If no impure expression makes progress in that round either,
   * evaluation stops.
   *
   * @returns `true` if progress must be made, `false` otherwise.
   */
  public mustMakeProgress(): boolean {
    return this.haveToMakeProgress;
  }

  /**
   * @returns The current evaluation round number.
   */
  public getRound(): number {
    return this.round;
  }

  /**
   * Log trace-level output.
   */
  // deno-lint-ignore no-explicit-any
  public trace(...data: any[]): void {
    if (logging_level_lte(this.loggingLevel, "trace")) {
      this.console.trace(Colors.dim("[trace]"), ...data);
    }
  }

  /**
   * Log trace-level output, annotated with the current
   * {@linkcode DebuggingInformation}.
   */
  // deno-lint-ignore no-explicit-any
  public trace_at(...data: any[]): void {
    if (logging_level_lte(this.loggingLevel, "trace")) {
      this.console.trace(
        Colors.dim("[trace]"),
        ...data,
        "at",
        formatDebuggingInformation(this.getCurrentDebuggingInformation()),
      );
    }
  }

  /**
   * Log informational output.
   */
  // deno-lint-ignore no-explicit-any
  public info(...data: any[]): void {
    if (logging_level_lte(this.loggingLevel, "info")) {
      this.console.info(Colors.blue("[info]"), ...data);
    }
  }

  /**
   * Log informational output, annotated with the current
   * {@linkcode DebuggingInformation}.
   */
  // deno-lint-ignore no-explicit-any
  public info_at(...data: any[]): void {
    if (logging_level_lte(this.loggingLevel, "info")) {
      this.console.info(
        Colors.green("[info]"),
        ...data,
        "at",
        formatDebuggingInformation(this.getCurrentDebuggingInformation()),
      );
    }
  }

  /**
   * Log a warning.
   */
  // deno-lint-ignore no-explicit-any
  public warn(...data: any[]): void {
    this.warnOrWorse = true;
    if (logging_level_lte(this.loggingLevel, "warn")) {
      this.console.warn(Colors.yellow("[warn]"), ...data);
    }
  }

  /**
   * Log a warning, annotated with the current
   * {@linkcode DebuggingInformation}.
   */
  // deno-lint-ignore no-explicit-any
  public warn_at(...data: any[]): void {
    this.warnOrWorse = true;
    if (logging_level_lte(this.loggingLevel, "warn")) {
      this.console.warn(
        Colors.yellow("[warn]"),
        ...data,
        "at",
        formatDebuggingInformation(this.getCurrentDebuggingInformation()),
      );
    }
  }

  /**
   * Log an error.
   */
  // deno-lint-ignore no-explicit-any
  public error(...data: any[]): void {
    this.warnOrWorse = true;
    if (logging_level_lte(this.loggingLevel, "error")) {
      this.console.error(Colors.red("[err]"), ...data);
    }
  }

  /**
   * Log an error, annotated with the current {@linkcode DebuggingInformation}.
   */
  // deno-lint-ignore no-explicit-any
  public error_at(...data: any[]): void {
    this.warnOrWorse = true;
    if (logging_level_lte(this.loggingLevel, "error")) {
      this.console.warn(
        Colors.red("[err]"),
        ...data,
        "at",
        formatDebuggingInformation(this.getCurrentDebuggingInformation()),
      );
    }
  }

  /**
   * Return whether at least one warning or error logging method was called,
   * regardless of the logging level.
   */
  public didWarnOrWorse() {
    return this.warnOrWorse;
  }

  /**
   * Return whether evaluation has been given up because no progress could
   * be made.
   */
  public didGiveUp() {
    return this.mustMakeProgress() && !this.madeProgressThisRound;
  }

  /**
   * Print a stacktrace, then immediately and faultily terminate evaluation.
   */
  public halt(): void {
    // Print a stacktrace of the user-facing macros that lead to the failure.
    this.console.group("");
    let stack = this.stack;
    while (!stack.is_empty()) {
      this.console.log("at", formatDebuggingInformation(stack.peek()!));
      stack = stack.pop();
    }
    this.console.groupEnd();

    // Caught in `evaluate`, never leaks.
    throw haltEvaluation;
  }

  // Attempt to evaluate a single Expression.
  private do_evaluate(exp: Expression): Expression {
    if (typeof exp === "string") {
      return exp;
    } else if (Array.isArray(exp)) {
      // Evaluate arrays by successively evaluating their items. Join together
      // adjacent strings to prevent unncecessarily iterating over them separately
      // in future evaluation rounds.
      const evaluated: Expression = [];
      let previous_evaluated_to_string = false;
      for (const inner of exp) {
        const inner_evaluated = this.do_evaluate(inner);

        if (typeof inner_evaluated === "string") {
          if (previous_evaluated_to_string) {
            evaluated[evaluated.length - 1] =
              (<string> evaluated[evaluated.length - 1]).concat(
                inner_evaluated,
              );
          } else {
            previous_evaluated_to_string = true;
            evaluated.push(inner_evaluated);
          }
        } else {
          evaluated.push(inner_evaluated);
        }
      }

      // Further simplify the array of evaluated expressions if possible,
      // otherwise return it directly.
      if (evaluated.length === 0) {
        return "";
      } else if (evaluated.length === 1) {
        return evaluated[0];
      } else {
        return evaluated;
      }
    } else if (expIsImpure(exp)) {
      const unthunk = exp.impure(this);
      if (unthunk === null) {
        return exp; // Try again next evaluation round.
      } else {
        this.madeProgressThisRound = true;
        return this.do_evaluate(unthunk);
      }
    } else if (expIsPreprocess(exp)) {
      exp.preprocess.fun(this);

      const evaluated = this.do_evaluate(exp.preprocess.exp);
      if (typeof evaluated === "string") {
        return evaluated;
      } else {
        exp.preprocess.exp = evaluated;
        return exp;
      }
    } else if (expIsPostprocess(exp)) {
      const evaluated = this.do_evaluate(exp.postprocess.exp);
      exp.postprocess.fun(this);

      if (typeof evaluated === "string") {
        return evaluated;
      } else {
        exp.postprocess.exp = evaluated;
        return exp;
      }
    } else if (expIsMap(exp)) {
      const evaluated = this.do_evaluate(exp.map.exp);

      if (typeof evaluated === "string") {
        const mapped = exp.map.fun(evaluated, this);
        return this.do_evaluate(mapped);
      } else {
        exp.map.exp = evaluated;
        return exp;
      }
    } else if (expIsDebug(exp)) {
      this.stack = this.stack.push(exp.debug.info);
      const evaluated = this.do_evaluate(exp.debug.exp);
      this.stack.pop();
      if (typeof evaluated === "string") {
        return evaluated;
      } else {
        exp.debug.exp = evaluated;
        return exp;
      }
    } else {
      // If typescript had a stricter type system, this case would be unreachable.
      throw new Error(`Tried to evaluate a value that is not an Expression.
  Someone somewhere did type-system shenanigans that went wrong.

  ${exp}`);
    }
  }

  /**
   * Evaluate an expression to a string, or return `null` in case of failure.
   */
  public evaluate(expression: Expression): string | null {
    // We catch any thrown `halt_evaluation` values.
    try {
      // Evaluation proceeds in a loop. Try to evaluate the toplevel
      // expression. If it was completely turned into a string, return that
      // string. Otherwise, take the resulting non-string expression and try
      // evaluating it again.
      let exp = expression;
      while (typeof exp != "string") {
        exp = this.do_evaluate(exp);

        if (!this.madeProgressThisRound) {
          if (this.haveToMakeProgress) {
            // Log the expressions that should have made progress but did not,
            // causing evaluation to give up.
            this.logBlockingExpressions(exp);
            return null;
          } else {
            // Try to make progress a final time.
            this.haveToMakeProgress = true;
          }
        }

        // The evaluation round has completed, increase the round counter and
        // reset the `made_progress_this_round` flag.
        this.round += 1;
        this.madeProgressThisRound = false;

        // And then back to the top of the loop, attempting to evaluate again.
      }

      // End of the evaluation loop. We managed to covert the initial
      // Expression into a string, so we proudly return it.
      return exp;
    } catch (err) {
      // If the thrown value was `halt_evaluation`, we return `null` to cleanly
      // indicate evaluation failure. All other exceptions are indeed
      // exceptional and are simply rethrown.
      if (err === haltEvaluation) {
        return null;
      } else {
        throw err;
      }
    }
  }

  private logBlockingExpressions(exp: Expression) {
    // Prepare for logging, then call a recursive subroutine to do the actual work.
    console.log(exp);

    this.console.group("Evaluation was blocked by:");
    this.doLogBlockingExpressions(exp, {});
    this.console.groupEnd();
  }

  private doLogBlockingExpressions(
    exp: Expression,
    info: DebuggingInformation,
  ) {
    if (typeof exp === "string") {
      return;
    } else if (Array.isArray(exp)) {
      for (const inner of exp) {
        this.doLogBlockingExpressions(inner, info);
      }
    } else if (expIsImpure(exp)) {
      this.console.log(formatDebuggingInformation(info));
    } else if (expIsPreprocess(exp)) {
      this.doLogBlockingExpressions(exp.preprocess.exp, info);
    } else if (expIsPostprocess(exp)) {
      this.doLogBlockingExpressions(exp.postprocess.exp, info);
    } else if (expIsMap(exp)) {
      this.doLogBlockingExpressions(exp.map.exp, info);
    } else if (expIsDebug(exp)) {
      this.doLogBlockingExpressions(exp.debug.exp, exp.debug.info);
    }
  }
}

export type LoggingLevel = "trace" | "info" | "warn" | "error";

function logging_level_lte(l1: LoggingLevel, l2: LoggingLevel): boolean {
  if (l1 === "trace") {
    return true;
  } else if (l1 === "info" && l2 != "trace") {
    return true;
  } else if (l1 === "warn" && l2 != "trace" && l2 != "info") {
    return true;
  } else {
    return l2 === "error";
  }
}

/*
 * And now for jsx shenanigans!
 */

// Intrinsic elements are those with a lowercase name, in React
// those would be html elements.
type MacromaniaIntrinsic =
  | "omnomnom"
  | "impure"
  | "preprocess"
  | "postprocess"
  | "map"
  | "lifecycle";

type PropsOmnomnom = { args: Expression };
type PropsImpure = { fun: (ctx: Context) => Expression | null };
type PropsPreprocess = { args: Expression; fun: (ctx: Context) => void };
type PropsPostprocess = { args: Expression; fun: (ctx: Context) => void };
type PropsMap = { args: Expression; fun: (ctx: Context) => void };
type PropsLifecycle = {
  args: Expression;
  pre: (ctx: Context) => void;
  post: (ctx: Context) => void;
};

export declare namespace JSX {
  // All jsx evaluates to a number.
  // https://devblogs.microsoft.com/typescript/announcing-typescript-5-1-beta/#decoupled-type-checking-between-jsx-elements-and-jsx-tag-types
  // https://www.typescriptlang.org/docs/handbook/jsx.html#the-jsx-result-type
  type Element = Expression;

  // export type ElementType = number;

  // Configure the intrinsic elements and their props.
  // https://www.typescriptlang.org/docs/handbook/jsx.html#intrinsic-elements
  // https://www.typescriptlang.org/docs/handbook/jsx.html#attribute-type-checking
  interface IntrinsicElements {
    omnomnom: PropsOmnomnom;
    impure: PropsImpure;
    preprocess: PropsPreprocess;
    postprocess: PropsPostprocess;
    map: PropsMap;
    lifecycle: PropsLifecycle;
  }

  interface ElementAttributesProperty {
    // deno-lint-ignore ban-types
    props: {}; // specify the property name to use
  }

  interface ElementChildrenAttribute {
    // deno-lint-ignore ban-types
    children: {}; // specify children name to use
  }
}

// Source information provided by the react-jsxdev jsx-transform
interface JsxSource {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

function jsxSourceToDebuggingInformation(
  name: string,
  src: JsxSource,
): DebuggingInformation {
  return {
    file: src.fileName,
    line: src.lineNumber,
    column: src.columnNumber,
    name,
  };
}

// Track how many macros are currently on the js callstack.
// This is not concerned with evaluation-time invokation of
// functions on expressions, but with turning user input into
// the initial expression to evaluate.
let macroDepth = 0;

// jsxFactory for the ASCP, to be used with jsx-transform `react-jsxdev`
// https://www.typescriptlang.org/tsconfig#jsxFactory
// https://www.typescriptlang.org/tsconfig#jsx
// https://babeljs.io/docs/babel-plugin-transform-react-jsx-development
export function jsxDEV(
  // deno-lint-ignore no-explicit-any
  macro: MacromaniaIntrinsic | ((props: any) => Expression),
  // deno-lint-ignore no-explicit-any
  props: any,
  _key: undefined,
  _is_static_children: boolean,
  source: JsxSource | undefined,
  // deno-lint-ignore no-explicit-any
  _self: any,
): Expression {
  const info = source
    ? jsxSourceToDebuggingInformation(
      typeof macro === "string" ? macro : macro.name,
      source,
    )
    : undefined;

  if (macro === "omnomnom") {
    return maybeWrapWithInfo({
      map: { exp: props.args, fun: (_: string) => "" },
    }, info);
  } else if (macro === "impure") {
    return maybeWrapWithInfo({ impure: props.fun }, info);
  } else if (macro === "preprocess") {
    return maybeWrapWithInfo({
      preprocess: { exp: props.args, fun: props.fun },
    }, info);
  } else if (macro === "postprocess") {
    return maybeWrapWithInfo({
      postprocess: { exp: props.args, fun: props.fun },
    }, info);
  } else if (macro === "map") {
    return maybeWrapWithInfo({
      map: { exp: props.args, fun: props.fun },
    }, info);
  } else if (macro === "lifecycle") {
    return maybeWrapWithInfo({
      preprocess: {
        exp: { postprocess: { exp: props.args, fun: props.post } },
        fun: props.pre,
      },
    }, info);
  } else {
    macroDepth += 1;
    const exp = macro(props);
    macroDepth -= 1;
    return maybeWrapWithInfo(exp, info);
  }
}

function maybeWrapWithInfo(
  exp: Expression,
  info?: DebuggingInformation,
): Expression {
  // If macroDepth > 0, then we are dealing with an expression that was not
  // supplied by the user, but which is an implementation detail of a macro,
  // and should hence not show up in stacktraces.
  // info is `undefined` for jsx fragments, which we wish to ignore anyways.
  if (macroDepth > 0 || !info) {
    return exp;
  } else {
    return { debug: { exp, info } };
  }
}

export function Fragment(
  { children }: { children: Expression[] },
): Expression {
  return children;
}
