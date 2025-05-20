/*
Some additional tests that did not make sense in the tutorial.
*/

import { assertEquals } from "@std/assert";
import {
  Context,
  type DebuggingInformation,
  type Expression,
  type Expressions,
  expressions,
} from "../mod.ts";
import { newStack, type Stack } from "../stack.ts";
import { DefaultLogger } from "../defaultLogger.ts";
import { LoggingFormatter } from "../loggingBackend.ts";

function assertStack(s_: Stack<DebuggingInformation>, expected: string[]) {
  const formatter = new LoggingFormatter(new DefaultLogger());
  function report() {
    console.log(expected);
    let s__ = s_;
    while (!s__.isEmpty()) {
      console.log("at", formatter.styleDebuggingInformation(s__.peek()!));
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

Deno.test("stack simple", async () => {
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
  const _got = await ctx.evaluate(
    <A>
      <B>bla</B>
    </A>,
  );

  assertStack(stack, ["B", "A"]);
});

Deno.test("stack 2", async () => {
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
  const _got = await ctx.evaluate(
    <A>
      <B>
        <C>bla</C>
      </B>
    </A>,
  );

  assertStack(stack, ["C", "B", "A"]);
});

Deno.test("stack 3", async () => {
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
  const _got = await ctx.evaluate(
    <A>
      <B>
        <C>bla</C>
      </B>
    </A>,
  );

  assertStack(stack, ["C", "B", "A"]);
});

Deno.test("stack 4", async () => {
  function A({ children }: { children: Expressions }): Expression {
    return <fragment exps={expressions(children)} />;
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
  const _got = await ctx.evaluate(
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

Deno.test("stack 5", async () => {
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
  const _got = await ctx.evaluate(
    <A>
      hi
    </A>,
  );

  assertStack(stack, ["A"]);
});

Deno.test("stack 6", async () => {
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
  const _got = await ctx.evaluate(
    <A>
      hi
    </A>,
  );

  assertStack(stack, ["A"]);
});

Deno.test("stack 7", async () => {
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
  const _got = await ctx.evaluate(
    <A>
      hi
    </A>,
  );

  assertStack(stack, ["A"]);
});

Deno.test("stack 8", async () => {
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
  const _got = await ctx.evaluate(
    <A>
      hi
    </A>,
  );

  assertStack(stack, ["A"]);
});

Deno.test("stack 9", async () => {
  function A({ children }: { children: Expressions }): Expression {
    return (
      <map
        fun={(evaled, ctx) => {
          return <fragment exps={expressions(children)} />;
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
  const _got = await ctx.evaluate(
    <A>
      <D />
      <C>bla</C>
    </A>,
  );

  assertStack(stack, ["C", "A"]);
});

Deno.test("array combines string correctly with delayed invocations", async () => {
  function A() {
    let i = 0;
    return (
      <impure
        fun={(ctx) => {
          if (i < 3) {
            i += 1;
            return null;
          } else {
            return "";
          }
        }}
      />
    );
  }

  function B() {
    let i = 0;
    return (
      <impure
        fun={(ctx) => {
          if (i < 2) {
            i += 1;
            return null;
          } else {
            return "";
          }
        }}
      />
    );
  }

  function C() {
    let i = 0;
    return (
      <impure
        fun={(ctx) => {
          if (i < 1) {
            i += 1;
            return null;
          } else {
            return "";
          }
        }}
      />
    );
  }

  function Foo(): Expression {
    return "Foo";
  }

  const ctx = new Context();
  const got = await ctx.evaluate(
    <>
      <Foo />
      <C />
      <Foo />
      <A />
      <Foo />
      <B />
      <Foo />
      <Foo />
    </>,
  );
  assertEquals(got, `FooFooFooFooFoo`);
});

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.test("async impure", async () => {
  function Foo(): Expression {
    return (
      <impure
        fun={async (ctx) => {
          await delay(10);
          return "hi!";
        }}
      />
    );
  }

  const ctx = new Context();
  const got = await ctx.evaluate(<Foo />);
  assertEquals(got, `hi!`);
});

Deno.test("async lifecycle", async () => {
  function A() {
    let i = 0;
    return (
      <impure
        fun={(ctx) => {
          if (i < 1) {
            i += 1;
            return null;
          } else {
            return "Q";
          }
        }}
      />
    );
  }

  const ctx = new Context();
  const got = await ctx.evaluate(
    <lifecycle
      pre={async (ctx) => {
        await delay(10);
      }}
      post={async (ctx) => {
        await delay(10);
      }}
    >
      <A />
    </lifecycle>,
  );
  assertEquals(got, `Q`);
});

Deno.test("omnomnom", async () => {
  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<omnomnom></omnomnom>);
    assertEquals(got, "");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<omnomnom>oneChild</omnomnom>);
    assertEquals(got, "");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <omnomnom>oneChild{"anotherChild"}aThirdChild</omnomnom>,
    );
    assertEquals(got, "");
  })();
});

Deno.test("map", async () => {
  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<map fun={(_evaled, _ctx) => "hi"}></map>);
    assertEquals(got, "hi");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <map fun={(_evaled, _ctx) => "hi"}>oneChild</map>,
    );
    assertEquals(got, "hi");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <map fun={(_evaled, _ctx) => "hi"}>
        oneChild{"anotherChild"}aThirdChild
      </map>,
    );
    assertEquals(got, "hi");
  })();
});

Deno.test("lifecycle", async () => {
  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<lifecycle></lifecycle>);
    assertEquals(got, "");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<lifecycle>oneChild</lifecycle>);
    assertEquals(got, "oneChild");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<lifecycle>a{"b"}c</lifecycle>);
    assertEquals(got, "abc");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<lifecycle pre={(ctx) => {}}></lifecycle>);
    assertEquals(got, "");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <lifecycle pre={(ctx) => {}}>oneChild</lifecycle>,
    );
    assertEquals(got, "oneChild");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <lifecycle pre={(ctx) => {}}>a{"b"}c</lifecycle>,
    );
    assertEquals(got, "abc");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<lifecycle post={(ctx) => {}}></lifecycle>);
    assertEquals(got, "");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <lifecycle post={(ctx) => {}}>oneChild</lifecycle>,
    );
    assertEquals(got, "oneChild");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <lifecycle post={(ctx) => {}}>a{"b"}c</lifecycle>,
    );
    assertEquals(got, "abc");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <lifecycle pre={(ctx) => {}} post={(ctx) => {}}></lifecycle>,
    );
    assertEquals(got, "");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <lifecycle pre={(ctx) => {}} post={(ctx) => {}}>oneChild</lifecycle>,
    );
    assertEquals(got, "oneChild");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(
      <lifecycle pre={(ctx) => {}} post={(ctx) => {}}>a{"b"}c</lifecycle>,
    );
    assertEquals(got, "abc");
  })();
});
