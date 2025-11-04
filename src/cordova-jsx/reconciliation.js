import htmlTags from "html-tags";
import svgTags from 'svg-tags';

/** @type {RenderNode} */
let lastMountedNode = null;

/**
 *
 * @param {JSX[]} jsxArray
 */
function checkKeysInJsxArray(jsxArray) {
  const usedKeys = [];

  return jsxArray.every((item) => {
    if (!item.attributes || !item.attributes.key || usedKeys.includes(item.attributes.key)) {
      return false;
    }

    usedKeys.push(item.attributes.key);
    return true;
  });
}

/**
 *
 * @param {RenderNode} renderNode
 * @param {string} key
 */
function findChildNodeWithKey(renderNode, key) {
  /** @type {RenderNode} */
  let foundNode = null;

  for (const child of renderNode.children) {
    if (child.key === key) {
      foundNode = child;
      break;
    }
  }

  return foundNode;
}

/**
 * Find a matching node in children of current node.
 * Matching
 *
 * @param {RenderNode} currentNode
 * @param {RenderNode} searchedNode
 * @param {number} position
 * @return {RenderNode}
 */
function findMatchingNode(currentNode, searchedNode, position) {
  /** @type {RenderNode} */
  let foundNode = null;

  if (!currentNode) {
    return null;
  }

  if (searchedNode.key) {
    foundNode = findChildNodeWithKey(currentNode, searchedNode.key);
  }

  if (foundNode) {
    return foundNode;
  }

  if (currentNode.children.length <= position) {
    return null;
  }

  return currentNode.children[position];
}

/**
 * Flatten children that are type of array.
 *
 * @param {RenderResult} jsx
 */
function flattenChildrenInJSX(jsx) {
  if (typeof jsx === 'string') {
    return jsx;
  }

  let children = [];
  jsx.children.forEach(child => {
    if (!Array.isArray(child)) {
      children.push(child);
      return;
    }

    children = [
      ...children,
      ...child
    ];
  });

  return {
    ...jsx,
    children,
  };
}

/**
 *
 * @param {RenderNode} currentNode
 * @param {RenderNode} newNode
 * @param recursive
 */
function copyData(currentNode, newNode, recursive = false) {
  if (currentNode.tag === newNode.tag) {
    newNode.oldProps = currentNode.oldProps;
    newNode.elementRef = currentNode.elementRef;

    if (newNode.type === 'component') {
      newNode.instance = currentNode.instance;
      newNode.instance.props = newNode.pendingProps;
      newNode.state = currentNode.state;
      newNode.stateChanged = currentNode.stateChanged;
    }
  }

  if (recursive) {
    newNode.children.forEach((child, index) => {
      copyData(currentNode.children[index], child, recursive);
    })
  }
}

function compareProps(oldProps, newProps) {
  if (typeof oldProps !== 'object' || typeof newProps !== 'object') {
    return false;
  }

  if (Object.keys(newProps).length !== Object.keys(newProps).length) {
    return false;
  }

  return Object.entries(newProps).every(([key, value], index) => {
    return value === oldProps[key];
  });
}

/**
 *
 * @param {RenderNode} node
 */
function mountRenderSubtree(node) {
  node.effect = 'Placement';

  if (node.type === 'component') {
    lastMountedNode = node;
    node.createComponent();

    let jsx = node.instance.render();
    jsx = flattenChildrenInJSX(jsx);
    const subNode = RenderNode.fromJSX(jsx);

    if (subNode) {
      node.appendChild(subNode);
    }
  }

  node.children.forEach((child) => {
    child.effect = 'Placement';
    mountRenderSubtree(child);
  });
}

/**
 *
 * @param {RenderNode} node
 */
function shouldUpdateNode(node) {
  if (node.type !== 'component') {
    return !compareProps(node.oldProps, node.pendingProps);
  }

  return node.didStateChanged() || !compareProps(node.oldProps, node.pendingProps);
}

/**
 *
 * @param {RenderNode} newNode
 */
function updateRenderNodes(newNode) {
  newNode.effect = 'Update';
  newNode.pendingUpdate = true;

  if (newNode.type !== 'component') {
    return;
  }

  let jsx = newNode.instance.render();
  jsx = flattenChildrenInJSX(jsx);
  const subNode = RenderNode.fromJSX(jsx);

  if (subNode) {
    // copyData(newNode.children[0], subNode, true);
    newNode.children = [];
    newNode.appendChild(subNode);
  }
}

/**
 *
 * @param {RenderNode} currentNode
 * @param {RenderNode} newNode
 */
function reuseNode(currentNode, newNode) {
  const clonedCurrentNode = currentNode.clone();

  if (newNode.type === 'component') {
    let jsx = newNode.instance.render();
    jsx = flattenChildrenInJSX(jsx);
    const subNode = RenderNode.fromJSX(jsx);

    if (subNode) {
      newNode.children = [];
      newNode.appendChild(subNode);
    }
  }

  clonedCurrentNode.parent = newNode.parent;
  clonedCurrentNode.children = newNode.children;

  newNode.copyFrom(clonedCurrentNode);
}

export class RenderNode {
  /**
   * Creates an instance fo renderable node.
   *
   * @param {RenderNodeType} type
   * @param {RenderNodeTag} tag
   * @param {RenderNodeProps} props
   */
  constructor(type, tag, props = {}) {
    const { key, ref, ...otherProps } = props ?? {};

    /** @type {string} **/
    this.key = key;
    this.type = type;
    this.tag = tag;

    /** @type {Record<string, any>} */
    this.oldProps = {};
    /** @type {Record<string, any>} */
    this.pendingProps = otherProps;
    /** @type {Record<string, any>} */
    this.state = {};
    /** @type {RefObject} */
    this.ref = ref;
    /** @type {RefObject[]} */
    this.refs = [];

    /** @type {RenderNodeEffect} */
    this.effect = '';
    this.stateChanged = false;
    this.mounted = false;
    this.pendingUpdate = false;

    /** @type {RenderNode[]} */
    this.children = [];
    /** @type {RenderNode} */
    this.parent = null;
    /** @type {Component} */
    this.instance = null;
    /** @type {Node} */
    this.elementRef = null;
    /** @type {Record<string, Function[]>} */
    this.listeners = {};
  }

  /**
   * Checks if node is a root node in tree.
   *
   * @returns {boolean}
   */
  isRoot() {
    return this._type === 'root';
  }

  didStateChanged() {
    return this.stateChanged;
  }

  allChildrenMounted() {
    return this.children.reduce((count, childNode) => {
      let result = false;

      if (['element', 'text'].includes(childNode.type)) {
        result = childNode.elementRef !== null;
      } else if (childNode.type === 'component') {
        result = childNode.mounted;
      }

      return count + (result && childNode.allChildrenMounted() ? 1 : 0);
    }, 0) === this.children.length;
  }

  allChildrenUpdated() {
    return this.children.reduce((count, childNode) => {
      return count + (!childNode.pendingUpdate && childNode.allChildrenUpdated() ? 1 : 0);
    }, 0) === this.children.length;
  }

  /**
   *
   * @param {string} type
   * @param {Function} listener
   */
  addListener(type, listener) {
    if (!this.elementRef) {
      return;
    }

    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }

    this.elementRef.addEventListener(type, listener);
    this.listeners[type].push(listener);
  }

  removeListener(type, listener) {
    /** @type Function[] */
    const listenersWithType = this.listeners[type] ?? [];

    if (listenersWithType.length === 0) {
      return;
    }

    let foundListenerIndex = -1;
    const foundListener = listenersWithType.find((anotherListener, index) => {
      if (anotherListener === listener) {
        foundListenerIndex = index;
        return true;
      }

      return false;
    });

    if (!foundListener) {
      throw new Error(`Listener for ${type} on node ${this.tag} not found. Cause: listener probably wasn't bound in constructor.`);
    }

    this.elementRef.removeEventListener(type, foundListener);
    listenersWithType.splice(foundListenerIndex, 1);
  }

  cleanListeners() {
    for (const [type, listeners] of Object.entries(this.listeners)) {
      if (!this.elementRef) {
        continue;
      }

      listeners.forEach((listener) => {
        this.elementRef.removeEventListener(type, listener);
      })
    }

    this.listeners = {};
  }

  createComponent() {
    this.instance = new this.tag(this.pendingProps);
    this.state = this.instance.state;
  }

  /**
   * Appends a child into current node.
   *
   * @param {RenderNode} node
   */
  appendChild(node) {
    node.parent = this;
    this.children.push(node);
  }

  /**
   * Replaces a child node in current node with a new node.
   *
   * @param {RenderNode} newNode
   * @param {RenderNode} oldNode
   */
  replaceChild(newNode, oldNode) {
    const indexOf = this.children.indexOf(oldNode);

    if (indexOf >= 0) {
      newNode.parent = this;
      this.children[indexOf].parent = null;
      this.children[indexOf] = newNode;
    }
  }

  /**
   * Removes a child node from current node.
   *
   * @param {RenderNode} node
   */
  removeChild(node) {
    const indexOf = this.children.indexOf(node);

    if (indexOf >= 0) {
      node.parent = null;
      this.children.splice(indexOf, 1);
    }
  }

  /**
   *
   * @param {RenderNode} node
   */
  copyFrom(node) {
    this.hash = node.hash;
    this.key = node.key;
    this.type = node.type;
    this.tag = node.tag;

    this.oldProps = node.oldProps;
    this.pendingProps = node.pendingProps;
    this.state = node.state;
    this.ref = node.ref;
    this.refs = node.refs;

    this.mounted = node.mounted;
    this.pendingUpdate = node.pendingUpdate;
    this.stateChanged = node.stateChanged;
    this.effect = node.effect;
    this.children = node.children;
    this.parent = node.parent;
    this.instance = node.instance;
    this.elementRef = node.elementRef;
    this.listeners = node.listeners;
  }

  clone() {
    const cloned = new RenderNode(
      this.type,
      this.tag,
      {
        key: this.key,
        ...this.pendingProps
      }
    );

    cloned.hash = this.hash;
    cloned.effect = this.effect;
    cloned.oldProps = this.oldProps;
    cloned.state = this.state;
    cloned.ref = this.ref;
    cloned.refs = this.refs;
    cloned.mounted = this.mounted;
    cloned.pendingUpdate = this.pendingUpdate;
    cloned.stateChanged = this.stateChanged;
    cloned.children = this.children;
    cloned.parent = this.parent;
    cloned.instance = this.instance;
    cloned.elementRef = this.elementRef;
    cloned.listeners = this.listeners;

    return cloned;
  }

  /**
   * Builds a render node tree from JSX structure.
   *
   * @param {RenderResult} jsx
   * @param {RenderNode} parent
   */
  static fromJSX(jsx, parent = null) {
    let {
      elementName = jsx ?? '',
      attributes = {},
      children = []
    } = jsx ?? {};

    /** @type {RenderNode} */
    let node;

    if (typeof elementName === 'function') {
      node = new RenderNode('component', elementName, { children, ...attributes });
      children = [];
    } else if ([...htmlTags].includes(elementName) || [...svgTags].includes(elementName)) {
      node = new RenderNode('element', elementName, attributes);
    } else if (typeof elementName === 'object') {
      throw new Error('Object cannot be rendered as JSX node.!');
    } else {
      node = new RenderNode('text', elementName);
    }

    if (parent) {
      parent.appendChild(node);
    }

    if (!children) {
      children = [];
    }

    children.forEach((child) => {
      if (!node) {
        return;
      }

      if (Array.isArray(child)) {
        if (!checkKeysInJsxArray(child)) {
          throw new Error(`Dynamically mapped nodes in loop have to have unique keys specified in "key" prop.`);
        }

        child.forEach(child => {
          RenderNode.fromJSX(child, node);
        });
      } else {
        RenderNode.fromJSX(child, node);
      }
    });

    return node;
  }
}

/**
 * Creates a render tree from root node.
 *
 * @param {RenderResult} jsx
 */
export function createRenderTree(jsx) {
  const rootNode = new RenderNode('root', '');
  const childNode = RenderNode.fromJSX(jsx);

  if (childNode) {
    rootNode.appendChild(childNode);
  }

  return rootNode;
}

/**
 *
 * @param {RenderNode} currentNode
 * @param {RenderNode} newNode
 */
export function reconcile(currentNode, newNode) {
  if (currentNode && currentNode.tag !== newNode.tag) {
    currentNode.effect = 'Deletion';
    mountRenderSubtree(newNode);
    return;
  }

  if (!currentNode) {
    mountRenderSubtree(newNode);
    return;
  } else if (newNode.type !== 'root') {
    copyData(currentNode, newNode);

    if (shouldUpdateNode(newNode)) {
      updateRenderNodes(newNode);
    } else {
      reuseNode(currentNode, newNode);
    }
  }

  const processedChildren = [];
  newNode.children.forEach((child, index) => {
    const newNodeChild = newNode.children[index];
    const matchingNode = findMatchingNode(currentNode, newNodeChild, index);

    reconcile(matchingNode, newNodeChild);
    processedChildren.push(matchingNode);
  })

  currentNode.children.forEach((child) => {
    if (!processedChildren.includes(child)) {
      child.effect = 'Deletion';
    }
  });
}

/**
* Traverse all nodes and resolve what changes needs to be processed.
*
* @param {RenderNode} node
* @param {number} position
* @returns {RenderChange[]}
*/
export function resolveRenderChanges(node, position = 0) {
  /** @type {RenderChange[]} */
  let changes = [];

  if (!node) {
    return changes;
  }

  if (node.effect !== '') {
    const change = {
      effect: node.effect,
      parent: node.parent,
      nodeRef: node,
      position: position,
      elementRef: null
    };

    changes.push(change);
    node.effect = '';
  }

  node.children.forEach((child, index) => {
    changes = [
      ...changes,
      ...resolveRenderChanges(child, index),
    ];
  });

  return changes;
}

/**
 *
 * @param {RenderNode} node
 * @param {string} selector
 */
export function findClosestNode(node, selector) {
  if (!selector) {
    throw new Error('A selector can\'t be empty string');
  }

  let currentNode = node;

  while (currentNode?.parent) {
    const parentProps = currentNode.parent.pendingProps ?? {};

    if (currentNode.parent.type !== 'element') {
      currentNode = currentNode.parent;
      continue;
    }

    if (selector.startsWith('#') && parentProps.id === selector.substring(1)) {
      return  currentNode.parent;
    } else if (selector.startsWith('.') && parentProps.class === selector.substring(1)) {
      return currentNode.parent;
    } else if (/[[a-zA-Z0-9\-_]*(?:="[a-zA-Z0-9\-_]*")?]/.test(selector)) {
      const value = selector.replace('[', '').replace(']', '');

      if (currentNode.parent.pendingProps[value]) {
        return currentNode.parent;
      }
    } else if (currentNode.parent.tag === selector) {
      return currentNode.parent;
    }

    currentNode = currentNode.parent;
  }

  return null;
}

/**
 *
 * @param {RenderNode} node
 */
export function unmountRenderNode(node) {
  node.children.forEach((child) => {
    unmountRenderNode(child);
  });

  if (node.elementRef) {
    node.cleanListeners();
    node.elementRef.parentNode.removeChild(node.elementRef);
  }

  if (node.type === 'component') {
    node.instance.destroyed();
  }
}

/**
 *
 * @param {RenderNode} node
 */
export function cleanNodes(node) {
  node.effect = '';
  node.stateChanged = false;

  if (!compareProps(node.oldProps, node.pendingProps)) {
    node.oldProps = node.pendingProps;
  }

  node.children.forEach((child) => {
    cleanNodes(child);
  });
}

/**
 *
 * @param {RenderNode} node
 * @param {Component} component
 */
export function findNodeByComponent(node, component) {
  let foundNode = null;

  if (node.instance === component) {
    return node;
  }

  node.children.forEach((child) => {
    foundNode = findNodeByComponent(child, component);
  });

  return foundNode;
}

export function resolveLastMountedNode() {
  return lastMountedNode;
}