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

import { Colors, renderMessagePrefix } from "./deps.ts";
import { newStack, Stack } from "./stack.ts";

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
  | FragmentExpression
  | ImpureExpression
  | PreprocessExpression
  | PostprocessExpression
  | MapExpression
  | ConcurrentExpression
  | DebugExpression;

/**
 * A fragment consists of an array of expressions. They are evaulated in
 * sequence and the results are concatenated.
 */
type FragmentExpression = { fragment: Expression[] };

/**
 * An impure expression maps the evaluation {@linkcode Context} to another
 * expression. The function can also return `null`, signalling that it
 * cannot be evaluated just yet. In that case, it is called again in the
 * next evaluation round.
 */
type ImpureExpression = {
  impure:
    | ((ctx: Context) => Expression | null)
    | ((ctx: Context) => Promise<Expression | null>);
};

/**
 * Call a function for its side-effects before attempting to evaluate a
 * wrapped expression.
 */
type PreprocessExpression = {
  preprocess: {
    exp: Expression;
    fun: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>);
  };
};

/**
 * Call a function for its side-effects after attempting to evaluate a
 * wrapped expression.
 */
type PostprocessExpression = {
  postprocess: {
    exp: Expression;
    fun: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>);
  };
};

/**
 * Evaluate an expression to a string and then map that string to an
 * arbitrary new expression.
 */
type MapExpression = {
  map: {
    exp: Expression;
    fun:
      | ((evaluated: string, ctx: Context) => Expression)
      | ((evaluated: string, ctx: Context) => Promise<Expression>);
  };
};

/**
 * Evaluate macros concurrently and concatenate the results in the order in
 * which the macros were supplied.
 */
type ConcurrentExpression = { concurrent: Expression[] };

/**
 * Attach debugging information to an expression. This makes the expression
 * appear in stack traces in case of failed evaluation.
 */
type DebugExpression = {
  debug: {
    exp: Expression;
    info: DebuggingInformation;
  };
};

function expIsFragment(
  exp: Expression,
): exp is FragmentExpression {
  return (typeof exp !== "string") && ("fragment" in exp);
}

function expIsImpure(
  exp: Expression,
): exp is ImpureExpression {
  return (typeof exp !== "string") && ("impure" in exp);
}

function expIsPreprocess(
  exp: Expression,
): exp is PreprocessExpression {
  return (typeof exp !== "string") && ("preprocess" in exp);
}

function expIsPostprocess(
  exp: Expression,
): exp is PostprocessExpression {
  return (typeof exp !== "string") && ("postprocess" in exp);
}

function expIsMap(
  exp: Expression,
): exp is MapExpression {
  return (typeof exp !== "string") && ("map" in exp);
}

function expIsConcurrent(
  exp: Expression,
): exp is ConcurrentExpression {
  return (typeof exp !== "string") && ("concurrent" in exp);
}

function expIsDebug(
  exp: Expression,
): exp is DebugExpression {
  return (typeof exp !== "string") && ("debug" in exp);
}

/**
 * Return whether the given javascript value can be passed to `doEvaluate`
 * without crashing in the outermost case distinction.
 */
// deno-lint-ignore no-explicit-any
function canBeEvaluatedOneStep(x: any): boolean {
  if (typeof x === "string") {
    // We have a string
    return true;
  } else if (typeof x === "object" && x !== null && !Array.isArray(x)) {
    // We have an actual javascript object. Now we can safely check for
    // properties.
    if (Object.hasOwn(x, "fragment")) {
      // We might have a fragment expression.
      // Check if the inner value is an array.
      return Array.isArray(x.fragment);
    } else if (Object.hasOwn(x, "impure")) {
      // We might have an impure expression.
      // Check if the inner value is a function.
      return typeof x.impure === "function";
    } else if (Object.hasOwn(x, "preprocess")) {
      // We might have a preprocess expression.
      const inner = x.preprocess;
      if (typeof inner !== "object") {
        return false;
      } else {
        // Check if it has a `fun` function and an `exp` property.
        return Object.hasOwn(inner, "fun") && typeof inner.fun === "function" &&
          Object.hasOwn(inner, "exp");
      }
    } else if (Object.hasOwn(x, "postprocess")) {
      // We might have a postprocess expression.
      const inner = x.postprocess;
      if (typeof inner !== "object") {
        return false;
      } else {
        // Check if it has a `fun` function and an `exp` property.
        return Object.hasOwn(inner, "fun") && typeof inner.fun === "function" &&
          Object.hasOwn(inner, "exp");
      }
    } else if (Object.hasOwn(x, "map")) {
      // We might have a map expression.
      const inner = x.map;
      if (typeof inner !== "object") {
        return false;
      } else {
        // Check if it has a `fun` function and an `exp` property.
        return Object.hasOwn(inner, "fun") && typeof inner.fun === "function" &&
          Object.hasOwn(inner, "exp");
      }
    } else if (Object.hasOwn(x, "concurrent")) {
      // We might have a concurrent expression.
      // Check if the inner value is an array.
      return Array.isArray(x.concurrent);
    } else if (Object.hasOwn(x, "debug")) {
      // We might have a debug expression.
      const inner = x.debug;
      if (typeof inner !== "object") {
        return false;
      } else {
        // Check if it has an `info` object and an `exp` property.
        return Object.hasOwn(inner, "info") && typeof inner.info === "object" &&
          Object.hasOwn(inner, "exp");
      }
    } else {
      // We have an object but no expression kind matches.
      return false;
    }
  } else {
    // We have neither a string nor an array nor an object.
    return false;
  }
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
 * @param info The {@linkcode DebuggingInformation} to style
 * @returns The {@linkcode DebuggingInformation}, converted to a string with
 * pretty ansi escapes.
 */
export function styleDebuggingInformation(
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
  initial: S,
): [(ctx: Context) => S, (ctx: Context, newState: S) => void] {
  const key = Symbol();

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

// Globally track whether we are in the process of evaluating macros.
// If so, we do not add newly created macros to the "call stack" that we
// maintain for nicer error reporting. Hence, macros that are created
// by other macros do not pollute debugging information; they stay
// implementation details.
let currentlyEvaluating = false;

/**
 * The (deliberately simple) interface we require for the logging backend.
 */
export interface LoggingTarget {
  // deno-lint-ignore no-explicit-any
  log: (...data: any[]) => void;
}

/**
 * The state that is threaded through an evaluation process.
 */
export class Context {
  // The shared mutable state.
  private state: State;
  // Like a callstack, but for the DebuggingInformation of
  // debug expressions.
  private stack: Stack<DebuggingInformation>;
  // True when evaluation would halt if no impure expression returns non-null.
  private haveToMakeProgress: boolean;
  // Count the number of evaluation rounds.
  private round: number;
  // To determine whether `haveToMakeProgress` needs to be set after an
  // evaluation round, we track whether at least one impure expression returned
  // non-null in the current round.
  private madeProgressThisRound: boolean;
  // The Context provides several methods for logging. This field provides the
  // backend for the logging methods.
  private loggingBackend: LoggingTarget;

  /**
   * Create a new `Context`, logging to the given `LoggingTarget`.
   * @param loggingBackend The {@linkcode LoggingTarget} to use. Defaults to the global console.
   */
  constructor(loggingBackend?: LoggingTarget) {
    this.state = new Map();
    this.stack = newStack();
    this.haveToMakeProgress = false;
    this.round = 0;
    this.madeProgressThisRound = false;
    this.loggingBackend = loggingBackend ??
      console /*the global typescript one*/;
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
   * Log a message.
   */
  // deno-lint-ignore no-explicit-any
  public log(...data: any[]): void {
    this.loggingBackend.log(...data);
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
   *
   * @returns A dummy Expression so you can write `return ctx.halt()` in
   * impure or map functions. This function always throws, it never
   * actually returns a value.
   */
  public halt(): Expression {
    // Print a stacktrace of the user-facing macros that lead to the failure.
    this.printStack();

    // Caught in `evaluate`, never leaks.
    throw haltEvaluation;
  }

  /**
   * Print a stacktrace to the console.
   */
  public printStack() {
    let s = this.stack;
    while (!s.isEmpty()) {
      this.loggingBackend.log("  at", styleDebuggingInformation(s.peek()!));
      s = s.pop();
    }
  }

  // Attempt to evaluate a single Expression.
  private async doEvaluate(exp: Expression): Promise<Expression> {
    if (!canBeEvaluatedOneStep(exp)) {
      this.printNonExp(exp);
    }

    if (typeof exp === "string") {
      return exp;
    } else if (expIsFragment(exp)) {
      // Evaluate arrays by successively evaluating their items. Join together
      // adjacent strings to prevent unncecessarily iterating over them separately
      // in future evaluation rounds.
      const evaluated: Expression[] = [];
      let previousEvaluatedToString = false;
      for (const inner of exp.fragment) {
        const innerEvaluated = await this.doEvaluate(inner);

        if (typeof innerEvaluated === "string") {
          if (previousEvaluatedToString) {
            evaluated[evaluated.length - 1] =
              (<string> evaluated[evaluated.length - 1]).concat(
                innerEvaluated,
              );
          } else {
            previousEvaluatedToString = true;
            evaluated.push(innerEvaluated);
          }
        } else {
          evaluated.push(innerEvaluated);
          previousEvaluatedToString = false;
        }
      }

      // Further simplify the array of evaluated expressions if possible,
      // otherwise return it directly.
      if (evaluated.length === 0) {
        return "";
      } else if (evaluated.length === 1) {
        return evaluated[0];
      } else {
        return { fragment: evaluated };
      }
    } else if (expIsImpure(exp)) {
      const unthunk = await exp.impure(this);
      if (unthunk === null) {
        return exp; // Try again next evaluation round.
      } else {
        this.madeProgressThisRound = true;
        return this.doEvaluate(unthunk);
      }
    } else if (expIsPreprocess(exp)) {
      await exp.preprocess.fun(this);

      const evaluated = await this.doEvaluate(exp.preprocess.exp);
      if (typeof evaluated === "string") {
        return evaluated;
      } else {
        exp.preprocess.exp = evaluated;
        return exp;
      }
    } else if (expIsPostprocess(exp)) {
      const evaluated = await this.doEvaluate(exp.postprocess.exp);
      await exp.postprocess.fun(this);

      if (typeof evaluated === "string") {
        return evaluated;
      } else {
        exp.postprocess.exp = evaluated;
        return exp;
      }
    } else if (expIsMap(exp)) {
      const evaluated = await this.doEvaluate(exp.map.exp);

      if (typeof evaluated === "string") {
        const mapped = await exp.map.fun(evaluated, this);
        return this.doEvaluate(mapped);
      } else {
        exp.map.exp = evaluated;
        return exp;
      }
    } else if (expIsConcurrent(exp)) {
      // Evaluate all subexpressions concurrently.
      const allEvaluated = await Promise.all(
        exp.concurrent.map((inner) => this.doEvaluate(inner)),
      );

      // Combine adjacent strings.
      const compressed: Expression[] = [];
      let previousEvaluatedToString = false;
      for (const innerEvaluated of allEvaluated) {
        if (typeof innerEvaluated === "string") {
          if (previousEvaluatedToString) {
            compressed[compressed.length - 1] =
              (<string> compressed[compressed.length - 1]).concat(
                innerEvaluated,
              );
          } else {
            previousEvaluatedToString = true;
            compressed.push(innerEvaluated);
          }
        } else {
          compressed.push(innerEvaluated);
          previousEvaluatedToString = false;
        }
      }

      // Further simplify the array of evaluated expressions if possible,
      // otherwise return it directly.
      if (compressed.length === 0) {
        return "";
      } else if (compressed.length === 1) {
        return compressed[0];
      } else {
        return { concurrent: compressed };
      }
    } else if (expIsDebug(exp)) {
      this.stack = this.stack.push(exp.debug.info);
      const evaluated = await this.doEvaluate(exp.debug.exp);
      this.stack = this.stack.pop();
      if (typeof evaluated === "string") {
        return evaluated;
      } else {
        exp.debug.exp = evaluated;
        return exp;
      }
    } else {
      return this.printNonExp(exp);
    }
  }

  /**
   * Evaluate an expression to a string, or return `null` in case of failure.
   */
  public async evaluate(expression: Expression): Promise<string | null> {
    currentlyEvaluating = true;

    // We catch any thrown `haltEvaluation` values.
    try {
      // Evaluation proceeds in a loop. Try to evaluate the toplevel
      // expression. If it was completely turned into a string, return that
      // string. Otherwise, take the resulting non-string expression and try
      // evaluating it again.
      let exp = expression;
      while (typeof exp != "string") {
        exp = await this.doEvaluate(exp);

        if (!this.madeProgressThisRound) {
          if (this.haveToMakeProgress) {
            // Log the expressions that should have made progress but did not,
            // causing evaluation to give up.
            this.logBlockingExpressions(exp);
            currentlyEvaluating = false;
            return null;
          } else {
            // Try to make progress a final time.
            this.haveToMakeProgress = true;
          }
        }

        // The evaluation round has completed, increase the round counter and
        // reset the `madeProgressThisRound` flag.
        this.round += 1;
        this.madeProgressThisRound = false;

        // And then back to the top of the loop, attempting to evaluate again.
      }

      // End of the evaluation loop. We managed to covert the initial
      // Expression into a string, so we proudly return it.
      currentlyEvaluating = false;
      return exp;
    } catch (err) {
      // If the thrown value was `haltEvaluation`, we return `null` to cleanly
      // indicate evaluation failure. All other exceptions are indeed
      // exceptional and are simply rethrown.
      if (err === haltEvaluation) {
        currentlyEvaluating = false;
        return null;
      } else {
        currentlyEvaluating = false;
        throw err;
      }
    }
  }

  // Terminate execution and give a helpful error message.
  // deno-lint-ignore no-explicit-any
  private printNonExp(x: any): Expression {
    this.log(
      renderMessagePrefix("error", 0),
      `Tried to evaluate a javascript value that was no macromania expression.`,
    );
    this.log(
      renderMessagePrefix("error", 1),
      `Did you put {someJavascript} into a jsx element that evaluated to a non-expression?`,
    );
    this.log(
      renderMessagePrefix("error", 1),
      `Evaluation cannor recover, but here are the value, its json representation, and a macro stacktrace for you to find abd fix the mistake.`,
    );
    this.log();
    this.log(
      renderMessagePrefix("error", 1),
      `The offending value, as passed to console.log():`,
    );
    this.log(x);
    this.log();
    this.log(
      renderMessagePrefix("error", 1),
      `The offending value, as passed to JSON.stringify():`,
    );
    this.log(JSON.stringify(x));
    this.log();
    this.log(
      renderMessagePrefix("error", 1),
      `The stack of macro invocations leading to this predicament:`,
    );
    return this.halt();
  }

  private logBlockingExpressions(exp: Expression) {
    // Prepare for logging, then call a recursive subroutine to do the actual work.
    this.doLogBlockingExpressions(exp, {});
  }

  private doLogBlockingExpressions(
    exp: Expression,
    info: DebuggingInformation,
  ) {
    if (typeof exp === "string") {
      return;
    } else if (expIsFragment(exp)) {
      for (const inner of exp.fragment) {
        this.doLogBlockingExpressions(inner, info);
      }
    } else if (expIsImpure(exp)) {
      this.loggingBackend.log("  ", styleDebuggingInformation(info));
    } else if (expIsPreprocess(exp)) {
      this.doLogBlockingExpressions(exp.preprocess.exp, info);
    } else if (expIsPostprocess(exp)) {
      this.doLogBlockingExpressions(exp.postprocess.exp, info);
    } else if (expIsMap(exp)) {
      this.doLogBlockingExpressions(exp.map.exp, info);
    } else if (expIsConcurrent(exp)) {
      for (const inner of exp.concurrent) {
        this.doLogBlockingExpressions(inner, info);
      }
    } else if (expIsDebug(exp)) {
      this.doLogBlockingExpressions(exp.debug.exp, exp.debug.info);
    }
  }
}

/**
 * Utility type for macros that accept an arbitrary number of children.
 * Use with {@linkcode expressions} to convert into an `Expression[]`.
 */
export type Expressions = undefined | Expression | Expression[];

/**
 * Take the output of a jsx transform and turn it into an array of
 * {@linkcode Expression}s.
 * @param children Some {@linkcode Expressions} to convert.
 * @returns An array of {@linkcode Expression} containing all children.
 */
export function expressions(children: Expressions): Expression[] {
  if (children === undefined) {
    return [];
  } else if (Array.isArray(children)) {
    return children;
  } else {
    return [children];
  }
}

/*
 * And now for jsx shenanigans!
 */

// Intrinsic elements are those with a lowercase name, in React
// those would be html elements.
type MacromaniaIntrinsic =
  | "fragment"
  | "omnomnom"
  | "impure"
  | "map"
  | "concurrent"
  | "lifecycle";

type PropsOmnomnom = { children: Expressions };

type PropsFragment = {
  /**
   * The expressions to form the contents of the created
   * {@linkcode FragmentExpression}.
   */
  exps: Expression[];
};

type PropsImpure = {
  /**
   * Produce an {@linkcode Expression} from a {@linkcode Context}, or signal
   * that this is currently impossible by returning `null`, causing this
   * expression to be scheduled for a later evaluation attempt.
   *
   * @param ctx - The {@linkcode Context} to counsel for expression generation.
   *
   * @returns `null` to reschedule evaluating this, or an
   * {@linkcode Expression} to evaluate next.
   */
  fun:
    | ((ctx: Context) => Expression | null)
    | ((ctx: Context) => Promise<Expression | null>);
};

type PropsMap = {
  children: Expressions;
  /**
   * Receive the evaluated children of the `map` intrinsic and map them (and
   * the current {@linkcode Context}) to a new {@linkcode Expression} to
   * continue evaluation with.
   * @param evaluated - The fully evaluated children of the `map` intrinsic.
   * @param ctx - The {@linkcode Context} to counsel for expression generation.
   * @returns An {@linkcode Expression} to evaluate next.
   */
  fun:
    | ((evaluated: string, ctx: Context) => Expression)
    | ((evaluated: string, ctx: Context) => Promise<Expression>);
};

type PropsLifecycle = {
  children: Expressions;
  pre?: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>);
  post?: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>);
};

type PropsConcurrent = {
  /**
   * The expressions to form the contents of the created
   * {@linkcode ConcurrentExpression}.
   */
  children: Expressions;
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
    /**
     * Evaluate the child expressions for their side-efects.
     * Evaluates to the empty string.
     */
    omnomnom: PropsOmnomnom;
    /**
     * Evaluate an array of expressions and concatenate the results.
     */
    fragment: PropsFragment;
    /**
     * Create an {@linkcode Expression} dependent on the current
     * {@linkcode Context}, and evaluate it.
     */
    impure: PropsImpure;
    /**
     * Evaluate some children and then create a new {@linkcode Expression} from
     * the resulting string and the current {@linkcode Context}.
     */
    map: PropsMap;
    /**
     * Run some stateful functions before and after evaluating the child
     * expressions.
     */
    lifecycle: PropsLifecycle;
    /**
     * Evaluate an array of expressions concurrently, and concatenate the results.
     */
    concurrent: PropsConcurrent;
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
// This is not concerned with evaluation-time invocation of
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
  _isStaticChildren: boolean,
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
      map: { exp: props.children, fun: (_: string) => "" },
    }, info);
  } else if (macro === "fragment") {
    return maybeWrapWithInfo({ fragment: props.exps }, info);
  } else if (macro === "impure") {
    return maybeWrapWithInfo({ impure: props.fun }, info);
  } else if (macro === "map") {
    return maybeWrapWithInfo({
      map: { exp: { fragment: expressions(props.children) }, fun: props.fun },
    }, info);
  } else if (macro === "lifecycle") {
    return maybeWrapWithInfo({
      preprocess: {
        exp: {
          postprocess: {
            exp: { fragment: expressions(props.children) },
            fun: props.post ?? ((_) => {}),
          },
        },
        fun: props.pre ?? ((_) => {}),
      },
    }, info);
  } else if (macro === "concurrent") {
    return maybeWrapWithInfo({ concurrent: expressions(props.children) }, info);
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
  if (currentlyEvaluating || macroDepth > 0 || !info) {
    return exp;
  } else {
    return { debug: { exp, info } };
  }
}

export function Fragment(
  { children }: { children: Expression[] },
): Expression {
  return { fragment: children };
}
