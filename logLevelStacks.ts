import { logGte, type LogLevel } from "./loggingBackend.ts";
import { newStack, type Stack } from "./stack.ts";
import type { Expression } from "macromaniajsx/jsx-dev-runtime";

/**
 * We maintain a stack of log levels for each macro, and a global log level.
 *
 * Before evaluating the contents of a `<loggingLevel>` builtin, its indicated level is pushed on the correct stack (via `pushLevel`). After evaluating the contents, we pop from the corresponding stack (via `popLevel`).
 *
 * When logging, we first check whether we are currently logging from a macro for which there is a per-macro logging level, if so, that determines the threshold of whether to perform logging or not. If there is no per-macro level, then the top of the detaulfLevel stack is used. If the defaultLevel stack is empty, the loging level is "info". (`shouldLog`)
 */
export class LogLevelStacks {
  defaultLevel: Stack<LogLevel>;
  // deno-lint-ignore no-explicit-any
  perMacroLevels: Map<(props: any) => Expression, Stack<LogLevel>>;

  constructor() {
    this.defaultLevel = newStack();
    this.perMacroLevels = new Map();
  }

  // deno-lint-ignore no-explicit-any
  pushLevel(level: LogLevel, macro?: (props: any) => Expression) {
    if (macro === undefined) {
      this.defaultLevel = this.defaultLevel.push(level);
    } else {
      const oldPerMacroStack = this.perMacroLevels.get(macro);

      if (oldPerMacroStack === undefined) {
        this.perMacroLevels.set(macro, newStack<LogLevel>().push(level));
      } else {
        this.perMacroLevels.set(macro, oldPerMacroStack.push(level));
      }
    }
  }

  // deno-lint-ignore no-explicit-any
  popLevel(macro?: (props: any) => Expression) {
    if (macro === undefined) {
      this.defaultLevel = this.defaultLevel.pop();
    } else {
      const oldPerMacroStack = this.perMacroLevels.get(macro)!;
      const newPerMacroStack = oldPerMacroStack.pop();

      if (newPerMacroStack.isEmpty()) {
        this.perMacroLevels.delete(macro);
      } else {
        this.perMacroLevels.set(macro, newPerMacroStack);
      }
    }
  }

  // deno-lint-ignore no-explicit-any
  shouldLog(level: LogLevel, macro?: (props: any) => Expression): boolean {
    if (macro === undefined) {
      const tos = this.defaultLevel.peek();

      if (tos === undefined) {
        return logGte(level, "info");
      } else {
        return logGte(level, tos);
      }
    } else {
      const perMacroStack = this.perMacroLevels.get(macro);

      if (perMacroStack === undefined) {
        return this.shouldLog(level, undefined);
      } else {
        const tos = perMacroStack.peek()!;
        return logGte(level, tos);
      }
    }
  }
}
