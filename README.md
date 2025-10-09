![Logotype of the name of this project: Macromania](./macromania_deco.png)

Text generation made ~~easy~~ simple.

```tsx
<Definition id="tree" title="Tree">
  A <Def>tree</Def> is a connected graph on <Tex>n</Tex> vertices with{" "}
  <Tex>n - 1</Tex> edges<Cite id="Diestel2016" />.
</Definition>;
```

Macromania is a typescript-embedded domain-specific language for creating
strings, using [jsx syntax](https://en.wikipedia.org/wiki/JSX_(JavaScript)). You
can think of it as a highly expressive but completely unopinionated templating
language. It takes inspiration from lisp-like macro expansion and
[TeX](https://en.wikipedia.org/wiki/TeX), but the design ensures meaningful
error reporting, principled interaction between stateful macros, and static
typing for the input expressions.

See [the website](https://macromania.worm-blossom.org/) for more information.
