/***
 *      _____            _                        _               _
 *     |_   _|  _  _    | |_     ___      _ _    (_)    __ _     | |
 *       | |   | +| |   |  _|   / _ \    | '_|   | |   / _` |    | |
 *      _|_|_   \_,_|   _\__|   \___/   _|_|_   _|_|_  \__,_|   _|_|_
 *    _|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|
 *    "`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'
 */

/*
Welcome to the macromania tutorial. This file walks you through all the
features of macromania. It also happens to double as a test suite.
*/
import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";

///////////////////
// 1. The Basics //
///////////////////

/*
Macromania defines a type `Expression`. You give macromania an `Expression`, and
it expands the expression into a string.
*/
import { Context, Expression } from "../main.ts";

/*
The most basic expression is a string, which evaluates to itself:
*/
Deno.test("string expression", () => {
  const ctx = new Context();
  const got = ctx.evaluate("Hello, world!");
  assertEquals(got, "Hello, world!");
});

/*
This snippet has demonstrated the fundamental working of macromania. You create
a new `Context`, pass an `Expression` (in this case, a string) to its
`evaluate` function, and get the expanded expression back.

That's it, that's basically all there is to know. All that remains is learning
about the different kinds of expressions there are.
*/

/*
An array of expression is itself an expression, evaluated by evaluating its
components and concatenating the results:
*/
Deno.test("array expression", () => {
  const ctx = new Context();
  const got = ctx.evaluate(["Hello,", " world", "!"]);
  assertEquals(got, "Hello, world!");
});

/*
This is all nice and dandy, but not worth the effort so far. What we still lack
are _macros_. A macro is a function that returns an expression.
*/
Deno.test("simple macro", () => {
  function Em({ children }: { children: Expression }): Expression {
    return ["<em>", children, "</em>"];
  }

  const ctx = new Context();
  const got = ctx.evaluate([
    Em({ children: "Hello" }),
    ", ",
    Em({ children: "world" }),
    "!",
  ]);
  assertEquals(got, "<em>Hello</em>, <em>world</em>!");
});

///////////////
// Using JSX //
///////////////

/*
There is a good reason for the rather unconventional argument type of the
preceding `Em` macro:
we can use [jsx](https://react.dev/learn/writing-markup-with-jsx) to
invoke it:
*/
Deno.test("simple macro jsx", () => {
  function Em({ children }: { children: Expression }): Expression {
    return ["<em>", children, "</em>"];
  }

  const ctx = new Context();
  const got = ctx.evaluate(<Em>Hello</Em>);
  assertEquals(got, "<em>Hello</em>");
});

/*
To use jsx, you need to configure your typescript compiler:

```json
{
    "compilerOptions": {
        "jsx": "react-jsxdev",
        "jsxImportSource": "macromaniajsx",
    },
    "imports": {
        "macromaniajsx/jsx-dev-runtime": "path/to/macromanias/main.ts",
    }
}
```
*/

/*
Remember that jsx only works with macros whose name starts with a capital
letter. Lowercase namess are reserved for built-in macros.
*/

/*
The `args` key of the single argument of each macro determines how many
expressions can go between the opening and closing tag of a macro invocation:
*/
Deno.test("jsx two children", () => {
  function Greet(
    { children }: { children: [Expression, Expression] },
  ): Expression {
    return [children[0], ", ", children[1], "!"];
  }

  const ctx = new Context();
  const got = ctx.evaluate(
    // We use a jsx fragment to divide text into two separate expressions here.
    <Greet>
      Hello<>World</>
    </Greet>,
  );
  assertEquals(got, "Hello, World!");
});

Deno.test("jsx two or more children", () => {
  function Join(
    { children }: { children: Expression[] },
  ): Expression {
    return children.join("::");
  }

  const ctx = new Context();
  const got = ctx.evaluate(<Join>foo{"bar"}baz</Join>);
  assertEquals(got, "foo::bar::baz");
});

Deno.test("jsx no children", () => {
  function Flubb(): Expression {
    return "Flubb!";
  }

  const ctx = new Context();
  const got = ctx.evaluate(<Flubb />);
  assertEquals(got, "Flubb!");
});

/*
Any argument key other than `children` can be used to define props:
*/

Deno.test("jsx props", () => {
  function Exclaim(
    { repetitions, children }: { repetitions: number; children: Expression },
  ): Expression {
    return [children, "!".repeat(repetitions)];
  }

  const ctx = new Context();
  const got = ctx.evaluate(<Exclaim repetitions={3}>Hi</Exclaim>);
  assertEquals(got, "Hi!!!");
});

////////////////////////
// Impure Expressions //
////////////////////////

/*
So far, we can basically concatenate strings, create them with functions, and
use jsx. That is not particularly impressive. But we are now ready to delve
into the reason why macromania is so powerful: macros can be stateful, one
invocation of a macro can influence other invocations.

As a first demonstration, we define a simple counter macro that evaluates to an
incrementing number each time.
*/

import { createSubstate } from "../main.ts";

Deno.test("counter macro", () => {
  // Create a getter and a setter for some macro-specific state.
  const [getCount, setCount] = createSubstate<number /* type of the state*/>(
    "Counter", // an arbitrary name for debugging purposes
    0, // the initial state
  );

  function Count({}): Expression {
    return {
      // An impure expression maps a Context to an expression.
      impure: (ctx: Context) => {
        const oldCount = getCount(ctx);
        setCount(ctx, oldCount + 1);
        return `${oldCount}`;
      },
    };
  }

  const ctx = new Context();
  const got = ctx.evaluate(
    <>
      <Count /> <Count /> <Count />
    </>,
  );
  assertEquals(got, "0 1 2");
});

/*
This example introduced a new kind of expression: an _impure_ expression is an
object with a single field `impure`, whose value is a function that takes a
`Context` and returns an expression. This function can read to and write from
the `Context` via getters and setters created by the `createSubstate` function.
The same `Context` is passed to separate invocations of the `Count` macro,
mutating the state allows earlier invocations to pass information to later
invocations.
*/

/*
Impure expressions are mostly used as an internal representation for macromania.
Macro authors would typically use the `impure` intrinsic for creating them; here
is an example where we build a simple system of definitions and references:
*/
Deno.test("defs and refs", () => {
  // Create a getter and a setter for our state: a mapping from short ids to
  // links.
  const [getDefs, _setDefs] = createSubstate<Map<string, string>>(
    "Definitions", // an arbitrary name for debugging purposes
    new Map(), // the initial state
  );

  // Registers a short name for a link, does not produce any output.
  function Def({ name, link }: { name: string; link: string }): Expression {
    const updateState = (ctx: Context) => {
      getDefs(ctx).set(name, link);
      return "";
    };
    return <impure fun={updateState} />;
  }

  // Given a registered name, outputs the associated link.
  function Ref({ name }: { name: string }): Expression {
    const fun = (ctx: Context) => {
      const link = getDefs(ctx).get(name);

      if (link) {
        return `<a href="${link}">${name}</a>`;
      } else {
        ctx.error(`Undefined name ${name}.`);
        ctx.halt();
        return "";
      }
    };
    return <impure fun={fun} />;
  }

  const ctx1 = new Context();
  const got1 = ctx1.evaluate(
    <>
      <Def name="squirrel" link="https://en.wikipedia.org/wiki/Squirrel" />
      Look, a <Ref name="squirrel" />!
    </>,
  );
  assertEquals(
    got1,
    `Look, a <a href="https://en.wikipedia.org/wiki/Squirrel">squirrel</a>!`,
  );

  /*
  This example also demonstrates two methods of `Context`: `error` prints an error
  message, and `halt` aborts macro expansion.

  These macros require definitions to occur before references, otherwise
  evaluation fails:
  */
  const ctx2 = new Context();
  const got2 = ctx2.evaluate(
    <>
      <Ref name="squirrel" /> ahead!
      <Def name="squirrel" link="https://en.wikipedia.org/wiki/Squirrel" />
    </>,
  );
  assertEquals(got2, null);
  assertEquals(ctx2.didWarnOrWorse(), true);

  /*
  We can fix this by returning `null` from the impure function in the Ref macro
  if the name has not been defined yet. Returning `null` causes the
  expression to be skipped and schedules it for later reevaluation.
  */

  // Given a name, outputs the associated link. Asks to be reevaluated at a
  // later point if the name is not yet defined.
  function PatientRef({ name }: { name: string }): Expression {
    const fun = (ctx: Context) => {
      const link = getDefs(ctx).get(name);
      if (link) {
        return `<a href="${link}">${name}</a>`;
      } else {
        return null;
      }
    };
    return <impure fun={fun} />;
  }

  const ctx3 = new Context();
  const got3 = ctx3.evaluate(
    <>
      <PatientRef name="squirrel" /> ahead!
      <Def name="squirrel" link="https://en.wikipedia.org/wiki/Squirrel" />
    </>,
  );
  assertEquals(
    got3,
    `<a href="https://en.wikipedia.org/wiki/Squirrel">squirrel</a> ahead!`,
  );

  /*
  If we reference a name that never gets defined, the evaluator recognizes that
  macro expansion stops making progress at some point, the `evaluate` method then
  returns `null` to indicate failure. That's a lot nicer than going into an
  infinite loop.
  */
  const ctx4 = new Context();
  const got4 = ctx4.evaluate(
    <>
      <PatientRef name="squirrel" />!
    </>,
  );
  assertEquals(got4, null);
  assertEquals(ctx4.didGiveUp(), true);

  /*
  When the evaluator detects that evaluation does not progress, it attemps
  reevaluation a final time. Macros can query whether they are being evaluated in
  a final attempt:
  */
  function MostlyPatientRef({ name }: { name: string }): Expression {
    const fun = (ctx: Context) => {
      const link = getDefs(ctx).get(name);
      if (link) {
        return `<a href="${link}">${name}</a>`;
      } else {
        if (ctx.mustMakeProgress()) {
          ctx.warn("Unknown name: ", name);
          return "[unknown name]";
        } else {
          return null;
        }
      }
    };
    return <impure fun={fun} />;
  }

  const ctx5 = new Context();
  const got5 = ctx5.evaluate(
    <>
      <MostlyPatientRef name="squirrel" /> ahead!
    </>,
  );
  assertEquals(got5, `[unknown name] ahead!`);
});
