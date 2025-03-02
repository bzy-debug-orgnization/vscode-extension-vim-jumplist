export class Node<T> {
  prev: Node<T> | undefined;
  next: Node<T> | undefined;
  constructor(public data: T) {}
}

export class LinkedList<T> {
  head: Node<T> | undefined;
  tail: Node<T> | undefined;
  size = 0;
  constructor() {}

  insertFirst(data: T) {
    const node = new Node(data);
    if (this.head) {
      node.next = this.head;
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
    this.size++;
  }

  insertLast(data: T) {
    const node = new Node(data);
    if (this.tail) {
      node.prev = this.tail;
      this.tail.next = node;
    }
    this.tail = node;
    if (!this.head) {
      this.head = node;
    }
    this.size++;
  }

  insertBefore(node: Node<T>, data: T) {
    if (!node.prev) {
      return this.insertFirst(data);
    }
    const newNode = new Node(data);
    newNode.prev = node.prev;
    newNode.next = node;
    node.prev.next = newNode;
    node.prev = newNode;
    this.size++;
  }

  insertAfter(node: Node<T>, data: T) {
    if (!node.next) {
      return this.insertLast(data);
    }
    const newNode = new Node(data);
    newNode.prev = node;
    newNode.next = node.next;
    node.next.prev = newNode;
    node.next = newNode;
    this.size++;
  }

  remove(node: Node<T>) {
    if (!node.prev) {
      this.head = node.next;
    } else {
      node.prev.next = node.next;
    }
    if (!node.next) {
      this.tail = node.prev;
    } else {
      node.next.prev = node.prev;
    }
    this.size--;
  }

  clear() {
    this.head = undefined;
    this.tail = undefined;
    this.size = 0;
  }

  *iterPrev(node: Node<T>) {
    let cur: Node<T> | undefined = node;
    while (cur) {
      const prev: Node<T> | undefined = cur.prev;
      yield cur;
      cur = prev;
    }
  }

  *iterNext(node: Node<T>) {
    let cur: Node<T> | undefined = node;
    while (cur) {
      const next: Node<T> | undefined = cur.next;
      yield cur;
      cur = next;
    }
  }

  *iterHead() {
    if (this.head) {
      yield* this.iterNext(this.head);
    }
  }

  *iterTail() {
    if (this.tail) {
      yield* this.iterPrev(this.tail);
    }
  }
}
