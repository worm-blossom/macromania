# Macromania

Macromania is a typescript-embedded domain-specific language for creating strings, using embedded [jsx syntax](https://en.wikipedia.org/wiki/JSX_(JavaScript)). You can think of it as a highly expressive but completely unopinioated templating language. It takes inspiration from lisp-like macro expansion and [TeX](https://en.wikipedia.org/wiki/TeX), but the design ensures meaningful error reporting, principled interaction between stateful macros, and static typing for the input expressions.

## Tutorial

Macromania defines a type `Expression`. You give macromania an `Expression`, and it expands the expression into a string. That's basically it.

### The Basics

The most basic expression is a string, which evaluates to itself.

```ts
import { bla } from "bla";

const ctx = new Context();
ctx.evaluate("Hello, world!");
// returns "Hello, world!"
```

This snippet demonstrates the fundamental working of macromania. You create a new `Context`, pass an `Expression` (in this case, a string) to its `evaluate` function, and get the expanded expression back.

That's it, that's basically all there is to know. All that remains is learning about the different kinds of expressions there are.

An array of expression is itself an expression, evaluated by evaluating its components and concatenating the results.

```ts
ctx.evaluate(["Hello,", " world", "!"]);
// returns "Hello, world!"
```

This is all nice and dandy, but also fairly useless so far. What we still lack are *macros*. A macro is a function that returns an expression.

```ts
function Em({args: Expression}): Expression {
    return ["<em>", args, "</em>"];
}

const ctx = new Context();
ctx.evaluate([Em("Hello"), ", ", Em("world"), "!"]);
// returns "<em>Hello</em>, <em>world</em>!"
```

### JSX

There is a good reason for the rather unconventional argument type of this `Em` macro: we can use [jsx](https://react.dev/learn/writing-markup-with-jsx) to invoke it:

```tsx
function Em({args: Expression}): Expression {
    return ["<em>", args, "</em>"];
}

const ctx = new Context();
ctx.evaluate(
    <>
        <Em>Hello</Em>,
        <Em>world</Em>!
    </>
);
// returns "<em>Hello</em>, <em>world</em>!"
```

To use jsx, you need to configure your typescript compiler:

TODO

Also, remember that jsx only works with macros whose name starts with a capital letter. Lowercase macros are reserved for built-in macros.

The `args` key of the single argument of each macro determines how many expressions can go between the opening and closing tag of a macro invocation:

```tsx
function Link({args: [Expression, Expression]}): Expression {
    return [`<a href="`, args[0], `">`, args[1], "</a>"];
}

const ctx = new Context();
ctx.evaluate(<Link>
    https://example.org
    click here
</Link>);
// returns `<a href="https://eample.org">click here</a>`

ctx.evaluate(<Link>hi!</Link>);
// type error, expected two args
```

To create a macro that can take an arbitrary number of args, use `args: Expression[]`. To create a macro that takes no args, simply omit the `args` key.

Any keys other than args can be used to define props:

```ts
function Exclaim({repetitions: number, args: Expression}): Expression {
    return [args, "!".repeat(repetitions)];
}

const ctx = new Context();
ctx.evaluate(<Exclaim repetitions={3}>Hi</Exclaim>);
// returns "Hi!!!"
```

### Impure Expressions

So far, we can basically concatenate strings, create them with functions, and use jsx. That is not particularl impressive. But we are now ready to delve into the reason why macromania is so powerful: macros can be stateful, one invocation of a macro can influence other invocations.

As a first demonstration, we define a simple counter macro that evaluates to an incrementing number each time.

```ts
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
ctx.evaluate(<><Count /><Count /> <Count /></>);
// returns "012"
```

This example introduces a new kind of expression: an *impure* expression is an object with a single field `impure`, whose value is a function that takes a `Context` and returns an expression. This function can read to and write from the `Context` via getters and setters created by the `createSubstate` function. The same `Context` is passed to separate invocations of the `Count` macro, mutating the state allows earlier invocations to pass information to later invocations.

- simple defref, logging error and halting when undefined
- use-before-define defref
- defref with warning and placeholder when undefined
- `impure` intrinsic

- Lifecycle Expressions
    - indentation macros
    - `preprocess` and `postprocess` intrinsics
    - `lifecycle` intrinsic

- Mapping Expressions
    - Yell macro
    - returning non-string expressions

- Miscelaneous
    - debugging expressions and intrinsic
    - omnomnom intrinsic
    - encourage to read the source