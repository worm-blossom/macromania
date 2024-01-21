///////////////////////////////////////////
// Arbitrary String Construction Project //
///////////////////////////////////////////

// This file implements the macro expander of the Arbitrary String Construction Project,
// we try our hands at literate programming.

import * as Colors from "https://deno.land/std@0.204.0/fmt/colors.ts";

import { Stack, new_stack } from "./stack.ts";

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
  src?: SourceLocation;

  constructor(
    fun: (ctx: Context) => WipExpansion | null,
    src?: SourceLocation,
  ) {
    this.fun = fun;
    this.src = src;
  }
}

export class WipExpansion {
  // The expression to evaluate.
  exp: Expression;
  // Called before (resuming) evaluation of the expression.
  pre_evaluate: ((ctx: Context) => void);
  // Called after (suspending) evaluation of the expression.
  post_evaluate: ((ctx: Context) => void);
  // Transforms the evaluation result into an arbitrary expression with which to resume
  // evaluation (as a completely independent expression that has nothing to do with this
  // WipExpansion anymore).
  //
  // The final call to `bottom_up` happens *before* the call to `finalize`.
  finalize: ((expanded: string, ctx: Context) => Expression);

  // A SourceLocation, tracked purely for error reporting and stack traces. Has no impact
  // on the evaluation semantics.
  src?: SourceLocation;

  constructor(
      exp: Expression,
      finalize?: ((expanded: string, ctx: Context) => Expression),
      pre_evaluate?: ((ctx: Context) => void),
      post_evaluate?: ((ctx: Context) => void),
      src?: SourceLocation,
  ) {
      this.exp = exp;
      this.finalize = finalize ?? ((exp, _ctx) => exp);
      this.pre_evaluate = pre_evaluate ?? (_ => {});
      this.post_evaluate = post_evaluate ?? (_ => {});
      this.src = src;
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
// access. Because typescript has remarkably inflexible visibility qualifiers,
// the entrypoint to evaluation is a method of this class. 
export class Context {
  // The shared mutable state.
  private state: State;

  // A callstack of user-created Invocations.
  private stack: Stack<SourceLocation>;

  // Invocations can indicate that they cannot make progress yet, in which case
  // evaluation tries to make progress elsewhere. There might however come a point
  // where none of the remaining invocations can progress. In this case, the
  // evaluator sets this flag on the Context to true, and tries to run each invocation
  // one more time. If still none of the invocations returns a WipExpansion then evaluation
  // terminates unsuccessfully.
  private have_to_make_progress: boolean;

  // Evaluation tries to evaluate all expressions successively. When it has processed
  // the final expression, this counter gets incremented, and the evaluation process
  // then starts to evaluate all expressions from the start again. 
  private round: number;

  // To determine whether `have_to_make_progress` needs to be set after an evaluation
  // round, we track whether at least one Invocation has made progress in the current
  // round.
  private made_progress_this_round: boolean;

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
    this.have_to_make_progress = false;
    this.round = 0;
    this.made_progress_this_round = false;
    this.console = console_ ? console_ : console /*the global typescript one*/;
  }

  public get_state(): State {
    return this.state;
  }

  public get_stack(): Stack<SourceLocation> {
    return this.stack;
  }

  public must_make_progress(): boolean {
    return this.have_to_make_progress;
  }

  public get_round(): number {
    return this.round;
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

  // Time to implement Expression evaluation. Given an Expression, either successfully
  // evaluates it into a string, or returns `null` to indicate a failure (either because
  // of a call to `halt`, or because expansion did not progress two attempts in a row).
  public evaluate(expression: Expression): string | null {
    // To exclude macro-generated macro invocations from user-facing debugging logging,
    // we set the currently_debugging flag. 
    currently_evaluating = true;

    // We catch any thrown `halt_evaluation` values (the only way this happens is
    // through calling `halt`).
    try {

      // Evaluation proceeds in a loop. Try to evaluate the toplevel expression. If it
      // was completely turned into a string, return that string. Otherwise, take the
      // resulting non-string expression and try evaluating it again.
      let exp = expression;
      while (typeof exp != "string") {       

        // Do an evaluation round. We will see shortly what that looks like.
        exp = this.do_evaluate(exp);

        // If evaluation made no progress at all, we set a macro-readable flag so that
        // the macros try their best to make progress. If that flag had been set already,
        // then clearly the macros are not going to cooporate, so we stop the evaluation.
        if (this.made_progress_this_round) {
          if (this.have_to_make_progress) {
            // Log the macros that should have made progress but did not, causing
            // evaluation to give up.
            this.log_active_leaves(exp);
            return null;
          } else {
            this.have_to_make_progress = true;
          }
        }

        // The evaluation round has completed, increase the round counter and reset the
        // `made_progress_this_round` flag.
        this.round += 1;
        this.made_progress_this_round = false;

        // And then back to the top of the loop, attempting to evaluate again.
      }

      // End of the evaluation loop. We managed to covert the initial Expression
      // into a string, so we proudly return it (but not after updating the global
      // flag to indicate we are not evaluating anymore).
      currently_evaluating = false;

      return exp;
 
    } catch (err) {
      // Evaluation has defnitely ended, regardless of which value was thrown.
      currently_evaluating = false;

      // If the thrown value was `halt_evaluation`, we return `null` to cleanly indicate
      // evaluaton failure. All other exceptions are indeed exceptional and are simply
      // rethrown.
      if (err === halt_evaluation) {
        return null;
      } else {
        throw err;
      }
    }
  }

  // Now for the actual meat of the evaluator: doing an evaluation round, that is,
  // progressing evaluation of an Expression as much as possible.
  private do_evaluate(exp: Expression): Expression {
    // Evaluation works differently based on the kind of Expression.
    if (typeof exp === "string") {
      // Strings evaluate to themselves
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
            evaluated[evaluated.length - 1] = (<string>evaluated[evaluated.length - 1]).concat(inner_evaluated);
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
    } else if (exp instanceof Invocation) {
      // Evaluate an Invocation by calling the invocation function.
      // Before calling it, we update the stack trace, if the Invocation was
      // user-created.
      if (exp.src) {
        this.stack = this.stack.push(exp.src);
      }
      const invoked = exp.fun(this);

      // Done invoking, so pop the Invocation from the stacktrace again.
      if (exp.src) {
        this.stack = this.stack.pop(exp.src);
      }

      if (invoked instanceof WipExpansion) {
        // If the invocation was successful, we made progress.
        this.made_progress_this_round = true;
        // We then continue by trying to evaluate the fresh WipExpansion, after
        // setting its SourceLocation to that of its spawning Invocation.
        invoked.src = exp.src;
        return this.do_evaluate(invoked);
      } else {
        // Otherwise we have to retry evaluating the same Invocation again next round.
        return exp;
      }
    } else if (exp instanceof WipExpansion) {
      // To evaluate a WipExpression, we
      //    - update the call stack, then
      //    - call its pre_evaluate lifecycle function, then
      //    - evaluate its `exp`, then
      //    - call its post_evaluate lifecycle function, and finally
      //    - map the evaluation result through `finalize` if it was a string.

      if (exp.src) {
        this.stack = this.stack.push(exp.src);
      }

      exp.pre_evaluate(this);
      const evaluated = this.do_evaluate(exp.exp);
      exp.post_evaluate(this);

      // We are now done with the WipExpansion for this round, whether successful or not.
      if (exp.src) {
          this.stack = this.stack.pop(exp.src);
        }

      if (typeof evaluated === "string") {
        // The WipExpansion is fully done, so we finalize. If the result is an Invocation
        // or another WipExpansion, it takes on the SourceLocation of the original.
        const finalized = exp.finalize(evaluated, this);
        if (finalized instanceof Invocation || finalized instanceof WipExpansion) {
          finalized.src = exp.src;
        }

        // Evaluation continues by substituting the result of `finalize` for the
        // WipExpression.
        return this.do_evaluate(finalized);
      } else {
        // Did not finish the WipEvaluation, try again next round.
        return exp;
      }
    } else {
      // If typescript had a moderately sensible type system, this case would be unreachable.
      throw new Error(`Tried to evaluate a value that is not an Expression.
Someone somewhere did type-system shenanigans that went wrong.

${exp}`);
    }
  }

  // When evaluation halts because no macro makes any progress, we log the offending
  // macros. More precisely, we log all Invocations and the WipExpansions whose
  // expression is a string (all other WipExpansions are blocked from making progress
  // by subexpressions).
  log_active_leaves(exp: Expression) {
    // Prepare for logging, then call a recursive subroutine to do the actual work.
    this.console.group("Evaluation was blocked by:");
    this.log_active_leaves_(exp);
    this.console.groupEnd();
  }

  log_active_leaves_(exp: Expression) {
    if (typeof exp === "string") {
      // Do nothing with strings, strings do not block evaluation.
    } else if (Array.isArray(exp)) {
      // Log the leaves of all subexpressions.
      exp.forEach(child => this.log_active_leaves_(child));
    } else if (exp instanceof Invocation) {
      // Any unresolved invocations have blocked expansion.
      this.console.log(format_location(exp.src));
    } else if (exp instanceof WipExpansion) {
      if (typeof exp.exp === "string") {
        this.console.log(format_location(exp.src));
      } else {
        this.log_active_leaves_(exp.exp);
      }
    }
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

export interface SourceLocation {
  file_name: string,
  line_number: number,
  column_number: number,
  macro_name: string,
}

// Prett formatting for SourceLocations
export function format_location(src: SourceLocation): string {
  return `${Colors.bold(Colors.italic(src.macro_name))} in ${style_file(src.file_name)}${Colors.yellow(`:${src.line_number}:${src.column_number}`)}`;
}

export function style_file(s: string): string {
  return Colors.cyan(s);
}