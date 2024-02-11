/***
 *      _____            _                        _               _
 *     |_   _|  _  _    | |_     ___      _ _    (_)    __ _     | |
 *       | |   | +| |   |  _|   / _ \    | '_|   | |   / _` |    | |
 *      _|_|_   \_,_|   _\__|   \___/   _|_|_   _|_|_  \__,_|   _|_|_
 *    _|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|
 *    "`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'
 */

/*
Welcome to the Macromania tutorial. You can start reading this file without
knowing anything about Macromania. The tutorial walks you through all the
features of Macromania. It also happens to double as a test suite.
*/
import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";

///////////////////
// 1. The Basics //
///////////////////

/*
Macromania defines a type `Expression`. You give Macromania an `Expression`, and
it expands the expression into a string.
*/
import { Context, Expression } from "./mod.ts";

/*
The most basic expression is a string, which evaluates to itself:
*/
Deno.test("string expression", () => {
  const ctx = new Context();
  const got = ctx.evaluate("Hello, world!");
  assertEquals(got, "Hello, world!");
});

/*
This snippet has demonstrated the fundamental working of Macromania. You create
a new `Context`, pass an `Expression` (in this case, a string) to its
`evaluate` function, and get the expanded expression back.
*/

/*
To evaluate a sequence of expressions and concatenate the results, use a
`FragmentExpression`:
*/
Deno.test("fragment expression", () => {
  const ctx = new Context();
  const got = ctx.evaluate({ fragment: ["Hello,", " world", "!"] });
  assertEquals(got, "Hello, world!");
});

/*
This is all nice and dandy, but not worth the effort so far. What we still lack
are _macros_. A macro is a function that returns an expression.
*/
Deno.test("simple macro", () => {
  function Em({ children }: { children: Expression }): Expression {
    return { fragment: ["*", children, "*"] };
  }

  const ctx = new Context();
  const got = ctx.evaluate(
    Em({ children: "Hello, world!" }),
  );
  assertEquals(got, "*Hello, world!*");
});

///////////////
// Using JSX //
///////////////

/*
There is a good reason for the rather unconventional argument type of the
preceding `Em` macro: We can use
[jsx](https://react.dev/learn/writing-markup-with-jsx) in macromania.
*/
Deno.test("simple macro jsx", () => {
  function Em({ children }: { children: Expression }): Expression {
    return <>*{children}*</>; // A jsx fragment compiles into a FragmentExpression
  }

  const ctx = new Context();
  const got = ctx.evaluate(<Em>Hello</Em>);
  assertEquals(got, "*Hello*");
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
        "macromaniajsx/jsx-dev-runtime": "path/to/macromanias/mod.ts",
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
    return <>{children[0]}, {children[1]}!</>;
  }

  const ctx = new Context();
  const got = ctx.evaluate(
    <Greet>
      {"Hello"}
      {"World"}
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
    return <>{children}{"!".repeat(repetitions)}</>;
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
into the reason why Macromania is so powerful: macros can be stateful, one
invocation of a macro can influence other invocations.

As a first demonstration, we define a simple counter macro that evaluates to an
incrementing number each time.
*/

import { createSubstate } from "./mod.ts";

Deno.test("counter macro", () => {
  // Create a getter and a setter for some macro-specific state.
  const [getCount, setCount] = createSubstate<number /* type of the state*/>(
    0, // the initial state
  );

  function Count(): Expression {
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
Impure expressions are mostly used as an internal representation for Macromania.
Macro authors would typically use the `impure` intrinsic for creating them; here
is an example where we build a simple system of definitions and references:
*/
Deno.test("defs and refs", () => {
  // Create a getter and a setter for our state: a mapping from short ids to
  // links.
  const [getDefs, _setDefs] = createSubstate<Map<string, string>>(
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

///////////////////////////
// Lifecycle Expressions //
///////////////////////////

/*
The `lifecycle` intrinsic allows us to wrap an expression with functions that
are called for their side effects before or after the wrapped expression gets
evaluated.

In the following example, we build a macro for nested markdown sections that
automatically uses the correkt markup for headings.
*/
// Create a getter and a setter for section depth.
Deno.test("nested markdown sections", () => {
  const [getDepth, setDepth] = createSubstate<number>(0);

  // Render the markup for a heading.
  function AutoHeading(
    { children }: { children: Expression },
  ): Expression {
    const fun = (ctx: Context) => {
      return <>{"#".repeat(getDepth(ctx))} {children}{"\n"}</>;
    };
    return <impure fun={fun} />;
  }

  // Render the markup for a section.
  function Section(
    { children, title }: { children: Expression; title: Expression },
  ): Expression {
    const pre = (ctx: Context) => setDepth(ctx, getDepth(ctx) + 1);
    const post = (ctx: Context) => setDepth(ctx, getDepth(ctx) - 1);
    return (
      <lifecycle pre={pre} post={post}>
        <>
          <AutoHeading>{title}</AutoHeading>
          {children}
        </>
      </lifecycle>
    );
  }

  const ctx = new Context();
  const got = ctx.evaluate(
    <Section title="My Text">
      <>
        Bla bla bla{"\n"}
        <Section title="Subsection 1">{"Hi!\n"}</Section>
        <Section title="Subsection 2">{"Bye!\n"}</Section>
      </>
    </Section>,
  );
  assertEquals(
    got,
    `# My Text
Bla bla bla
## Subsection 1
Hi!
## Subsection 2
Bye!
`,
  );
});

/*
Note that the lifecycle functions get called _every time_ the wrapped expression
is evaluated; this gracefully handles wrapped impure expressions that require
several evaluation attempts.
*/

/////////////////////
// Map Expressions //
/////////////////////

/*
The third and last major kind of expressions are _mapping expressions_, which
are created via the `map` intrinsic. They wrap an expression, and once that
expression has been evaluated to a string, it is given to a function that can
turn it into an arbitrary new expression.
*/
Deno.test("yell", () => {
  function Yell({ children }: { children: Expression }): Expression {
    const fun = (evaled: string, ctx: Context) => evaled.toUpperCase();
    return <map fun={fun}>{children}</map>;
  }

  const ctx = new Context();
  const got = ctx.evaluate(<Yell>Help!</Yell>);
  assertEquals(got, "HELP!");
});

///////////////////
// Miscellaneous //
///////////////////

/*
The `omnomnom` intrinsic wraps an expression. This expression gets evaluated for
any side-effects, but the intrinsic then evaluates to the empty string.
*/
Deno.test("omnomnom", () => {
  const ctx = new Context();
  const got = ctx.evaluate(
    <omnomnom>Actually, I believe the artist *really* wants to...</omnomnom>,
  );
  assertEquals(got, "");
});

/*
The `fragment` intrinsic can be used to convert an array of Expressions into
a FragmentExpression:
*/
Deno.test("fragment intrinsic", () => {
  const ctx = new Context();
  const got = ctx.evaluate(
    <fragment exps={["a", "b", "c"]} />,
  );
  assertEquals(got, "abc");
});

/*
If you want to define a macro that can operate on any number of children, then
the typechecker start complaining because of the way that jsx gets compiled.

Use the `Expressions` type and the `expressions` function to work around it.
*/
import { Expressions, expressions } from "./mod.ts";

Deno.test("many children", () => {
  function Many({ children }: { children?: Expressions }): Expression {
    const inner = expressions(children);
    return `${inner.length}`;
  }

  const ctx1 = new Context();
  const got1 = ctx1.evaluate(<Many />);
  assertEquals(got1, "0");

  const ctx2 = new Context();
  const got2 = ctx2.evaluate(<Many>foo</Many>);
  assertEquals(got2, "1");

  const ctx3 = new Context();
  const got3 = ctx3.evaluate(<Many>{"foo"}{"bar"}{"baz"}</Many>);
  assertEquals(got3, "3");
});

/*
And this really is it.

To develop a complete understanding of Macromania's workings, We recommend
reading the source code. It is pretty straightforward, well-commented, and not
much longer than this tutorial.

Have fun building some macros!
*/

/*
Why are you still reading this?
*/

/*
There's really nothing of interest here anymore.
*/

/*
Told you.
*/
