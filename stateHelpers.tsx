import {
  Context,
  type Expression,
  type Expressions,
} from "macromaniajsx/jsx-dev-runtime";

export function doCreateScopedState<S>(
  initial: (parentState?: S) => S,
): [
  (props: { children?: Expressions }) => Expression,
  (ctx: Context) => S,
  (ctx: Context, newState: S) => void,
] {
  const [get, set] = Context.createState<S>(initial);

  function StateScope({ children }: { children?: Expressions }): Expression {
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
              <exps x={children} />
            </lifecycle>
          );
        }}
      />
    );
  }

  return [StateScope, get, set];
}
