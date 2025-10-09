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

/**
 * # Macromania!
 *
 * Macromania is a typescript-embedded domain-specific language for creating
 * strings, using [jsx syntax](https://en.wikipedia.org/wiki/JSX_(JavaScript)). You
 * can think of it as a highly expressive but completely unopinionated templating
 * language. It takes inspiration from lisp-like macro expansion and
 * [TeX](https://en.wikipedia.org/wiki/TeX), but the design ensures meaningful
 * error reporting, principled interaction between stateful macros, and static
 * typing for the input expressions.
 *
 * See the [Macromania website](https://macromania.worm-blossom.org/) for introductory content; these API docs serve as a reference more than as an onboarding ramp. The following docs assume a basic understanding of how to use macromania already.
 *
 * Throughout these docs, *writer* refers to people authoring content using Macromania, and *developer* refers to people programming Macromania macros. After a common section on Macromania setup, this high-level overview is split into first the features intended for *writers*, and then the features intended for *developers*.
 *
 * ## Setup
 *
 * Both *writers* of content and *developers* of macros need to configure Deno to correctly process the tsx of Macromania. In the [`deno.json`](https://docs.deno.com/runtime/fundamentals/configuration/) file, make sure that
 *
 * - the `imports` map includes the `jsr:@macromania/macromania` package, and
 * - the `compilerOptions` specify both
 *   - `jsxImportSource": "<your-import-of-macromania>"` and
 *   - `"jsx": "react-jsxdev"`.
 *
 * A complete example `deno.json`:
 *
 * ```json
 {
  "name": "getting-started-with-macromania",
  "version": "1.0.0",

  "imports": {
    "macromania": "jsr:@macromania/macromania",
  },

  "compilerOptions": {
    "jsx": "react-jsxdev",
    "jsxImportSource": "macromania",
    "lib": ["deno.ns", "dom"],
    "strict": true
  },
}
 * ```
 *
 * Chances are you want your text editor or IDE to also pick up this configuration. Depending on your specific editor and its workspace settings, you may need to place similar `deno.json` files at a workspace level in addition to the deno package level. When in doubt, try opening only the package you are working on instead of a whole workspace.
 *
 * By the way: the `"jsx": "react-jsxdev"` line does not introduce any dependencies on the [`react`](https://react.dev/) libraray, it merely specifies a particular way in which typescript compilers will convert jsx and tsx into plain javascript and typescript respectively.
 *
 * We provide a minimal [demo setup here](https://codeberg.org/worm-blossom/getting-started-with-macromania).
 *
 * ## Macromania for Writers
 *
 * The entrypoint to using Macromania for *writers* is the {@linkcode Context} class. The basic workflow is to create a context, give it an expression, and call its async {@linkcode Context.prototype.evaluate | evaluate} method to evaluate the expression into a plain string.
 *
 * ```ts
import { Context } from "macromania";
const ctx = new Context();
console.log(await ctx.evaluate("Hi!"));
// Logs `Hi!`.
 * ```
 *
 * Evaluation of more complex expressions may fail, in which case {@linkcode Context.prototype.evaluate | evaluate} yields `null`.
 *
 * The {@linkcode Context.prototype.didGiveUp | didGiveUp} method returns `true` iff evaluation failed because of a deadlock where no macro could be evaluated for two successive evaluation rounds.
 *
```ts
import { Context } from "macromania";
const ctx = new Context();

// The expression will never make evaluation progress.
// Evaluation will give up after two evaluation rounds.
const result = await ctx.evaluate(<effect fun={(_ctx) => null}/>);

// Logs `null, true`.
console.log(result, ctx.didGiveUp());
 * ```
 *
 * The {@linkcode Context.prototype.didWarnOrError |  didWarnOrError} method reports whether at least one warning or error was logged during evaluation.
 *
 * ```ts
import { Context } from "macromania";
const ctx = new Context();

const result = await ctx.evaluate(<warn>oh no</warn>);

// Logs `true`.
console.log(ctx.didWarnOrError());
 * ```
 *
 * Beyond these aspects of the {@linkcode Context} class, there are a couple of *intrinsics* that writers should know about. *Intrinsics* are those tsx "tags" which are built into macromania and which do not need to be imported. Unlike user-defined macros, their names start with a lowercase letter.
 *
 * The following intrinsics are useful for writers (i.e., have uses outside of macro creation).
 *
 * ### `omnomnom`
 *
 * The `<omnomnom>` intrinsic evaluates its children, but swallows the output and yields the empty string.
 *
 * ```ts
import { Context } from "macromania";

const ctx = new Context();
// Logs `"ac"`.
console.log(await ctx.evaluate(<>a<omnomnom>b</omnomnom>c</>));
 * ```
 *
 * ### `sequence`
 *
 * The `<sequence>` intrinsic evaluates an array of expressions in strict sequence: only once one expression has been evaluated to completion does evaluation of the next expression start.
 *
 * Some macros might have implicit dependenices on each other, where one can only operate once the other has been evaluated. Use this intrinsic in such situations. Also, consider using different macros in such situations. Ideally, you will never need to reach for this intrinsic at all.
 *
 * ```ts
import { Context } from "macromania";

const ctx = new Context();
// Logs `"abc"`, and evaluated those highly complex expressions in strict sequence.
console.log(await ctx.evaluate(<sequence x={["a", "b", "c"]} />));
 * ```
 *
 * ### Logging
 *
 * The `<log>` intrinsic logs its contents at a given {@linkcode LogLevel}. It itself evaluates to the empty string.
 *
 * ```ts
import { Context } from "macromania";

const ctx = new Context();
await ctx.evaluate(<log level="warn">oh no</log>);
 * ```
 *
 * For convenience, there are intrinsicts for each of the supported logging levels (except for the `"ignore"` level):
 *
 * ```ts
import { Context } from "macromania";

const ctx = new Context();
await ctx.evaluate(<>
  <debug>hmm</debug>
  <trace>doing stuff</trace>
  <info>it worked</info>
  <warn>oh no</warn>
  <error>nope!</error>
</>);
 * ```
 *
 * Finally, the `<loggingGroup>` macro will visually group all logging calls within its children, for example, by indentation.
 *
 * ```ts
import { Context } from "macromania";

const ctx = new Context();
await ctx.evaluate(<>
  <info>starting the computer</info>
  <loggingGroup>
    <info>running the bootloader</info>
    <info>initialising the file system</info>
  </loggingGroup>
</>);
 * ```
 *
 * ### `loggingLevel`
 *
 * The `<loggingLevel>` intrinsic configures the logging level for all child expressions. It has a mandatory `level` prop to select the {@linkcode LogLevel} to apply to its child expressions. Any logging operations of a level below the specified level will be silenced. When not using this intrinsic at all, the default threshold is to log only warnings and errors.
 *
 * ```ts
import { Context } from "macromania";

const ctx = new Context();
console.log(await ctx.evaluate(<>
  <loggingLevel level="info">
    <trace>will not be logged</trace>
    <info>will be logged</info>
    <warn>will be logged</warn>
  </loggingLevel>
</>));
 * ```

While the `<loggingLevel level="<some-level>">` form of the `<loggingLevel>` intrinsic applies to *all* logging operations in its child expressions, you can also restrict it to apply to only the logging operations happening in the expansion of certain macros, via the `macro` prop.

```ts
import { Context, Expression } from "macromania";

const ctx = new Context();

function ExampleMacro(): Expression {
  return <info>hi from the macro</info>;
}

console.log(
  await ctx.evaluate(
    <>
      <loggingLevel level="info" macro={ExampleMacro}>
        <ExampleMacro />
        <info>will not be logged</info>
      </loggingLevel>
    </>,
  ),
);
 * ```
 *
 * ## Macromania for Developers
 *
 * Macro developers will want to familiarise themselves with the full API of the {@linkcode Context} class. Additionally, there are a handful of intrinsics that are not needed for writing content but which help in defining macros.
 *
 * ### `xs`
 *
 * The `<xs>` (*expressions*) intrinsic provides a way of turning any {@linkcode Children} passed to a macro into a single expression that can be returned or used in tsx:
 *
 * ```ts
function Transparent({children}: {children: Children}): Expression {
  return <xs x={children}/>;
}
 * ```
 *
 * The `<xs>` intrinsic is a purely technical necessity, tsx would emit compile errors if you tried something like `return children` or `return <>{children}</>`. This is because tsx expects single expressions, but passes the children of a macro as one of `undefined`, `Expression`, or `Expression[]`, depending on the macro invocation.
 *
 * ### `effect`
 *
 * The `<effect>` intrinsic allows to create macros which can compute their output from a function, and that funciton is given access to the evaluating {@linkcode Context}.
 *
 * ```ts
function IsEverythingkOk(): Expression {
  return (
    <effect
      fun={(ctx: Context) => {
        if (ctx.didWarnOrError()) {
          return "oh no";
        } else {
          return "yay";
        }
      }}
    />
  );
}
 * ```
 *
 * The mandatory `fun` prop must be a function that takes a {@linkcode Context} and returns an expression, `null`, or a `Promise` of either.
 * When returning an expression, macro evaluation proceeds by evaluating that expression — effectively, the `<effect>` intrinsic replaces itself with the return value of the function in this case. When the function returns `null`, this signals to the context that the macro could not be evaluated yet. Evaluation proceeds with a different macro then, and only returns back to this `<effect>` intrinsic once every other expression had an evaluation attempt.
 *
 * Note that macro evaluation will fail if there are ever two successive rounds of evaluation attempts in which not a single macro makes progress. Macros can query whether the current round of evaluation is in danger of being the final one with the {@linkcode Context.prototype.mustMakeProgress | Context.mustMakeProgress} method.
 *
 * ```ts
function Ornery(): Expression {
  return (
    <effect
      fun={(ctx: Context) => {
        if (ctx.mustMakeProgress()) {
          return "okay, I'll evaluate to something";
        } else {
          return null;
        }
      }}
    />
  );
}
 * ```
 *
 * See also the {@linkcode Context.createState} function for information on how to make domain-specific state accessible to the `fun` function via the context.
 *
 * ### `map`
 *
 * The `<map>` intrinsic first evaluates its children to a string, and then passes that string (and the evaluating {@linkcode Context}) to a function. That function returns a new expression (or a `Promise` of one), which then replaces the `<map>` intrinsic in the evaluation process.
 *
 * ```ts
function Yell({ children }: { children: Children }): Expression {
  const fun = (_: Context, evaled: string) => evaled.toUpperCase();
  return <map fun={fun}><xs x={children}/></map>;
}
 * ```
 *
 * See also the {@linkcode Context.createState} function for information on how to make domain-specific state accessible to the `fun` function via the context.
 *
 * ### `lifecycle`
 *
 * The `<lifecycle>` intrinsic takes as props up to two functions, each taking an as its single argument a {@linkcode Context} and returning either `void` or `Promise<void>`. The `pre` function is called *before* every evaluation attempt of the children of the `<lifecycle>` intrinsic, and the `post` function is called *after* every evaluation attempt of the children of the `<lifecycle>` intrinsic.
 *
 * ```ts
function Traced({ children }: { children: Expression }): Expression {
  return (
    <lifecycle
      pre={(ctx) => ctx.trace("before")}
      post={(ctx) => ctx.trace("after")}
    >
      <xs x={children} />
    </lifecycle>
  );
}
 * ```
 *
 * See also the {@linkcode Context.createState} function for information on how to make domain-specific state accessible to the `pre` and `post` functions via the context.
 *
 * ### `halt`
 *
 * The `<halt>` intrinsic immediately halts evaluation with an error when evaluated.
 *
 * ```ts
function DontUseThis(): Expression {
  return <halt />;
}
 * ```
 *
 * @module
 */

import {
  type LoggingBackend,
  type LoggingFormatter,
  logGt,
  logGte,
  type LogLevel,
  logLt,
  logLte,
  logMax,
  logMin,
} from "./loggingBackend.ts";
import { newStack, type Stack } from "./stack.ts";
import { DefaultLogger } from "./defaultLogger.ts";
import { LogLevelStacks } from "./logLevelStacks.ts";
import {
  type EvaluationTreePosition,
  EvaluationTreePositionImpl,
} from "./evaluationTreePosition.ts";
import { doCreateConfig, doCreateScopedState } from "./stateHelpers.tsx";

export {
  type EvaluationTreePosition,
  type LoggingBackend,
  type LoggingFormatter,
  logGt,
  logGte,
  type LogLevel,
  logLt,
  logLte,
  logMax,
  logMin,
};

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
  | EffectExpression
  | LifecycleExpression
  | MapExpression
  | MacroExpression;

/**
 * A fragment consists of an array of expressions. They are evaulated in
 * sequence and the results are concatenated.
 */
type FragmentExpression = { fragment: Expression[] };

/**
 * An effect expression maps the evaluation {@linkcode Context} to another
 * expression. The function can also return `null`, signalling that it
 * cannot be evaluated just yet. In that case, it is called again in the
 * next evaluation round.
 */
type EffectExpression = {
  effect:
    | ((ctx: Context) => Expression | null)
    | ((ctx: Context) => Promise<Expression | null>);
};

/**
 * Call functions for their side-effects before and after attempting evaluate a wrapped expression.
 */
type LifecycleExpression = {
  lifecycle: {
    exp: Expression;
    pre: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>);
    post: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>);
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
      | ((ctx: Context, evaluated: string) => Expression)
      | ((ctx: Context, evaluated: string) => Promise<Expression>);
  };
};

/**
 * Attaches metadata to the expression returned by each macro evaluation.
 */
type MacroExpression = {
  macro: Expression;
  dbg: DebuggingInformation;
};

function fragmentExp(
  exps: Expression[],
): Expression {
  return { fragment: exps };
}

function effectExp(
  fun:
    | ((ctx: Context) => Expression | null)
    | ((ctx: Context) => Promise<Expression | null>),
): Expression {
  return { effect: fun };
}

function lifecycleExp(
  exp: Expression,
  pre: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>),
  post: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>),
): Expression {
  return { lifecycle: { exp, pre, post } };
}

function mapExp(
  exp: Expression,
  fun:
    | ((ctx: Context, evaluated: string) => Expression)
    | ((ctx: Context, evaluated: string) => Promise<Expression>),
): Expression {
  return {
    map: { exp, fun },
  };
}

function macroExp(
  exp: Expression,
  dbg: DebuggingInformation,
): Expression {
  return { macro: exp, dbg };
}

function expIsFragment(
  exp: Expression,
): exp is FragmentExpression {
  return (typeof exp !== "string") && ("fragment" in exp);
}

function expIsEffect(
  exp: Expression,
): exp is EffectExpression {
  return (typeof exp !== "string") && ("effect" in exp);
}

function expIsLifecycle(
  exp: Expression,
): exp is LifecycleExpression {
  return (typeof exp !== "string") && ("lifecycle" in exp);
}

function expIsMap(
  exp: Expression,
): exp is MapExpression {
  return (typeof exp !== "string") && ("map" in exp);
}

function expIsMacro(
  exp: Expression,
): exp is MacroExpression {
  return (typeof exp !== "string") && ("macro" in exp);
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
    } else if (Object.hasOwn(x, "effect")) {
      // We might have an effect expression.
      // Check if the inner value is a function.
      return typeof x.effect === "function";
    } else if (Object.hasOwn(x, "lifecycle")) {
      // We might have a preprocess expression.
      const inner = x.lifecycle;
      if (typeof inner !== "object") {
        return false;
      } else {
        // Check if it has a `fun` function and an `exp` property.
        return Object.hasOwn(inner, "pre") && typeof inner.pre === "function" &&
          Object.hasOwn(inner, "post") && typeof inner.post === "function" &&
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
    } else if (Object.hasOwn(x, "macro")) {
      return true;
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
 * A macro, mapping arbitrary props to an expression.
 */
// deno-lint-ignore no-explicit-any
export type Macro = (props: any) => Expression;

/**
 * The debugging information that the jsx factory attaches to all non-string {@linkcode Expression}s.
 */
export interface DebuggingInformation {
  /**
   * Set to true if the expression is a macro call written by the user, set to false for builtins and for macro calls which are part of other macros.
   *
   * Expressions appear in stack traces if and only if this is true.
   */
  isPrimary?: boolean;
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
   * {@linkcode Expression}, or the name of the builtin.
   */
  name?: string;
  /**
   * The function (macro) itself that created the annotated
   * {@linkcode Expression}. Undefiend for builtins.
   */
  macroFun?: Macro;
}

/**
 * Shared state during an evaluation that can be freely used by macros.
 *
 * The intention is for macro authors to keep the symbols they use private, and
 * to export strongly typed functions for interacting with their parts of the
 * state instead. See {@linkcode createSubstate}.
 */
// deno-lint-ignore no-explicit-any
type State = Map<symbol, any>;

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
 * The entrypoint to macro evaluation.
 *
 * Encapsulates all state required for evaluating an expression.
 *
 * ```ts
import { Context } from "macromania";

// Create a new context.
const ctx = new Context();

// Use the context to evaluate an expression. Yay =)
const result = await ctx.evaluate("Hello, world!");

// Logs `"Hello, world!"`.
console.log(result, ctx.didGiveUp());
 * ```
 */
export class Context {
  // The shared mutable state.
  /** @ignore */
  private state: State;
  // Like a callstack, but for the DebuggingInformation of
  // user-invoked macros.
  /** @ignore */
  private stack: Stack<DebuggingInformation>;
  // Tracks the current position in the evaluation process.
  /** @ignore */
  private etp: EvaluationTreePositionImpl;
  // True when evaluation would halt if no effect expression returns non-null.
  /** @ignore */
  private haveToMakeProgress: boolean;
  // Count the number of evaluation rounds.
  /** @ignore */
  private round: number;
  // To determine whether `haveToMakeProgress` needs to be set after an
  // evaluation round, we track whether at least one effect expression returned
  // non-null in the current round.
  /** @ignore */
  private madeProgressThisRound: boolean;
  // Starts as `false`, switches to `true` when a warning or error is logged.
  /** @ignore */
  private warnedOrWorseYet: boolean;
  // The stack of logging levels that users can configure with the `loggingLevel` intrinsic.
  /** @ignore */
  readonly logLevelStacks: LogLevelStacks;
  /**
   * This field exposes methods for styling strings (text colour, background colour, italics, bold, underline, strikethrough) for logging in this context.
   *
   * Always use these methods (or the helper methods {@linkcode Context.prototype.fmtCode | fmtCode}, {@linkcode Context.prototype.fmtURL | fmtURL}, {@linkcode Context.prototype.fmtFilePath | fmtFilePath}, or {@linkcode Context.prototype.fmtDebuggingInformation | fmtDebuggingInformation}) for styling logging output; do *not*, for example, manually add ansii escapes. This is because different logging backends might require completely different styling approaches. An HTML-emitting logger, for example, would not do well when fed strings with ansii escapes.
   */
  // This is also always the `LoggingBackend` we use. But we don't want to expose that functionality externally, so we omit the type from the public interface and typecast when we use it as a `LoggingBackend` internally.
  readonly fmt: LoggingFormatter;

  /**
   * Create a new `Context`.
   *
   * You can optionally specify a {@linkcode LoggingBackend} and {@linkcode LoggingFormatter} to configure the logging methods and intrinsics of expressions evaluated with this context. By default, a context will log to the global console, using ansii escape sequences for formatting.
   */
  constructor(logger?: LoggingBackend & LoggingFormatter) {
    this.state = new Map();
    this.stack = newStack();
    this.etp = new EvaluationTreePositionImpl();
    this.haveToMakeProgress = false;
    this.round = 0;
    this.madeProgressThisRound = false;
    this.fmt = logger ?? new DefaultLogger();
    this.warnedOrWorseYet = false;
    this.logLevelStacks = new LogLevelStacks();
  }

  /**
   * Returns whether evaluation has been given up because no progress could
   * be made.
   *
   * ```ts
import { Context } from "macromania";
const ctx = new Context();

// The expression will never make evaluation progress.
// Evaluation will give up after two evaluation rounds.
const result = await ctx.evaluate(<effect fun={(_ctx) => null}/>);

// Logs `null, true`.
console.log(result, ctx.didGiveUp());

const ctx2 = new Context();
const result2 = await ctx2.evaluate("hi");

// Logs `"hi", false`.
console.log(result2, ctx2.didGiveUp());
 * ```
   */
  public didGiveUp(): boolean {
    return this.mustMakeProgress() && !this.madeProgressThisRound;
  }

  /**
   * Returns whether at least one warning or an error has been logged with this `Context`.
   *
   * ```ts
import { Context } from "macromania";

const ctx = new Context();
const result = await ctx.evaluate(<warn>oh no</warn>);

// Logs `true`.
console.log(ctx.didWarnOrError());

const ctx2 = new Context();
const result2 = await ctx2.evaluate(<warn>oh no</warn>);

// Logs `false`.
console.log(ctx2.didWarnOrError());
 * ```
   */
  public didWarnOrError(): boolean {
    return this.warnedOrWorseYet;
  }

  /**
   * Create a getter and a setter for a unique, statically typed state, tracked by a {@linkcode Context}.
   * @param initial A function that produces the initial state.
   * @returns A getter and a setter for the state.
   */
  static createState<S>(
    initial: () => S,
  ): [(ctx: Context) => S, (ctx: Context, newState: S) => void] {
    const key = Symbol();

    const get = (ctx: Context) => {
      const got = ctx.state.get(key);

      if (got === undefined) {
        ctx.state.set(key, initial());
        return ctx.state.get(key)!;
      } else {
        return got;
      }
    };

    const set = (ctx: Context, newState: S) => {
      ctx.state.set(key, newState);
    };

    return [get, set];
  }

  /**
   * Create a getter and a setter for a scoped state. The returned scope macro crates a new scope, and the getter and setter interact with independent states within each scope.
   * @param initial A function that produces the initial state for each scope, based on the state of the parent scope (or `undefined` if there is no parent scope).
   * @returns A scope macro, and a getter and a setter for the state.
   */
  static createScopedState<S>(
    initial: (parentState?: S) => S,
  ): [
    (props: { children?: Children }) => Expression,
    (ctx: Context) => S,
    (ctx: Context, newState: S) => void,
  ] {
    return doCreateScopedState(initial);
  }

  /**
   * Create a configuration macro, and a getter for accessing any configured state.
   *
   * The configuration state of type `C` is a record mapping strings to (typically) optional values. The `initial` function produces the default configuration, providing a value for each key.
   *
   * Users use the first return value, a macro for setting configuration values. That macro accepts an optional prop for each key of `C`. When evaluating the children of this macro, the props that were set overwrite the config values of the parent scope (the default configuration if there is no parent configuration macro).
   *
   * The second return value lets macro authors access configuration values.
   */
  // deno-lint-ignore no-explicit-any
  static createConfig<C extends Record<string, any>>(
    initial: () => Required<C>,
  ): [
    (props: C | { children?: Children }) => Expression,
    (ctx: Context) => Required<C>,
  ] {
    return doCreateConfig(initial);
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
   * @returns The current {@linkcode EvaluationTreePosition}.
   */
  public getEvaluationTreePosition(): EvaluationTreePosition {
    return this.etp;
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
   * When no effect expression makes progress in an evaluation
   * round, another round is started, in which this function returns `true`.
   * If no effect expression makes progress in that round either,
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
   * Log a message at the given {@linkcode LogLevel}.
   */
  // deno-lint-ignore no-explicit-any
  public log(level: LogLevel, ...data: any[]) {
    if (level === "warn" || level === "error") {
      this.warnedOrWorseYet = true;
    }

    const tos = this.stack.peek();
    if (
      this.logLevelStacks.shouldLog(
        level,
        tos === undefined ? undefined : tos.macroFun,
      )
    ) {
      (<LoggingBackend> <unknown> this.fmt).log(level, ...data);
    }
  }

  /**
   * Adds an empty line to the log. The logging level will not be indicated visually, but no empty line will be logged if the logging level is too low.
   */
  logEmptyLine(level: LogLevel) {
    if (level === "warn" || level === "error") {
      this.warnedOrWorseYet = true;
    }

    const tos = this.stack.peek();
    if (
      this.logLevelStacks.shouldLog(
        level,
        tos === undefined ? undefined : tos.macroFun,
      )
    ) {
      (<LoggingBackend> <unknown> this.fmt).logEmptyLine();
    }
  }

  /**
   * Log a message at {@linkcode LogLevel} `"debug"`.
   */
  // deno-lint-ignore no-explicit-any
  public debug(...data: any[]): void {
    this.log("debug", ...data);
  }

  /**
   * Log a message at {@linkcode LogLevel} `"trace"`.
   */
  // deno-lint-ignore no-explicit-any
  public trace(...data: any[]): void {
    this.log("trace", ...data);
  }

  /**
   * Log a message at {@linkcode LogLevel} `"info"`.
   */
  // deno-lint-ignore no-explicit-any
  public info(...data: any[]): void {
    this.log("info", ...data);
  }

  /**
   * Log a message at {@linkcode LogLevel} `"warn"`.
   */
  // deno-lint-ignore no-explicit-any
  public warn(...data: any[]): void {
    this.log("warn", ...data);
  }

  /**
   * Log a message at {@linkcode LogLevel} `"error"`.
   */
  // deno-lint-ignore no-explicit-any
  public error(...data: any[]): void {
    this.log("error", ...data);
  }

  /**
   * Log the current macro call at logging level `"debug"`.
   */
  currentDebug() {
    const tos = this.stack.peek();
    if (tos !== undefined) {
      this.debug(this.fmtDebuggingInformation(tos));
    }
  }

  /**
   * Log the current macro call at logging level `"trace"`.
   */
  currentTrace() {
    const tos = this.stack.peek();
    if (tos !== undefined) {
      this.trace(this.fmtDebuggingInformation(tos));
    }
  }

  /**
   * Log the current macro call at logging level `"info"`.
   */
  currentInfo() {
    const tos = this.stack.peek();
    if (tos !== undefined) {
      this.info(this.fmtDebuggingInformation(tos));
    }
  }

  /**
   * Log the current macro call at logging level `"warn"`.
   */
  currentWarn() {
    const tos = this.stack.peek();
    if (tos !== undefined) {
      this.warn(this.fmtDebuggingInformation(tos));
    }
  }

  /**
   * Log the current macro call at logging level `"error"`.
   */
  currentError() {
    const tos = this.stack.peek();
    if (tos !== undefined) {
      this.error(this.fmtDebuggingInformation(tos));
    }
  }

  /**
   * Log the current macro call at the given {@linkcode LogLevel}.
   */
  currentLog(level: LogLevel) {
    const tos = this.stack.peek();
    if (tos !== undefined) {
      this.log(level, this.fmtDebuggingInformation(tos));
    }
  }

  /**
   * Executes the given `thunk`. All logging happening inside will be visually grouped together.
   */
  loggingGroup(thunk: () => void) {
    (<LoggingBackend> <unknown> this.fmt).startGroup();
    thunk();
    (<LoggingBackend> <unknown> this.fmt).endGroup();
  }

  /**
   * Prints a stacktrace, then immediately and faultily terminates evaluation.
   *
   * @returns A dummy Expression so you can write `return ctx.halt()` in
   * effect or map functions. This function always throws, it never
   * actually returns a value.
   */
  public halt(): Expression {
    // Print a stacktrace of the user-facing macros that lead to the failure.
    this.printStack();

    // Caught in `evaluate`, never leaks.
    throw haltEvaluation;
  }

  /**
   * Styles some {@linkcode DebuggingInformation} for logging.
   */
  fmtDebuggingInformation(
    info: DebuggingInformation,
  ): string {
    const name = this.fmt.bold(this.fmt.italic(info.name ?? "anonymous"));
    const file = info.file ? ` in ${this.fmtFilePath(info.file)}` : "";
    const position = info.file && info.line
      ? this.fmt.yellow(`:${info.line}${info.column ? `:${info.column}` : ""}`)
      : "";
    return `${name}${file}${position}`;
  }

  /**
   * Styles a file path the same way that macromania styles file paths for logging.
   */
  fmtFilePath(path: string): string {
    return this.fmt.cyan(path);
  }

  /**
   * Styles a code snipped the same way that macromania styles code snippets for logging.
   */
  fmtCode(s: string): string {
    return this.fmt.yellow(s);
  }

  /**
   * Styles a URL the same way that macromania styles URLs for logging.
   */
  fmtURL(s: string): string {
    return this.fmt.blue(s);
  }

  /**
   * Logs a stacktrace.
   */
  public printStack(logLevel: LogLevel = "error") {
    let s = this.stack;
    while (!s.isEmpty()) {
      this.log(
        logLevel,
        "  at",
        this.fmtDebuggingInformation(s.peek()!),
      );
      s = s.pop();
    }
  }

  // Attempt to evaluate a single Expression, or `Children`.
  private async doEvaluate(exps: Children): Promise<Expression> {
    const exp = exps === undefined || Array.isArray(exps)
      ? fragmentExp(expressions(exps))
      : exps;

    if (!canBeEvaluatedOneStep(exp)) {
      return this.printNonExp(exp);
    }

    if (typeof exp === "string") {
      return exp;
    } else {
      // Next up: we do some debugging data management, then evaluate the expression and write the result to `ret`, then do more debugging data management, and finally return `ret`.
      let ret: Expression | Promise<Expression>;

      // Push debug info.

      if ("dbg" in exp && (<DebuggingInformation> exp.dbg).isPrimary) {
        this.stack = this.stack.push(<DebuggingInformation> exp.dbg);
      }

      if (expIsFragment(exp)) {
        // Evaluate fragments by successively evaluating their items.
        const allEvaluated: Expression[] = [];

        const oldEtp = this.etp;
        for (let i = 0; i < exp.fragment.length; i++) {
          this.etp = oldEtp.appendChild(i);
          allEvaluated.push(await this.doEvaluate(exp.fragment[i]));
          this.etp = oldEtp;
        }

        const compressed = simplifyExpressionsArray(allEvaluated);

        if (Array.isArray(compressed)) {
          ret = { fragment: compressed };
        } else {
          ret = compressed;
        }
      } else if (expIsEffect(exp)) {
        const unthunk = await exp.effect(this);
        if (unthunk === null) {
          ret = exp; // Try again next evaluation round.
        } else {
          this.madeProgressThisRound = true;
          ret = this.doEvaluate(unthunk);
        }
      } else if (expIsLifecycle(exp)) {
        await exp.lifecycle.pre(this);
        const evaluated = await this.doEvaluate(exp.lifecycle.exp);
        await exp.lifecycle.post(this);

        if (typeof evaluated === "string") {
          ret = evaluated;
        } else {
          exp.lifecycle.exp = evaluated;
          ret = exp;
        }
      } else if (expIsMap(exp)) {
        // We want to create disjoin ETPs for the evaluation of the inner expression and the evaluation of the result of mapping. Hence, we pop an index of zero before the inner evaluation, and wrap the successfully mapped result at second position of a fragment expression.

        const oldEtp = this.etp;
        this.etp = oldEtp.appendChild(0);
        const evaluated = await this.doEvaluate(exp.map.exp);
        this.etp = oldEtp;

        if (typeof evaluated === "string") {
          const mapped = await exp.map.fun(this, evaluated);
          ret = this.doEvaluate(fragmentExp(["", mapped]));
        } else {
          exp.map.exp = evaluated;
          ret = exp;
        }
      } else if (expIsMacro(exp)) {
        const oldEtp = this.etp;
        this.etp = oldEtp.appendChild(0);
        const evaled = await this.doEvaluate(exp.macro);
        this.etp = oldEtp;

        if (typeof evaled === "string") {
          ret = evaled;
        } else {
          ret = exp;
          exp.macro = evaled;
        }
      } else {
        return this.printNonExp(exp);
      }

      // Pop debug info.
      if ("dbg" in exp && (<DebuggingInformation> exp.dbg).isPrimary) {
        this.stack = this.stack.pop();
      }

      return ret;
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
    this.error(
      `Tried to evaluate a javascript value that was no macromania expression.`,
    );
    this.error(
      `Did you put ${
        this.fmtCode(`{someJavascript}`)
      } into a jsx element that evaluated to a non-expression?`,
    );
    this.error(
      `Evaluation cannot recover, but here are the value, its json representation, and a macro stacktrace for you to find and fix the mistake.`,
    );
    this.error(``);
    this.error(`The offending value, as passed to the logger directly:`);
    (<LoggingBackend> <unknown> this.fmt).startGroup();
    this.error(x);
    (<LoggingBackend> <unknown> this.fmt).endGroup();
    this.error(``);
    this.error(
      `The offending value, as mapped through ${
        this.fmtCode(`JSON.stringify(val)`)
      }:`,
    );
    (<LoggingBackend> <unknown> this.fmt).startGroup();
    this.error(JSON.stringify(x));
    (<LoggingBackend> <unknown> this.fmt).endGroup();
    this.error(``);
    this.error(`The stack of macro invocations leading to this predicament:`);
    return this.halt();
  }

  private logBlockingExpressions(exp: Expression) {
    // Prepare for logging, then call a recursive subroutine to do the actual work.
    this.error(
      `Had to abort evaluation because no unevaluated expression could made any progress.`,
    );
    this.error(`The following macro invocations did not terminate:`);
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
    } else if (expIsEffect(exp)) {
      this.error(``);
      this.error(this.fmtDebuggingInformation(info));
    } else if (expIsLifecycle(exp)) {
      this.doLogBlockingExpressions(exp.lifecycle.exp, info);
    } else if (expIsMap(exp)) {
      this.doLogBlockingExpressions(exp.map.exp, info);
    }
  }
}

function simplifyExpressionsArray(
  exps: Expression[],
): string | Expression | Expression[] {
  // Simplify the array of evaluated expressions if possible,
  // otherwise return it directly.
  if (exps.length === 0) {
    return "";
  } else if (exps.length === 1) {
    return exps[0];
  } else if (exps.every((exp) => typeof exp === "string")) {
    return exps.join("");
  } else {
    return exps;
  }
}

/**
 * Utility type for macros that accept an arbitrary number of children.
 */
export type Children = undefined | Expression | Expression[];

/**
 * Take the output of a jsx transform and turn it into an array of
 * {@linkcode Expression}s.
 * @param children Some {@linkcode Children} to convert.
 * @returns An array of {@linkcode Children} containing all children.
 */
function expressions(children: Children): Expression[] {
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
  | "xs"
  | "omnomnom"
  | "effect"
  | "map"
  | "lifecycle"
  | "halt"
  | "loggingLevel"
  | "log"
  | "debug"
  | "trace"
  | "info"
  | "warn"
  | "error"
  | "loggingGroup"
  | "sequence";

type PropsXs = {
  x: Children;
};

type PropsFragment = {
  /**
   * The array of Expressions to evaluate and concatenate.
   */
  x: Expression[];
};

type PropsEffect = {
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
  children?: Children;
  /**
   * Receive the evaluated children of the `map` intrinsic and map them (and
   * the current {@linkcode Context}) to a new {@linkcode Expression} to
   * continue evaluation with.
   * @param evaluated - The fully evaluated children of the `map` intrinsic.
   * @param ctx - The {@linkcode Context} to counsel for expression generation.
   * @returns An {@linkcode Expression} to evaluate next.
   */
  fun:
    | ((ctx: Context, evaluated: string) => Expression)
    | ((ctx: Context, evaluated: string) => Promise<Expression>);
};

type PropsLifecycle = {
  children?: Children;
  pre?: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>);
  post?: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>);
};

type PropsOmnomnom = { children?: Children };

type PropsHalt = Record<string | number | symbol, never>;

type PropsLoggingLevel = {
  /**
   * The logging level to set.
   */
  level: LogLevel;
  /**
   * Whether to set the level for any specific macro, or globally.
   */
  macro?: Macro;
  /**
   * The expressions to evaluate using the new logging level.
   */
  children: Children;
};

type PropsLog = {
  /**
   * The logging level at which to log.
   */
  level: LogLevel;
  /**
   * The expressions to evaluate to a string and to then log at the given logging level.
   */
  children?: Children;
};

type PropsDebug = {
  /**
   * The expressions to evaluate to a string and to then log at logging level `"debug"`.
   */
  children?: Children;
};

type PropsTrace = {
  /**
   * The expressions to evaluate to a string and to then log at logging level `"trace"`.
   */
  children?: Children;
};

type PropsInfo = {
  /**
   * The expressions to evaluate to a string and to then log at logging level `"info"`.
   */
  children?: Children;
};

type PropsWarn = {
  /**
   * The expressions to evaluate to a string and to then log at logging level `"warn"`.
   */
  children?: Children;
};

type PropsError = {
  /**
   * The expressions to evaluate to a string and to then log at logging level `"error"`.
   */
  children?: Children;
};

type PropsLoggingGroup = {
  /**
   * The expressions to evaluate. Any logging inside this intrinsic will be grouped together.
   */
  children?: Children;
};

type PropsSequence = {
  /**
   * The expressions to evaluated sequentially.
   */
  x: Expression[];
};

export declare namespace JSX {
  // https://devblogs.microsoft.com/typescript/announcing-typescript-5-1-beta/#decoupled-type-checking-between-jsx-elements-and-jsx-tag-types
  // https://www.typescriptlang.org/docs/handbook/jsx.html#the-jsx-result-type
  type Element = Expression;

  // Configure the intrinsic elements and their props.
  // https://www.typescriptlang.org/docs/handbook/jsx.html#intrinsic-elements
  // https://www.typescriptlang.org/docs/handbook/jsx.html#attribute-type-checking
  interface IntrinsicElements {
    /**
     * Convert the given `Children` (a single `Expression`, an array of `Expression`s, or `undefined`) into an expression.
     */
    xs: PropsXs;
    /**
     * Create an {@linkcode Expression} dependent on the current
     * {@linkcode Context}, and evaluate it.
     */
    effect: PropsEffect;
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
     * Evaluate the child expressions for their side-efects.
     * Evaluates to the empty string.
     */
    omnomnom: PropsOmnomnom;
    /**
     * Print a stacktrace and halt evaluation.
     */
    halt: PropsHalt;
    /**
     * Evaluate the children and log the resulting string at the given [`LogLevel`].
     * This intrinsic itself evaluates to the empty string.
     */
    log: PropsLog;
    /**
     * Evaluate the children and log the resulting string at logging level `"debug"`.
     * This intrinsic itself evaluates to the empty string.
     */
    debug: PropsDebug;
    /**
     * Evaluate the children and log the resulting string at logging level `"trace"`.
     * This intrinsic itself evaluates to the empty string.
     */
    trace: PropsTrace;
    /**
     * Evaluate the children and log the resulting string at logging level `"info"`.
     * This intrinsic itself evaluates to the empty string.
     */
    info: PropsInfo;
    /**
     * Evaluate the children and log the resulting string at logging level `"warn"`.
     * This intrinsic itself evaluates to the empty string.
     */
    warn: PropsWarn;
    /**
     * Evaluate the children and log the resulting string at logging level `"error"`.
     * This intrinsic itself evaluates to the empty string.
     */
    error: PropsError;
    /**
     * Evaluate the children. All logging that happens inside this intrinsic is visually grouped (typically by indentation).
     */
    loggingGroup: PropsLoggingGroup;
    /**
     * Sets the logging level for its children.
     */
    loggingLevel: PropsLoggingLevel;
    /**
     * Fully evaluates each expression before moving on to the next.
     */
    sequence: PropsSequence;
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

// Track how many macros are currently on the js callstack.
// This is not concerned with evaluation-time invocation of
// functions on expressions, but with turning user input into
// the initial expression to evaluate.
let macroDepth = 0;

function jsxSourceToDebuggingInformation(
  name: string,
  src: JsxSource,
  macroFun?: Macro,
): DebuggingInformation {
  return {
    file: src.fileName,
    line: src.lineNumber,
    column: src.columnNumber,
    name,
    macroFun,
    // If macroDepth > 0, then we are dealing with an expression that was not
    // supplied by the user, but which is an implementation detail of a macro,
    // and should hence not show up in stacktraces.
    isPrimary: !(currentlyEvaluating || macroDepth > 0),
  };
}

// jsxFactory for the ASCP, to be used with jsx-transform `react-jsxdev`
// https://www.typescriptlang.org/tsconfig#jsxFactory
// https://www.typescriptlang.org/tsconfig#jsx
// https://babeljs.io/docs/babel-plugin-transform-react-jsx-development
export function jsxDEV(
  macro: MacromaniaIntrinsic | Macro,
  // deno-lint-ignore no-explicit-any
  props: any,
  _key: undefined,
  _isStaticChildren: boolean,
  source: JsxSource | undefined,
  // deno-lint-ignore no-explicit-any
  _self: any,
): Expression {
  const dbg = source
    ? jsxSourceToDebuggingInformation(
      typeof macro === "string" ? macro : macro.name,
      source,
      typeof macro === "string" ? undefined : macro,
    )
    : {};

  if (macro === "xs") {
    if (props.x === undefined) {
      return "";
    } else if (Array.isArray(props.x)) {
      return fragmentExp(props.x);
    } else {
      return props.x;
    }
  } else if (macro === "effect") {
    return effectExp(props.fun);
  } else if (macro === "map") {
    return mapExp(fragmentExp(expressions(props.children)), props.fun);
  } else if (macro === "lifecycle") {
    return lifecycleExp(
      fragmentExp(expressions(props.children)),
      props.pre ?? ((_) => {}),
      props.post ?? ((_) => {}),
    );
  } else if (macro === "omnomnom") {
    return mapExp(fragmentExp(expressions(props.children)), () => "");
  } else if (macro === "halt") {
    return effectExp((ctx) => ctx.halt());
  } else if (macro === "loggingLevel") {
    return lifecycleExp(
      fragmentExp(expressions(props.children)),
      (ctx) => ctx.logLevelStacks.pushLevel(props.level, props.macro),
      (ctx) => ctx.logLevelStacks.popLevel(props.macro),
    );
  } else if (macro === "log") {
    return mapExp(
      fragmentExp(expressions(props.children)),
      (ctx, evaled) => {
        ctx.log(props.level, evaled);
        return "";
      },
    );
  }
  if (
    macro === "debug" || macro === "trace" || macro === "info" ||
    macro === "warn" || macro === "error"
  ) {
    return mapExp(
      fragmentExp(expressions(props.children)),
      (ctx, evaled) => {
        switch (macro) {
          case "debug":
            ctx.debug(evaled);
            break;
          case "trace":
            ctx.trace(evaled);
            break;
          case "info":
            ctx.info(evaled);
            break;
          case "warn":
            ctx.warn(evaled);
            break;
          case "error":
            ctx.error(evaled);
            break;
        }
        return "";
      },
    );
  } else if (macro === "loggingGroup") {
    return lifecycleExp(
      fragmentExp(expressions(props.children)),
      (ctx) => (<LoggingBackend> <unknown> ctx.fmt).startGroup(),
      (ctx) => (<LoggingBackend> <unknown> ctx.fmt).endGroup(),
    );
  } else if (macro === "sequence") {
    let exp: Expression = "";

    if (props.x.length === 0) {
      // Do nothing.
    } else if (props.x.length === 1) {
      exp = props.x[0];
    } else if (props.x.length >= 2) {
      const [fst, ...rest] = props.x;

      exp = mapExp(fst, (_, evaled) => fragmentExp([evaled, ...rest]));
    }

    return exp;
  } else {
    macroDepth += 1;
    const exp = macro(props);
    macroDepth -= 1;

    return macroExp(exp, dbg);
  }
}

export function Fragment(
  { children }: { children?: Expression | Expression[] },
): Expression {
  if (children === undefined) {
    return fragmentExp([]);
  } else if (Array.isArray(children)) {
    return fragmentExp(children);
  } else {
    return fragmentExp([children]);
  }
}

/*

# Documents on the Inevitable Macromania Website

Macromania is a typescript-embedded domain-specific language for creating
strings, using [jsx syntax](https://en.wikipedia.org/wiki/JSX_(JavaScript)). You
can think of it as a highly expressive but completely unopinionated templating
language. It takes inspiration from lisp-like macro expansion and
[TeX](https://en.wikipedia.org/wiki/TeX), but the design ensures meaningful
error reporting, principled interaction between stateful macros, and static
typing for the input expressions.

Demos: willowprotocol.org, gwil.garden, phd thesis

## For Users

- tutorial: using macromania
  - tsx setup
  - evaluating expressions
  - tsx (in general and for macromania in particular)
  - authoring stateless macros
  - (configuring logging?)
- tutorial: scientific writing
- guide: macromania as a static-site generator
- reference
  - selected parts of the API
  - selected builtins

## For Package Authors

- explanation: stateful macros
- tutorial: walking through writing an example package
- guide: authoring delightful packages
  - configuration, logging, documentation
- reference

## Other

- inner workings
- future of macromania

*/
