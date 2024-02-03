# Macromania

Macromania is a typescript-embedded domain-specific language for creating
strings, using [jsx syntax](https://en.wikipedia.org/wiki/JSX_(JavaScript)). You
can think of it as a highly expressive but completely unopinioated templating
language. It takes inspiration from lisp-like macro expansion and
[TeX](https://en.wikipedia.org/wiki/TeX), but the design ensures meaningful
error reporting, principled interaction between stateful macros, and static
typing for the input expressions.

## Tutorial

Macromania defines a type `Expression`. You give macromania an `Expression`, and
it expands the expression into a string. That's basically it.

### Setup

### The Basics

The most basic expression is a string, which evaluates to itself.

```ts
import { Context } from "macromania";

const ctx = new Context();
const got = ctx.evaluate("Hello, world!");
assertEquals(got, "Hello, world!");
```

This snippet demonstrates the fundamental working of macromania. You create a
new `Context`, pass an `Expression` (in this case, a string) to its `evaluate`
function, and get the expanded expression back.

That's it, that's basically all there is to know. All that remains is learning
about the different kinds of expressions there are.

An array of expression is itself an expression, evaluated by evaluating its
components and concatenating the results.

```ts
const ctx = new Context();
const got = ctx.evaluate(["Hello,", " world", "!"]);
assertEquals(got, "Hello, world!");
```

This is all nice and dandy, but also fairly useless so far. What we still lack
are _macros_. A macro is a function that returns an expression.

```ts
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
```

### JSX

There is a good reason for the rather unconventional argument type of this `Em`
macro: we can use [jsx](https://react.dev/learn/writing-markup-with-jsx) to
invoke it:

```tsx
function Em({ children }: { children: Expression }): Expression {
  return ["<em>", children, "</em>"];
}

const ctx = new Context();
const got = ctx.evaluate(<Em>Hello</Em>);
assertEquals(got, "<em>Hello</em>");
```

To use jsx, you need to configure your typescript compiler:

TODO

Also, remember that jsx only works with macros whose name starts with a capital
letter. Lowercase macros are reserved for built-in macros.

The `args` key of the single argument of each macro determines how many
expressions can go between the opening and closing tag of a macro invocation:

```tsx
function Link({ args: [Expression, Expression] }): Expression {
  return [`<a href="`, args[0], `">`, args[1], "</a>"];
}

const ctx = new Context();
ctx.evaluate(
  <Link>
    https://example.org click here
  </Link>,
);
// returns `<a href="https://eample.org">click here</a>`

ctx.evaluate(<Link>hi!</Link>);
// type error, expected two args
```

To create a macro that can take an arbitrary number of args, use
`args: Expression[]`. To create a macro that takes no args, simply omit the
`args` key.

Any keys other than args can be used to define props:

```tsx
function Exclaim({ repetitions: number, args: Expression }): Expression {
  return [args, "!".repeat(repetitions)];
}

const ctx = new Context();
ctx.evaluate(<Exclaim repetitions={3}>Hi</Exclaim>);
// returns "Hi!!!"
```

### Impure Expressions

So far, we can basically concatenate strings, create them with functions, and
use jsx. That is not particularly impressive. But we are now ready to delve into
the reason why macromania is so powerful: macros can be stateful, one invocation
of a macro can influence other invocations.

As a first demonstration, we define a simple counter macro that evaluates to an
incrementing number each time.

```tsx
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
      set_count(ctx, oldCount + 1);
      return `${oldCount}`;
    },
  };
}

const ctx = new Context();
ctx.evaluate(
  <>
    <Count />
    <Count /> <Count />
  </>,
);
// returns "012"
```

This example introduces a new kind of expression: an _impure_ expression is an
object with a single field `impure`, whose value is a function that takes a
`Context` and returns an expression. This function can read to and write from
the `Context` via getters and setters created by the `createSubstate` function.
The same `Context` is passed to separate invocations of the `Count` macro,
mutating the state allows earlier invocations to pass information to later
invocations.

Impure expressions are mostly used as an internal representation for macromania.
Macro authors would typically use the `impure` intrinsic for creating them; here
is an example where we build a simple system of definitions and references:

```tsx
// Create a getter and a setter for our state: a mapping from short ids to
// links.
const [getDefs, _setDefs] = createSubstate<Map<string, string>>(
  "Definitions", // an arbitrary name for debugging purposes
  new Map(), // the initial state
);

// Registers a short name for a link, does not produce any output.
function Def({ name: string, link: string }): Expression {
  const updateState = (ctx: Context) => {
    getDefs(ctx).set(name, link);
    return "";
  };
  return <impure fun={updateState} />;
}

// Given a registered name, outputs the associated link.
function Ref({ name: string }): Expression {
  const fun = (ctx: Context) => {
    const link = getDefs(ctx).get(name);
    if (link) {
      return `<a href="${link}">${name}</a>`;
    } else {
      ctx.error(`Undefined name ${name}.`);
      ctx.halt();
    }
  };
  return <impure fun={fun} />;
}

const ctx = new Context();
ctx.evaluate(
  <>
    <Def name="squirrel" link="https://en.wikipedia.org/wiki/Squirrel" />
    Look, a <Ref name="squirrel" />!
  </>,
);
// returns `Look, a <a href="https://en.wikipedia.org/wiki/Squirrel">squirrel</a>!`
```

This example also demonstrates two methods of `Context`: `error` prints an error
message, and `halt` aborts macro expansion. You can find all methods of the
`Context` class [here](TODO).

These macros require definitions to occur before references, otherwise
evaluation fails:

```tsx
const ctx = new Context();
ctx.evaluate(
  <>
    <Ref name="squirrel" /> ahead!
    <Def name="squirrel" link="https://en.wikipedia.org/wiki/Squirrel" />
  </>,
);
// Returns null to indicate evaluation failure.
```

We can fix this by returning `null` from the impure function, which causes the
expression to be skipped and schedules it for later reevaluation.

```tsx
// Given a name, outputs the associated link.
function PatientRef({ name: string }): Expression {
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

const ctx = new Context();
ctx.evaluate(
  <>
    <PatientRef name="squirrel" /> ahead!
    <Def name="squirrel" link="https://en.wikipedia.org/wiki/Squirrel" />
  </>,
);
// returns `<a href="https://en.wikipedia.org/wiki/Squirrel">squirrel</a> ahead!`
```

If we reference a name that never gets defined, the evaluator recognizes that
macro expansion stops making progress at some point, the `evaluate` method then
returns `null` to indicate failure. That's a lot nicer than going into an
infinite loop.

```tsx
const ctx = new Context();
ctx.evaluate(
  <>
    <PatientRef name="squirrel" />!
  </>,
);
// returns null
```

When the evaluator detects that evaluation does not progress, it attemps
reevaluation a final time. Macros can query whether they are being evaluated in
a final attempt:

```tsx
// Given a name, outputs the associated link.
function MostlyPatientRef({ name: string }): Expression {
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

const ctx = new Context();
ctx.evaluate(
  <>
    <MostlyPatientRef name="squirrel" /> ahead!
  </>,
);
// returns `[unknown name] ahead!`
```

### Lifecycle Expressions

The `lifecycle` intrinsic allows us to wrap an expression with functions that
are called for their side effects before or after the wrapped expression gets
evaluated.

```tsx
// Create a getter and a setter for indentation depth.
const [getIndent, setIndent] = createSubstate<number /* type of the state*/>(
  "Indentation", // an arbitrary name for debugging purposes
  0, // the initial state
);

// Given a name, outputs the associated link.
function Indent({ args: Expression }): Expression {
  const pre = (ctx: Context) => setIndent(ctx, getIndent(ctx) += 1);
  const post = (ctx: Context) => setIndent(ctx, getIndent(ctx) -= 1);
  return <lifecycle preprocess={post} postprocess={post}>args</lifecycle>;
}

// Output indentation according to the current level.
function Indentation({}): Expression {
  const fun = (ctx: Context) => "  ".repeat(getIndent(ctx));
  return <impure fun={fun} />;
}

// Pretty-printed div macro
function Div({ args: Expression }): Expression {
  return [
    "<div>\n",
    <Indent>
      <Indentation />args
    </Indent>,
    "\n</div>",
  ];
}
```

Note that the lifecycle functions get called _every time_ the wrapped expression
is evaluated; this gracefully handles wrapped impure expressions that require
several evaluation attempts.

### Mapping Expressions

The third and last major kind of expressions are _mapping expressions_, which
are created via the `map` intrinsic. They wwrap an expression, and once that
expresson has been evaluated to a string, it is given to a function that can
turn it into an arbitrary new expression.

```tsx
function Yell({ args: Expression }): Expression {
  const fun = (evaled: string, ctx: Context) => evaled.toUpperCase();
  return <map fun={fun}>args</map>;
}

const ctx = new Context();
ctx.evaluate(<Yell>Help!</Yell>);
// returns "HELP!"
```

### Miscelaneous

The `omnomnom` intrinsic wraps an expression, this expression gets evaluated for
its side-efect, but the whole thing evaluates to the empty string.

```tsx
const ctx = new Context();
ctx.evaluate(<omnomnom>Actually, I believe the artist wants...</omnomnom>);
// returns ""
```

The `Context` keeps track of a stacktrace of macro invocations in user code,
this stacktrace does not contain macros that were emitted from other macros. You
can use this to build pretty helpful error messages, here is an example for the
link name definition macros that detecs duplicate definition attempts and logs
the sites of the original definition and of the second definition attempt.

```tsx
interface DefinitionInfo {
  link: string;
  src: DebuggingInformation;
}

const [getDefs, _setDefs] = createSubstate<Map<string, DefinitionInfo>>(
  "Definitions",
  new Map(),
);

// Registers a short name for a link, does not produce any output.
function Def({ name: string, link: string }): Expression {
  const updateState = (ctx: Context) => {
    const defs = getDefs(ctx);
    if (!defs.has()) {
      defs.set(name, { link, src: ctx.getCurrentDebuggingInformation() });
    } else {
      // error_at logs the source location of this macro invocation
      ctx.error_at("Duplicate definition ", name);
      ctx.error(
        "First defined at ",
        formatDebuggingInformation(defs.get(name)!.src),
      );
      ctx.halt();
    }
    return "";
  };
  return <impure fun={updateState} />;
}

const ctx = new Context();
ctx.evaluate(
  <>
    <Def name="turtle" href="https://en.wikipedia.org/wiki/Turtle" />
    <Def name="turtle" href="https://en.wikipedia.org/wiki/Turtle_(robot)" />
  </>,
);
// logs:
// TODO
```

This tutorial has given you enough information to do some damage with
macromania. If you want to develop a fuller understanding of the library, we
recommend you read the [source](TODO). The code is well-commented, but more
importantly, it is simple and short. As code should be.
