// A simple, immutable stack, implemented as a linked list.

/**
 * A simple, immutable stack, used in Macromania for storing macro stacktraces (see {@linkcode Context.prototype.getDebuggingStack | Context.getDebuggingStack}).
 */
export abstract class Stack<T> {
  /**
   * Return the top of the stack, or `undefined` if the stack is empty. Does not modify the stack.
   */
  abstract peek(): T | undefined;
  /**
   * Return a new stack, missing the top element of the old one. Returns an empty stack when called on an empty stack. Does not modify the original stack.
   */
  abstract pop(): Stack<T>;
  /**
   * Return a new stack, with the additional elemnt `t` as the new top of the stack. Does not modify the original stack.
   */
  abstract push(t: T): Stack<T>;
  /**
   * Return whether the stack is empty.
   */
  abstract isEmpty(): boolean;
}

export function newStack<T>(): Stack<T> {
  return new EmptyStack<T>();
}

class EmptyStack<T> extends Stack<T> {
  peek(): T | undefined {
    return undefined;
  }

  pop(): Stack<T> {
    return this;
  }

  push(t: T): Stack<T> {
    return new Node(t, this);
  }

  isEmpty(): boolean {
    return true;
  }
}

class Node<T> extends Stack<T> {
  private item: T;
  private next: Stack<T>;

  constructor(item: T, next: Stack<T>) {
    super();
    this.item = item;
    this.next = next;
  }

  peek(): T | undefined {
    return this.item;
  }

  pop(): Stack<T> {
    return this.next;
  }

  push(t: T): Stack<T> {
    return new Node(t, this);
  }

  isEmpty(): boolean {
    return false;
  }
}
