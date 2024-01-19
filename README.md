# Arbitrary String Construction Project

The *Arbitrary String Construction Project* (*ASCP*) is a typescript-embedded domain specific language for creating strings. You can think of it as a highly expressive but completely unopinioated templating language. It take inspiration from lisp-like macro expansion and [TeX](https://en.wikipedia.org/wiki/TeX), but the design ensures meaningful error reporting, principled interaction between stateful macros, and stati typing for the input expressions.

## Usage

The ASCP exports a function `expand`, which takes an input expression, and expands it into a string.

The most simple kind of expression is a string, which gets expanded to itself:

```ts
// import `expand`
console.log(expand("Hello!"));
// "Hello"
```

Another kind of expression are arrays of expressions. An array expanded by expanding its components and concatenating the result:

```ts
expand(["Hello,", " world!"]);
// "Hello, world!"

expand(["Arrays ", ["can ", "be ", "nested."]]);
// "Arrays can be nested."
```

