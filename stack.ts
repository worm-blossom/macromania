// A simple, immutable stack, implemented as a linked list.

export abstract class Stack<T> {
    abstract peek(): T | undefined;
    abstract pop(): Stack<T>;
    abstract push(t: T): Stack<T>;
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