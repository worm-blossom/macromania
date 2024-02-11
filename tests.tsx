/*
Some additional tests that did not make sense in the tutorial.
*/

import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import {
  Context,
  DebuggingInformation,
  Expression,
  styleDebuggingInformation,
} from "./mod.ts";
import { newStack, Stack } from "./stack.ts";

function assertStack(s_: Stack<DebuggingInformation>, expected: string[]) {
  function report() {
    console.log(expected);
    let s__ = s_;
    while (!s__.isEmpty()) {
      console.log("at", styleDebuggingInformation(s__.peek()!));
      s__ = s__.pop();
    }
  }

  let s = s_;
  for (let i = 0; i < expected.length; i++) {
    if (s.isEmpty()) {
      report();
      assertEquals("different", "lengths");
    } else {
      if (s.peek()?.name !== expected[i]) {
        report();
        assertEquals("different", "names");
      } else {
        s = s.pop();
      }
    }
  }
}

Deno.test("stack simple", () => {
  function A({ children }: { children: Expression }): Expression {
    return children;
  }

  function B({ children }: { children: Expression }): Expression {
    return <Internal>{children}</Internal>;
  }

  let stack: Stack<DebuggingInformation> = newStack();

  function Internal({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          stack = ctx.getDebuggingStack();
          return children;
        }}
      />
    );
  }

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      <B>bla</B>
    </A>,
  );

  assertStack(stack, ["B", "A"]);
});

Deno.test("stack 2", () => {
  function A({ children }: { children: Expression }): Expression {
    return children;
  }

  function B({ children }: { children: Expression }): Expression {
    return <Internal>{children}</Internal>;
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          stack = ctx.getDebuggingStack();
          return <Internal>{children}</Internal>;
        }}
      />
    );
  }

  let stack: Stack<DebuggingInformation> = newStack();

  function Internal({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          return children;
        }}
      />
    );
  }

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      <B>
        <C>bla</C>
      </B>
    </A>,
  );

  assertStack(stack, ["C", "B", "A"]);
});

Deno.test("stack 3", () => {
  function A({ children }: { children: Expression }): Expression {
    return children;
  }

  function B({ children }: { children: Expression }): Expression {
    return <Internal>{children}</Internal>;
  }

  let i = 0;

  function C({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          if (i < 2) {
            i += 1;
            return null;
          }
          stack = ctx.getDebuggingStack();
          return <Internal>{children}</Internal>;
        }}
      />
    );
  }

  let stack: Stack<DebuggingInformation> = newStack();

  function Internal({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          return children;
        }}
      />
    );
  }

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      <B>
        <C>bla</C>
      </B>
    </A>,
  );

  assertStack(stack, ["C", "B", "A"]);
});

Deno.test("stack 4", () => {
  function A({ children }: { children: Expression }): Expression {
    return children;
  }

  function B({ children }: { children: Expression }): Expression {
    return <Internal>{children}</Internal>;
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          stack = ctx.getDebuggingStack();
          return <Internal>{children}</Internal>;
        }}
      />
    );
  }

  let stack: Stack<DebuggingInformation> = newStack();

  function Internal({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          return children;
        }}
      />
    );
  }

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      <B>
        <A>hi</A>
      </B>
      <B>
        <C>bla</C>
      </B>
    </A>,
  );

  assertStack(stack, ["C", "B", "A"]);
});

Deno.test("stack 5", () => {
  function A({ children }: { children: Expression }): Expression {
    return (
      <map
        fun={(_: string, ctx: Context) => {
          return <C>hi</C>;
        }}
      >
        42
      </map>
    );
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          stack = ctx.getDebuggingStack();
          return children;
        }}
      />
    );
  }

  let stack: Stack<DebuggingInformation> = newStack();

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      hi
    </A>,
  );

  assertStack(stack, ["A"]);
});

Deno.test("stack 6", () => {
  function A({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          return <C>hi</C>;
        }}
      />
    );
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          stack = ctx.getDebuggingStack();
          return children;
        }}
      />
    );
  }

  let stack: Stack<DebuggingInformation> = newStack();

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      hi
    </A>,
  );

  assertStack(stack, ["A"]);
});

Deno.test("stack 7", () => {
  function A({ children }: { children: Expression }): Expression {
    return <C>bla</C>;
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          stack = ctx.getDebuggingStack();
          return children;
        }}
      />
    );
  }

  let stack: Stack<DebuggingInformation> = newStack();

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      hi
    </A>,
  );

  assertStack(stack, ["A"]);
});

Deno.test("stack 8", () => {
  function A({ children }: { children: Expression }): Expression {
    return (
      <map
        fun={(_: string, ctx: Context) => {
          return <C>hi</C>;
        }}
      >
        <B>{children}</B>
      </map>
    );
  }

  function B({ children }: { children: Expression }): Expression {
    return <Internal>{children}</Internal>;
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          stack = ctx.getDebuggingStack();
          return <Internal>{children}</Internal>;
        }}
      />
    );
  }

  let stack: Stack<DebuggingInformation> = newStack();

  function Internal({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          return children;
        }}
      />
    );
  }

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      hi
    </A>,
  );

  assertStack(stack, ["A"]);
});

Deno.test("stack 9", () => {
  function A({ children }: { children: Expression }): Expression {
    return (
      <map
        fun={(evaled, ctx) => {
          //
          ctx.warn(children);
          // ctx.printStack();
          return children;
        }}
      >
        42
      </map>
    );
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <impure
        fun={(ctx: Context) => {
          stack = ctx.getDebuggingStack();
          return children;
        }}
      />
    );
  }

  // deno-lint-ignore ban-types
  function D(props: {}): Expression {
    return "ddd";
  }

  let stack: Stack<DebuggingInformation> = newStack();

  const ctx = new Context();
  const _got = ctx.evaluate(
    <A>
      <D />
      <C>bla</C>
    </A>,
  );

  assertStack(stack, ["C", "A"]);
});
