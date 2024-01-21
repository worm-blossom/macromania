import { Context, Expression, Invocation, SourceLocation, WipExpansion } from "./main.ts";

// This namespace configures typechecking for jsx in tsx files.
declare namespace JSX {
    // We expect all jsx to turn into Expressions.
    // https://devblogs.microsoft.com/typescript/announcing-typescript-5-1-beta/#decoupled-type-checking-between-jsx-elements-and-jsx-tag-types
    // https://www.typescriptlang.org/docs/handbook/jsx.html#the-jsx-result-type
    export type ElementType = Expression;

    // Intrinsic elements are those with a lowercase name, in React
    // those would be html elements.
    // We only have a single intrinsic macro,the macro that evaluates its
    // single argument and then returns the empty string.
    //
    // https://www.typescriptlang.org/docs/handbook/jsx.html#intrinsic-elements
    // https://www.typescriptlang.org/docs/handbook/jsx.html#attribute-type-checking
    interface IntrinsicElements {
        omnomnom: { args: Expression };
    }

    // Where React uses `children`, we use `args`.
    interface ElementChildrenAttribute {
        args: {};
    }
}

// Source information provided by the react-jsxdev jsx-transform
interface JsxSource {
    fileName: string,
    lineNumber: number,
    columnNumber: number,
}

// jsxFactory for the ASCP, to be used with jsx-transform `react-jsxdev`
// https://www.typescriptlang.org/tsconfig#jsxFactory
// https://www.typescriptlang.org/tsconfig#jsx
// https://babeljs.io/docs/babel-plugin-transform-react-jsx-development
export function ascpFactory(
    macro: "omnomnom" | ((props: any, ctx: Context) => WipExpansion | null),
    props: any,
    _key: undefined,
    _is_static_children: boolean,
    source: JsxSource,
    self: any,
): Invocation {
    console.log(props);
    console.log(self);

    const src: SourceLocation = {
        file_name: source.fileName,
        line_number: source.lineNumber,
        column_number: source.columnNumber,
        macro_name: "TODO",
    };

    if (macro === "omnomnom") {
        return new Invocation(
            (_ctx: Context) => {
                return new WipExpansion(
                    props.args as Expression,
                    (_expanded, _ctx) => "",
                );
            },
            src,
        );
    } else {
        return new Invocation(
            (ctx: Context) => {
                return macro(props, ctx);
            },
            src,
        );
    }
}