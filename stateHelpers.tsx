import {
  Context,
  type Expression,
  type Children,
} from "macromaniajsx/jsx-dev-runtime";

export function doCreateScopedState<S>(
  initial: (parentState?: S) => S,
): [
  (props: { children?: Children }) => Expression,
  (ctx: Context) => S,
  (ctx: Context, newState: S) => void,
] {
  const [get, set] = Context.createState<S>(initial);

  function StateScope({ children }: { children?: Children }): Expression {
    return (
      <impure
        fun={(ctx) => {
          let parentState = get(ctx);
          let myState = initial(parentState);

          return (
            <lifecycle
              pre={(ctx) => {
                parentState = get(ctx);
                set(ctx, myState);
              }}
              post={(ctx) => {
                myState = get(ctx);
                set(ctx, parentState);
              }}
            >
              {children}
            </lifecycle>
          );
        }}
      />
    );
  }

  return [StateScope, get, set];
}

// deno-lint-ignore no-explicit-any
export function doCreateConfig<C extends Record<string, any>>(
  initial: () => Required<C>,
): [
  (props: C | { children?: Children }) => Expression,
  (ctx: Context) => Required<C>,
] {
  const [StateScope, get, _set] = doCreateScopedState<Required<C>>(
    (parentState) => {
      if (parentState === undefined) {
        return initial();
      } else {
        return { ...parentState };
      }
    },
  );

  function ConfigScope(props: C | { children?: Children }): Expression {
    return (
      <StateScope>
        <impure
          fun={(ctx) => {
            const state = get(ctx);

            for (const key in props) {
              if (
                key !== "children" &&
                Object.prototype.hasOwnProperty.call(props, key)
              ) {
                const element = (props as C)[key];
                // deno-lint-ignore no-explicit-any
                (state as any)[key] = element;
              }
            }

            return <>{props.children}</>;
          }}
        />
      </StateScope>
    );
  }

  return [ConfigScope, get];
}
