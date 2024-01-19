////////////////////////////////////////////
// Arbitrary String Construction Projects //
////////////////////////////////////////////

// This file implements the macro expander of the Arbitrary String Construction Project,
// we try our hands at literate programming.

// As a macro expander, the ASCP produces text by taking an `Expression` and evaluating it
// into a new expression, evaluating that expression again, and so on until the resulting
// expression is a single string. This string then is the final result.

// An expression can be one of several kinds of values.
export type Expression =
  // The most basic expressions are strings. Strings do not require further evaluation,
  // evaluating a string simply yields the striing itself.
  | string

  // An array of Expressions is again an expression. The expander evaluates an array by
  // sequentially evaluating its elements into strings, and then concatenating these
  // strings to obtain the final result.
  | Expression[]

  // Invocations are the expressions where the real work in string constrction happens,
  // they are user-supplied functions that can produce arbitrary expressions. Users do
  // not create Invocation objects directly, instead they are returned from user-facing
  // macro. A macro is an arbitrary fuction that produces an Expression. The typical
  // macro produces an Invocation.
  //
  // Unlike your friendly neighborhood lisp macro expander, the ASCP allows macros to
  // signal that they cannot be successfully evaluated just yet. The evaluator then
  // saves the expression for a later evaluation attempt, and moves on.
  //
  // This is pretty much how async typescript functions work as well. An async function
  // suspends its exection when it cannot make progress, and the runtime resumes its
  // execution at a later point. Unfortunately, the ASCP needs more control over this
  // async-like macro evaluation process than native async functions can provide, so we
  // cannot use native async functions directly. We use functions that return `null`
  // to signal that evaluation should be stopped and reattempted later.
  //
  // As input, each Invocation function takes a `State` argument. This state (the precise
  // data type definition follows later) is threaded through the evaluation process and
  // enables macros to exchange information. An Invocation function might inspect the state
  // and determine that it cannot be successfully evaluated yet, so it returns `null`.
  // Another Invocation function might later modify the state, so when the first function
  // gets reevaluated, it might then be able to make progress.
  //
  // Invocations produce not Expressions directly, but `WipEvaluation` objects, which we
  // describe next.
  | Invocation

  // A WipExpansion is the result of a successful Invocation. It consists of an expression
  // to evaluate; its evaluation result becomes the evaluation result of the Invocation
  // that created the WipExpansion.
  //
  // The expression to evaluate is augmented with some lifecycle functions. Two
  // state-manipulating functions get called before and after trying to evaluate the
  // expression respectively. This allows an Invocation to do perform and undo state
  // changes that should only affect the contents of the invocation but no other part
  // of macro evaluation.
  //
  // The final lifecycle function maps the evaluation result of the expression to an
  // arbitrary new expression. Unlike an invocation, this finalizer operates
  // not on an expression but on a string. This can be used to embed external
  // string-manipulation functions, for example, a markdown parser and renderer.
  | WipExpansion;

export class Invocation {
  // The invocation function that pseudo-asynchronously produces a WipExpression.
  fun: (ctx: Context) => WipExpansion | null;

  // A SourcecodeLocation represents a file, line, and character in source code.
  // The `src` does not affect the semantics of the macro evaluator, it is merely tracked
  // to provide helpful warnings, error messages, or stack traces.
  //
  // The source location is the location in the user code where the Invocation was created.
  // If the Invocation was created by another Invocation, then no SourceLocation is tracked.
  // Hence, the Invocation does not appear in userfacing stack traces (if it did, that
  // would leak implementation details of macros).
  src: SourceLocation?;

  constructor(
    fun: (ctx: Context) => WipExpansion | null,
    src: SourceLocation?,
  ) {
    this.fun = fun;
    this.src = src;
  }
}

export class WipExpansion {
  // The expression to evaluate.
  exp: Expression;
  // Called before (resuming) evaluation of the expression.
  top_down: ((ctx: Context) => void);
  // Called after (suspending) evaluation of the expression.
  bottom_up: ((ctx: Context) => void);
  // Transforms the evaluation result into an arbitrary expression with which to resume
  // evaluation (as a completely independent expression that has nothing to do with this
  // WipExpansion anymore).
  //
  // The final call to `bottom_up` happens *before* the call to `finalize`.
  finalize: ((expanded: string, ctx: Context) => Expression);

  // A SourceLocation, tracked purely for error reporting and stack traces. Has no impact
  // on the evaluation semantics.
  src: SourceLocation?;

  constructor(
      exp: Expression,
      finalize: ((expanded: string, ctx: Context) => Expression),
      top_down: ((ctx: Context) => void),
      bottom_up: ((ctx: Context) => void),
      src: SourceLocation?,
  ) {
      this.exp = exp;
      this.finalize = finalize;
      this.top_down = top_down;
      this.bottom_up = bottom_up;
      this.src = src;
  }
}

// Invocation functions and the lifecycle functions of WipEvaluations each receive
// a `Context` argument to access shared space between all macros, as well as some
// metadata regarding the evaluation process.

// The shared macro `State` is simply a map from symbols to arbitrary values. The
// intention is for modules to keep the symbol they use to access their cross-macro
// state private, and to instead provide properly typed functions for accessing and/or
// manipulating their portion of the state.
// deno-lint-ignore no-explicit-any
export type State = Map<symbol, any>;

// Throwing the following symbol immediately terminates evaluation. This value is
// not exposed, but it can be thrown via a method of the Context class, which we
// define next.
const halt_evaluation = Symbol("Halt Evaluation");

// We now define the full metadata that invocation and lifecycle functions get to
// access.
export class Context {
  // The shared mutable state.
  public state: State;
  // A callstack of user-created Invocations.
  public stack: Stack<SourceLocation>;
  // Invocations can indicate that they cannot make progress yet, in which case
  // evaluation tries to make progress elsewhere. There might however come a point
  // where none of the remaining invocations can progress. In this case, the
  // evaluator sets this flag on the Context to true, and tries to run each invocation
  // one more time. If still none of the invocations returns a WipExpansion then evaluation
  // terminates unsuccessfully.
  public must_make_progress: boolean;
  // Evaluation tries to evaluate all expressions successively. When it has processed
  // the final expression, this counter gets incremented, and the evaluation process
  // then starts to evaluate all expressions from the start again. 
  public round: number;
  // The Context provides several methods for logging. This field provides the
  // backend for the logging methods. Typically, this is the global console object,
  // but when the ASCP is embedded into another program or library, it might be wise
  // to log elsewhere.
  private console: Console;

  // The constructor takes a Console (defaulting to the global console), all other
  // fields have a predetermined initial state.
  constructor(console_?: Console) {
    this.state = new Map();
    this.stack = new_stack();
    this.must_make_progress = false;
    this.round = -1;
    this.console = console_ ? console_ : console /*the global typescript one*/;
  }

  // Functions with access to the Context can log warnings and errors (optionally
  // tagged with the SourceLocation of the responsible invocation).

  // deno-lint-ignore no-explicit-any
  public warn(...data: any[]): void {
    this.console.warn(Colors.yellow("[warn]"), ...data);
  }

  // deno-lint-ignore no-explicit-any
  public warn_at(...data: any[]): void {
    this.console.warn(
      Colors.yellow("[warn]"),
      ...data,
      "at",
      format_location(this.stack.peek()!)
    );
  }

  // deno-lint-ignore no-explicit-any
  public error(...data: any[]): void {
    this.console.error(Colors.red("[err]"), ...data);
  }

  // deno-lint-ignore no-explicit-any
  public error_at(...data: any[]): void {
    this.console.warn(
      Colors.red("[err]"),
      ...data,
      "at",
      format_location(this.stack.peek()!)
    );
  }

  // Functions with access to the Context can also terminate expansion faultily.
  public halt(): void {
    // Print a stacktrace of the user-facing macros that lead to the failure.
    this.console.group("");
    let stack = this.stack;
    while (!stack.is_empty()) {
      this.console.log("at", format_location(stack.peek()!));
      stack = stack.pop();
    }
    this.console.groupEnd();

    // Short-circuit evaluation. This is caught in th entrypoint to the evaluation
    // process. The whole throwing-a-symbol business cannot be observed by macros
    // or from outside the evaluation function.
    throw halt_evaluation;
  }
}

// We wish to keep a stacktrace of only those macro calls issued by a user, but not
// issued from other macros. Or put more precisely, we wish to track only macros
// that were called while evaluation was not yet in progress.
// Hence, we keep a simle, global flag to track whether the `evaluate` function is
// currently running.
// Note that this means that nested evaluations (i.e., macros that internally call
// `evaluate` again) do not get proper error reporting. Since nested evaulations are
// probably a bad idea, that seems acceptable.
let currently_evaluating = false;

export function evaluate(expression: Expression, console_?: Console): string | Context {
  currently_evaluating = true;  
  const ctx = new Context(new Map(), console_);
  let exp = expression;

  while (!ctx.did_halt()) {
    ctx.round += 1;
    const [evaluated, made_progress] = do_evaluate(exp, ctx, []);
    if (typeof evaluated === "string") {
      currently_evaluating = false;
      return evaluated;
    } else if (!made_progress) {
      if (ctx.must_make_progress) {
        currently_evaluating = false;
        ctx.error("Macro expansion did not terminate.");
        // TODO log the leaf macros
        return ctx;
      } else {
        // Continue evaluating but set the must_make_progress flag.
        ctx.must_make_progress = true;
        exp = evaluated;
      }      
    } else {
      // Continue evaluating and reset the must_make_progress flag.
      exp = evaluated;
      ctx.must_make_progress = false;
    }
  }

  return ctx;
}

export function do_evaluate(
  expression: Expression,
  ctx: Context,
  args: Expression[],
): [Expression, boolean] {
  if (ctx.did_halt()) {
    return [expression, false];
  }

  if (typeof expression === "string") {
    return [expression, false];
  } else if (expression instanceof Argument) {
    return do_evaluate(expression.exp, ctx, args);
  } else if (Array.isArray(expression)) {
    let made_progress = false;
    let only_strings = true;
    const all_evaluated: Expression = [];

    expression.forEach((exp) => {
      const [evaluated, did_make_progress] = do_evaluate(exp, ctx, args);
      made_progress = made_progress || did_make_progress;
      only_strings = only_strings && (typeof evaluated === "string");
      all_evaluated.push(evaluated);
    });

    if (only_strings) {
      return [all_evaluated.join(""), made_progress];
    } else {
      return [all_evaluated, made_progress];
    }
  } else if (expression instanceof Invocation) {
    const { macro, args } = expression;

    if (macro.location) {
      ctx.stack = ctx.stack.push(macro.location!);
    }

    const args_to_expand = args.map((_, i) => new Argument(args[i]));
    const expanded = macro.expand(args_to_expand, ctx);
    if (ctx.did_halt()) {
      return [expression, false];
    }

    if (macro.location) {
      ctx.stack = ctx.stack.pop();
    }

    if (expanded === null) {
      return [expression, false];
    } else {
      const [expanded_expanded, _] = do_evaluate(new ExpandedMacro(macro, expanded), ctx, args);
      return [expanded_expanded, true];
    }
  } else if (expression instanceof ExpandedMacro) {
    const macro = expression.macro;
    const expanded = expression.expanded;

    if (macro.location) {
      ctx.stack = ctx.stack.push(macro.location!);
    }
    
    macro.top_down(ctx);
    if (ctx.did_halt()) {
      return [expression, false];
    }

    const [expanded_expanded, made_progress] = do_evaluate(expanded, ctx, args);
    if (ctx.did_halt()) {
      return [expression, false];
    }
    
    if (typeof expanded_expanded === "string") {
      const finalized = macro.finalize(expanded_expanded, ctx);
      if (ctx.did_halt()) {
        return [expression, false];
      }

      macro.bottom_up(ctx);
      if (ctx.did_halt()) {
        return [expression, false];
      }

      if (macro.location) {
        ctx.stack = ctx.stack.pop();
      }

      if (finalized === null) {
        return [expanded_expanded, false];
      } else {
        return [finalized, true];
      }
    } else {
      macro.bottom_up(ctx);
      if (ctx.did_halt()) {
        return [expression, false];
      }
      
      if (macro.location) {
        ctx.stack = ctx.stack.pop();
      }
      return [new ExpandedMacro(macro, expanded_expanded), made_progress];
    }
  } else {
    console.error(expression);
    throw new Error("unreachable, or so they thought...");
  }
}

export function new_macro(
  expand: (args: Argument[], ctx: Context) => (Expression | null) = default_expand,
  finalize: (expanded: string, ctx: Context) => (string | null) = default_finalize,
  td: (ctx: Context) => void = default_td,
  bu: (ctx: Context) => void = default_bu,
  offset = 1,
): Macro {
  if (!currently_evaluating) {
    const macro_def = getCurrentLine({frames: 1 + offset});
    const callsite = getCurrentLine({frames: 2 + offset});
    callsite.method = macro_def.method;
    return new Macro(expand, td, bu, finalize, callsite);
  } else {
    return new Macro(expand, td, bu, finalize, undefined);
  }  
}

export function default_expand(args: Argument[], _ctx: Context): Expression {
  return args;
}

export function default_td(_ctx: Context) {
  return;
}

export function default_bu(_ctx: Context) {
  return;
}

export function default_finalize(expanded: string, _ctx: Context): string {
  return expanded;
}

// Considers every array as an expression
// deno-lint-ignore no-explicit-any
export function is_expression(x: any): boolean {
  if (typeof x === "function") {
    return true;
  } else if (x === -1) {
    return true;
  } else if (typeof x === "string") {
    return true;
  } else if (Array.isArray(x)) {
    return true;
  } else if (x instanceof Invocation || x instanceof ExpandedMacro || x instanceof Argument) {
    return true;
  } else {
    return false;
  }
}

export function surpress_output(
  ...exps: Expression[]
): Expression {
  const macro = new_macro(
    undefined,
    (_, _ctx) => "",
    );
  
  return new Invocation(macro, exps);
}

// Prett formatting for SourceLocations
export function format_location(location: Location): string {
  return `${Colors.bold(Colors.italic(location.method))} in ${style_file(location.file)}${Colors.yellow(`:${location.line}:${location.char}`)}`;
}

export function style_file(s: string): string {
  return Colors.cyan(s);
}