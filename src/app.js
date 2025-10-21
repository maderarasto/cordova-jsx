import htmlTags from "html-tags";

export class Component {
  /**
   * Creates an instance of component.
   *
   * @param props
   */
  constructor(props) {
    this.props = props;
    this.state = {};
  }

  setState(state) {
    this.state = state;
    // TODO: request re-render
  }

  /**
   * Renders component as JSX structure.
   *
   * @returns {RenderResult}
   */
  render() {
    return '';
  }

  /**
   * A hook is triggered when component is mounted into DOM.
   */
  mounted() {}

  /**
   * a hook is triggered when application is resumed into component.
   */
  resumed() {}

  /**
   * A hook is triggered when component is re-rendered.
   */
  updated() {}

  /**
   * A hook is triggered before component is destroyed.
   */
  destroyed() {}
}

class RenderNode {
  /**
   * Creates an instance fo renderable node.
   *
   * @param {RenderNodeType} type
   * @param {RenderNodeTag} tag
   * @param {RenderNodeProps} props
   */
  constructor(type, tag, props = {}) {
    const { key, ...otherProps } = props ?? {};

    /** @type {string} **/
    this.key = key;
    this.type = type;
    this.tag = tag;
    this.props = otherProps;
    /** @type {RenderNodeEffect} */
    this.effect = '';

    /** @type {RenderNode[]} */
    this.children = [];
    /** @type {RenderNode} */
    this.parent = null;
    /** @type {Component} */
    this.instance = null;
    /** @type {Node} */
    this.elementRef = null;
  }

  /**
   * Checks if node is a root node in tree.
   *
   * @returns {boolean}
   */
  isRoot() {
    return this._type === 'root';
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
      node = new RenderNode('component', elementName);
    } else if ([...htmlTags].includes(elementName)) {
      node = new RenderNode('element', elementName, attributes);
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

      RenderNode.fromJSX(child, node);
    });

    return node;
  }
}

/**
 * Creates a render tree from root node.
 *
 * @param {RenderResult} jsx
 */
function createRenderTree(jsx) {
  const rootNode = new RenderNode('root', '');
  const childNode = RenderNode.fromJSX(jsx);

  if (childNode) {
    rootNode.appendChild(childNode);
  }

  return rootNode;
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
  if (!currentNode || currentNode.children.length <= position) {
    return null;
  }

  let foundNode = currentNode.children[position];

  if (!foundNode || foundNode.tag !== searchedNode.tag) {
    return null;
  }

  return foundNode;
}

/**
 *
 * @param {RenderNode} node
 */
function mountRenderSubtree(node) {
  node.effect = 'Placement';

  if (node.type === 'component') {
    node.instance = new node.tag();

    const jsx = node.instance.render();
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
 * @param {RenderNode} currentNode
 * @param {RenderNode} newNode
 */
function resolveNodeChanges(currentNode, newNode) {
  if (currentNode && currentNode.tag !== newNode.tag) {
    currentNode.effect = 'Deletion';
    mountRenderSubtree(newNode);
    return;
  }

  if (!currentNode) {
    mountRenderSubtree(newNode);
    return;
  } else {
    // remember state from realNode
    newNode.effect = 'Update';
  }

  let position = 0;

  while (position < newNode.children.length) {
    const newNodeChild = newNode.children[position];
    const matchingNode = findMatchingNode(currentNode, newNodeChild, position);

    resolveNodeChanges(matchingNode, newNodeChild);
    position++;
  }

  while (position < currentNode.children.length) {
    currentNode.children[position].effect = 'Deletion';
    position++;
  }
}

/**
 * Traverse all nodes and resolve what changes needs to be processed.
 *
 * @param {RenderNode} node
 * @param {number} position
 * @returns {RenderChange[]}
 */
function resolveRenderChanges(node, position = 0) {
  /** @type {RenderChange[]} */
  let changes = [];

  if (!node) {
    return changes;
  }

  if (!node.isRoot() && node.effect !== '') {
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
 */
function unmountRenderNode(node) {
  node.children.forEach((child) => {
    unmountRenderNode(child);
  });

  if (node.elementRef) {
    node.elementRef.parentNode.removeChild(node.elementRef);
  }

  if (node.type === 'component') {
    node.instance.destroyed();
  }
}

export class CordovaApp {
  constructor() {
    /** @type {HTMLElement} */
    this._rootEl = null;
    /** @type {RenderCallback} */
    this._rootFunc = null;
    /** @type {RenderNode} */
    this._rootRenderNode = null;
  }

  /**
   * Set function component.
   *
   * @param {RenderCallback} rootFunc
   */
  setRootFunction(rootFunc) {
    this._rootFunc = rootFunc;
  }

  /**
   * Mount app to DOM element.
   *
   * @param {HTMLElement|string} mountEl
   */
  mount(mountEl) {
    if (typeof mountEl === 'string') {
      this._rootEl = document.querySelector(mountEl)
    } else {
      this._rootEl = mountEl;
    }

    if (!(this._rootEl instanceof HTMLElement)) {
      throw new Error('Could not find a root element');
    }

    this.render();
  }

  render() {
    if (!this._rootEl) {
      throw new Error('Could not find a root element');
    }

    const newJSX = this._rootFunc();
    const newTree = createRenderTree(newJSX);

    resolveNodeChanges(this._rootRenderNode, newTree);

    const deletions = resolveRenderChanges(this._rootRenderNode);
    const newChanges = resolveRenderChanges(newTree);

    deletions.forEach((change) => {
      if (change.effect === 'Deletion') {
        unmountRenderNode(change.nodeRef)
      }
    });

    this._rootRenderNode = newTree;
  }
}

/**
 * Create app and stored in global variable.
 *
 * @param {AppConfig} config
 */
export function createApp(config) {
  if (typeof config !== 'object' || !config) {
    throw new Error('Missing necessary options defined in given config.')
  }

  window.$app = new CordovaApp();
  window.$app.setRootFunction(config.render);

  document.addEventListener('deviceready', () => {
    $app.mount(config.mountEl);
  });
}