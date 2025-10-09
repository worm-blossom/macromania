import { newStack, type Stack } from "./stack.ts";

/**
 * An opaque value associated with each expression, which can be used for pairwise comparisons of the source code position of expressions.
 *
 * Obtained via the {@linkcode Context.prototype.getEvaluationTreePosition | Context.getEvaluationTreePosition} method.
 */
export class EvaluationTreePosition {
  /** @ignored */
  protected theDepth: number;
  /** @ignored */
  protected stack: Stack<number>; // index in parent

  /**
   * Create a new root {@linkcode EvaluationTreePosition}.
   *
   * @ignored
   */
  protected constructor() {
    this.theDepth = 0;
    this.stack = newStack();
  }

  /**
   * Return the depth in the tree (root has depth `0`, other expressions have depth of parent plus `1`) at which the expression was written in the source.
   */
  depth(): number {
    return this.theDepth;
  }

  /**
   * Return the index of this expression in its parent expression. Returns `-1` when called on the root expression.
   * Siblings with a greater `indexInParent` appear later in the source code than those with a lesser `indexInParent`.
   */
  indexInParent(): number {
    const tos = this.stack.peek();

    if (tos === undefined) {
      return -1;
    } else {
      return tos;
    }
  }

  /**
   * Return whether this is equal to another {@linkcode EvaluationTreePosition} (i.e., whether both they refer to the same syntax tree node).
   */
  equals(other: EvaluationTreePosition): boolean {
    if (this.theDepth !== other.theDepth) {
      return false;
    }

    return stacksOfEqualLengthEq(this.stack, other.stack);
  }

  /**
   * Return whether this expression is an ancestor of another expression (i.e., whether this macro call contains the other one). This method is reflexive, an expression is its own ancestor. Use {@linkcode EvaluationTreePosition.isStrictAncestorOf} to exclude reflexivity.
   */
  isAncestorOf(other: EvaluationTreePosition): boolean {
    const dca = this.deepestCommonAncestor(other);
    return this.equals(dca);
  }

  /**
   * Return whether this expression is an ancestor of another expression but not equal to it.
   */
  isStrictAncestorOf(other: EvaluationTreePosition): boolean {
    return this.isAncestorOf(other) && !this.equals(other);
  }

  /**
   * Return whether this expression is a descendant of another expression (i.e., whether this macro call is contained in the other one). This method is reflexive, an expression is its own descendant. Use {@linkcode EvaluationTreePosition.isStrictDescendantOf} to exclude reflexivity.
   */
  isDescendantOf(other: EvaluationTreePosition): boolean {
    return other.isAncestorOf(this);
  }

  /**
   * Return whether this expression is a descendant of another expression but not equal to it.
   */
  isStrictDescendantOf(other: EvaluationTreePosition): boolean {
    return other.isStrictAncestorOf(this);
  }

  /**
   * Return whether this expression occurs earlier in the source code than another expression (or is equal to it).
   */
  isEarlierThan(other: EvaluationTreePosition): boolean {
    const dca = this.deepestCommonAncestor(other);

    if (this.stack === dca.stack) {
      return true;
    } else if (other.stack === dca.stack) {
      return false;
    } else {
      let myStack = this.stack;
      for (let myI = this.theDepth; myI + 1 > dca.theDepth; myI--) {
        myStack = myStack.pop();
      }

      let otherStack = other.stack;
      for (let otherI = other.theDepth; otherI + 1 > dca.theDepth; otherI--) {
        otherStack = otherStack.pop();
      }

      if (myStack.isEmpty()) {
        return true;
      } else {
        return myStack.peek()! <= otherStack.peek()!;
      }
    }
  }

  /**
   * Return whether this expression occurs *strictly* earlier in the source code than another expression (i.e., it is *not* equal to the other expression).
   */
  isStrictlyEarlierThan(other: EvaluationTreePosition): boolean {
    return this.isEarlierThan(other) && !this.equals(other);
  }

  /**
   * Return whether this expression occurs later in the source code than another expression (or is equal to it).
   */
  isLaterThan(other: EvaluationTreePosition): boolean {
    return other.isEarlierThan(this);
  }

  /**
   * Return whether this expression occurs *strictly* later in the source code than another expression (i.e., it is *not* equal to the other expression).
   */
  isStrictlyLaterThan(other: EvaluationTreePosition): boolean {
    return other.isStrictlyEarlierThan(this);
  }

  /**
   * Return the position of the deepest common ancestor of this expression and another expression.
   *
   * @ignored
   */
  protected deepestCommonAncestor(
    other: EvaluationTreePosition,
  ): EvaluationTreePosition {
    let myStack = this.stack;
    let myDepth = this.theDepth;
    let otherStack = other.stack;
    let otherDepth = other.theDepth;

    while (myDepth > otherDepth) {
      myStack = myStack.pop();
      myDepth -= 1;
    }

    while (otherDepth > myDepth) {
      otherStack = otherStack.pop();
      otherDepth -= 1;
    }

    let candidate = myStack;
    let candidateDepth = myDepth;

    while (myDepth > 0) {
      if (myStack === otherStack) {
        break;
      }

      const unequalTos = myStack.peek() !== otherStack.peek();

      myStack = myStack.pop();
      otherStack = otherStack.pop();
      myDepth -= 1;

      if (unequalTos) {
        candidate = myStack;
        candidateDepth = myDepth;
      }
    }

    const ret = new EvaluationTreePosition();
    ret.theDepth = candidateDepth;
    ret.stack = candidate;
    return ret;
  }
}

export class EvaluationTreePositionImpl extends EvaluationTreePosition {
  constructor() {
    super();
  }

  appendChild(indexInParent: number): EvaluationTreePositionImpl {
    const ret = new EvaluationTreePositionImpl();
    ret.theDepth = this.theDepth + 1;
    ret.stack = this.stack.push(indexInParent);
    return ret;
  }
}

function stacksOfEqualLengthEq(
  fst: Stack<number>,
  snd: Stack<number>,
): boolean {
  if (fst === snd) {
    return true;
  } else {
    const fstTos = fst.peek();
    const sndTos = snd.peek();

    if (fstTos === undefined && snd === undefined) {
      return true;
    } else if (fstTos === undefined || snd === undefined) {
      return false;
    } else {
      return fstTos === sndTos! &&
        stacksOfEqualLengthEq(fst.pop(), snd.pop());
    }
  }
}
