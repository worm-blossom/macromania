/*
Some additional tests that did not make sense in the tutorial.
*/

import { assertEquals } from "@std/assert";
import {
  type Children,
  Context,
  type DebuggingInformation,
  type Expression,
} from "../mod.ts";
import { newStack, type Stack } from "../stack.ts";

Deno.test("mustMakeProgress regression", async () => {
  function A(): Expression {
    return (
      <effect
        fun={(_) => {
          return (
            <effect
              fun={(ctx) => {
                if (ctx.mustMakeProgress()) {
                  return "Hi!";
                } else {
                  return null;
                }
              }}
            />
          );
        }}
      />
    );
  }

  const ctx = new Context();
  const got = await ctx.evaluate(
    <A />,
  );

  assertEquals(got, "Hi!");
});

function assertStack(s_: Stack<DebuggingInformation>, expected: string[]) {
  function report() {
    console.log(expected);
    let s__ = s_;
    while (!s__.isEmpty()) {
      console.log("at", s__.peek()!);
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
      <effect
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
      <effect
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
      <effect
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
      <effect
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
      <effect
        fun={(_: Context) => {
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
  function A({ children }: { children: Children }): Expression {
    return <>{children}</>;
  }

  function B({ children }: { children: Expression }): Expression {
    return <Internal>{children}</Internal>;
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <effect
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
      <effect
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
        fun={(ctx: Context, _: string) => {
          return <C>hi</C>;
        }}
      >
        42
      </map>
    );
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <effect
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
      <effect
        fun={(ctx: Context) => {
          return <C>hi</C>;
        }}
      />
    );
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <effect
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
      <effect
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
        fun={(ctx: Context, _: string) => {
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
      <effect
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
      <effect
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
  function A({ children }: { children: Children }): Expression {
    return (
      <map
        fun={(evaled, ctx) => {
          return <>{children}</>;
        }}
      >
        42
      </map>
    );
  }

  function C({ children }: { children: Expression }): Expression {
    return (
      <effect
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
      <effect
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
      <effect
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
      <effect
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

Deno.test("async effect", async () => {
  function Foo(): Expression {
    return (
      <effect
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
      <effect
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

Deno.test("sequence", async () => {
  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<sequence x={[]} />);
    assertEquals(got, "");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<sequence x={["foo"]} />);
    assertEquals(got, "foo");
  })();

  await (async () => {
    const ctx = new Context();
    const got = await ctx.evaluate(<sequence x={["foo", "bar", "baz"]} />);
    assertEquals(got, "foobarbaz");
  })();

  await (async () => {
    const ctx = new Context();
    let first = "a";

    const got = await ctx.evaluate(
      <sequence
        x={[
          <effect
            fun={async (ctx) => {
              await delay(40);
              first = "b";
              return "b";
            }}
          />,
          <effect
            fun={async (ctx) => {
              first = "c";
              await delay(20);
              return "c";
            }}
          />,
          <effect
            fun={(ctx) => {
              first = "d";
              return "d";
            }}
          />,
        ]}
      />,
    );
    assertEquals(got, "bcd");
    assertEquals(first, "d");
  })();
});

Deno.test("createScopedState", async () => {
  await (async () => {
    const [TestStateScope, getState, setState] = Context.createScopedState<
      string
    >(() => "a");

    function GetState(): Expression {
      return <effect fun={(ctx) => getState(ctx)} />;
    }

    function SetState({ s }: { s: string }): Expression {
      return (
        <effect
          fun={(ctx) => {
            setState(ctx, s);
            return "";
          }}
        />
      );
    }

    const ctx = new Context();
    const got = await ctx.evaluate(
      <>
        <GetState />
        <SetState s="b" />
        <GetState />
        <TestStateScope>
          <GetState />
          <SetState s="c" />
          <GetState />
          <effect
            fun={(ctx) => {
              if (ctx.mustMakeProgress()) {
                return <GetState />;
              } else {
                return null;
              }
            }}
          />
        </TestStateScope>
        <GetState />
        <TestStateScope>
          <TestStateScope>
            <SetState s="d" />
            <GetState />
          </TestStateScope>
          <GetState />
        </TestStateScope>
        <GetState />
      </>,
    );
    assertEquals(got, "abaccbdab");
  })();
});

type ExampleConfig = {
  a?: number;
  b?: number;
};

Deno.test("createConfig", async () => {
  await (async () => {
    const [ConfigMacro, getConfig] = Context.createConfig<ExampleConfig>(
      () => ({ a: 0, b: 1 }),
    );

    const ctx = new Context();
    const got = await ctx.evaluate(
      <>
        <effect
          fun={(ctx) => {
            assertEquals(getConfig(ctx).a, 0);
            assertEquals(getConfig(ctx).b, 1);
            return "";
          }}
        />

        <ConfigMacro a={2}>
          <effect
            fun={(ctx) => {
              assertEquals(getConfig(ctx).a, 2);
              assertEquals(getConfig(ctx).b, 1);
              return "";
            }}
          />

          <ConfigMacro a={3} b={4}>
            <effect
              fun={(ctx) => {
                assertEquals(getConfig(ctx).a, 3);
                assertEquals(getConfig(ctx).b, 4);
                return "";
              }}
            />
          </ConfigMacro>

          <effect
            fun={(ctx) => {
              assertEquals(getConfig(ctx).a, 2);
              assertEquals(getConfig(ctx).b, 1);
              return "";
            }}
          />
        </ConfigMacro>

        <ConfigMacro b={5}>
          <effect
            fun={(ctx) => {
              assertEquals(getConfig(ctx).a, 0);
              assertEquals(getConfig(ctx).b, 5);
              return "";
            }}
          />
        </ConfigMacro>

        <effect
          fun={(ctx) => {
            assertEquals(getConfig(ctx).a, 0);
            assertEquals(getConfig(ctx).b, 1);
            return "";
          }}
        />
      </>,
    );
    assertEquals(got, "");
  })();
});

Deno.test("didGiveUp", async () => {
  const ctx = new Context();
  const result = await ctx.evaluate(<effect fun={(_ctx) => null} />);
  assertEquals(result, null);
  assertEquals(ctx.didGiveUp(), true);

  const ctx2 = new Context();
  const result2 = await ctx2.evaluate(<effect fun={(_ctx) => "hi"} />);
  assertEquals(result2, "hi");
  assertEquals(ctx2.didGiveUp(), false);
});

Deno.test("didWarnOrError", async () => {
  const ctx = new Context();
  const _result = await ctx.evaluate(<info>oh no</info>);
  assertEquals(ctx.didWarnOrError(), false);

  const ctx2 = new Context();
  const _result2 = await ctx2.evaluate(<warn>oh no</warn>);
  assertEquals(ctx2.didWarnOrError(), true);

  const ctx3 = new Context();
  const _result3 = await ctx3.evaluate(<error>oh no</error>);
  assertEquals(ctx3.didWarnOrError(), true);
});
