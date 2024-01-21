# Arbitrary String Construction Project

The *Arbitrary String Construction Project* (*ASCP*) is a typescript-embedded domain specific language for creating strings. You can think of it as a highly expressive but completely unopinioated templating language. It takes inspiration from lisp-like macro expansion and [TeX](https://en.wikipedia.org/wiki/TeX), but the design ensures meaningful error reporting, principled interaction between stateful macros, and static typing for the input expressions.

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

---

Hi website team,

I found myself needing to dig into the details of tsx handling for a rather atypical usecase (using tsx as syntax for an embedded domain-specific language that has nothing to do with UI rendering), and ended up being best served by the [handbook jsx page](https://github.com/microsoft/TypeScript-Website/blob/v2/packages/documentation/copy/en/reference/JSX.md).

Thank you for documenting these rather arcane features. This was sufficient for me to hopefully get me to bend tsx to my needs, but I have collected a mixture of feedback and remaining questions regarding that page.

---

> TypeScript ships with three JSX modes: preserve, react, and react-native.

This is followed by a table that contains two more modes (react-jsx and react-jsxdev), that are not mentioned in the preceding paragraph.

The table of examples gave a nice at-a-glance overview, but there is no link to documentation of what *precisely* is going on. As someone who wants to write their custom jsxFactory, I need a lot more documentation than a single sample of an element without children or props. The links to the tsconfig docs lead to further examples, but still no definitions. From those examples, there is a link to [the blogpost announcing react-jsx and react-jsxdev modes](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html), and that finally links to [a tchnical document](https://github.com/reactjs/rfcs/blob/createlement-rfc/text/0000-create-element-changes.md#detailed-design). Which unfortunately still does not explain what actually happens in a self-contained manner.

In particular, I am still stumped about `<div />`being transformed to `_jsx("div", {}, void 0);` in react-jsx mode. The empty object would be the props I would guess, and the `void 0` probably relates to the absence of children. But as to why it would emit `void 0` of all things, and which other fun surprises it might have in store, I have no idea. And the react-jsxdev output is even more inscrutable.

A lot of this might be solved by augmenting the [docs on setting a jsxFactory](https://www.typescriptlang.org/tsconfig#jsxFactory) with information about which signature a jsxFactory must have to handle all things that the compiler might throw at it.

---

Intrinsic elements: I was left wondering about the mechanism for defining them via the `IntrinsicElements` interface in the `JSX` [ambient namespace](https://www.typescriptlang.org/docs/handbook/namespaces.html#ambient-namespaces), mostly because the docs for ambient namespaces are rather sparse.

Who should define the JSX namespace and the interface therein? What happens if the namespace gets defined *multiple* times? What happens if the *interface* gets defined in several independent `declare namespace JSX` blocks? Is there danger of things being overwritten, or does the compiler prevent this? On the more constructive end of that question, is it possible to extend that interface from multiple places in a codebase (say, I add a `div` intrinsic in `block_elements.ts` and a `span` intrinsic in `inline_elements.ts`, and later, a user library adds `my_custom_component`)?

---

Function components: "As the name suggests, the component is defined as a JavaScript function where its first argument is a props object." What about the other argument(s)? Presumably child related, but is it an array of children, or ar they passed as a variable number of arguments? The "normal" react docs answer this of course, but stating *half* the requirements here is a bit tantalizing. Especially in light of several cmpilation modes that emit varying forms of arguments to the function.

---

Attribute type checking: For value-based elements, it defines attribute type checking only for class components, not for function components. Should probably recap that it uses the type of their first argument.

---

Children Type Checking: by first defining the (global) name of the attribute for children, and then stating "You can specify the type of children like any other attribute.", it took me multiple reads to realize that the docs just switched from global configuration to component-specific configuration. Should it really be "attribute" in that sentence, or should it be "prop"? The text right now leaves me less than 100% certain whether I set the child type in the same place where the (other(?)) props or not.

The examples for setting the child type all use `children`. Is this hardcoded, or do I use `flubb` after setting

```ts
interface ElementChildrenAttribute {
    // This is what I need to do to change from "chidlren" to "flubb", right?
    flubb: {};
}
```
?

---

jsx result type (emphasis mine):

> By default the result of a JSX expression is typed as any. You can customize the type by specifying the JSX.Element interface. However, it is not possible to retrieve type information about the element, attributes or children of *the JSX* from this interface. It is a black box.

This confuses me, what is "the JSX" supposed to even be in this context?

---

I hope you find some of this feedback useful, and that you might be able to answer some of my questions. Finally, the docs might benefit from links to real code that actually configures these options or provides a custom jsxFactory (for eample, babel and preact respectively, or even the actual React code that deals with these issues).

Kind regards,
Aljoscha