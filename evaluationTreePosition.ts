import { newStack, type Stack } from "./stack.ts";

export class EvaluationTreePosition {
  protected theDepth: number;
  protected stack: Stack<number>; // index in parent

  /**
   * Creates a new root {@linkcode EvaluationTreePosition}.
   */
  protected constructor() {
    this.theDepth = 0;
    this.stack = newStack();
  }

  /**
   * Returns the depth in the tree (root has depth `0`, other nodes have depth of parent plus `1`).
   */
  depth(): number {
    return this.theDepth;
  }

  /**
   * Returns the index of this node in its parent node. Returns `-1` when called on the root node.
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
   * Returns whether this is equal to another {@linkcode EvaluationTreePosition} (i.e., they refer to the same node).
   */
  equals(other: EvaluationTreePosition): boolean {
    if (this.theDepth !== other.theDepth) {
      return false;
    }

    return stacksOfEqualLengthEq(this.stack, other.stack);
  }

  /**
   * Returns whether this node is an ancestor of another node (i.e., whether this macro call contains the other one). This method is reflexive, a node is its own ancestor. Use {@linkcode isStrictAncestorOf} to exclude reflexivity.
   */
  isAncestorOf(other: EvaluationTreePosition): boolean {
    const dca = this.deepestCommonAncestor(other);
    return this.equals(dca);
  }

  /**
   * Returns whether this node is an ancestor of another node but not equal to it.
   */
  isStrictAncestorOf(other: EvaluationTreePosition): boolean {
    return this.isAncestorOf(other) && !this.equals(other);
  }

  /**
   * Returns whether this node is a descendant of another node (i.e., whether this macro call is contained in the other one). This method is reflexive, a node is its own descendant. Use {@linkcode isStrictDescendantOf} to exclude reflexivity.
   */
  isDescendantOf(other: EvaluationTreePosition): boolean {
    return other.isAncestorOf(this);
  }

  /**
   * Returns whether this node is a descendant of another node but not equal to it.
   */
  isStrictDescendantOf(other: EvaluationTreePosition): boolean {
    return other.isStrictAncestorOf(this);
  }

  /**
   * Returns whether this node occurs earlier in the AST than another node (or is equal to it).
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
   * Returns whether this node occurs strictly earlier in the AST than another node (i.e., it is *not* equal to the other node).
   */
  isStrictlyEarlierThan(other: EvaluationTreePosition): boolean {
    return this.isEarlierThan(other) && !this.equals(other);
  }

  /**
   * Returns whether this node occurs later in the AST than another node (or is equal to it).
   */
  isLaterThan(other: EvaluationTreePosition): boolean {
    return other.isEarlierThan(this);
  }

  /**
   * Returns whether this node occurs strictly later in the AST than another node (i.e., it is *not* equal to the other node).
   */
  isStrictlyLaterThan(other: EvaluationTreePosition): boolean {
    return other.isStrictlyEarlierThan(this);
  }

  /**
   * Returns the position of the deepest common ancestor of this node and another node.
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
