import htmlTags from "html-tags";
import svgTags from 'svg-tags';
import { v4 as uuid} from 'uuid';

/** @type {CordovaApp} */
let app = null;

export class Component {
  /**
   * Creates an instance of component.
   *
   * @param {Record<string, any>} props
   */
  constructor(props) {
    this.props = props;
    this.state = {};
    this.hash = uuid();
  }

  setState(state) {
    this.state = state;
    $app.onStateChanged(this);
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

    /** @type {Record<string, any>} */
    this.oldProps = {};
    /** @type {Record<string, any>} */
    this.pendingProps = otherProps;

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
 * @param {RenderNode} node
 */
function mountRenderSubtree(node) {
  node.effect = 'Placement';

  if (node.type === 'component') {
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

    resolveNodeChanges(matchingNode, newNodeChild);
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
function resolveRenderChanges(node, position = 0) {
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
 */
function unmountRenderNode(node) {
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
function cleanNodes(node) {
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
 * @param {RenderNode} renderNode
 */
function findClosestDOMNode(renderNode) {
  let currentNode = renderNode;

  while (currentNode && currentNode.parent) {
    if (currentNode.parent.elementRef) {
      return currentNode.parent.elementRef;
    }

    currentNode = currentNode.parent;
  }

  return null;
}

function resolveClassName(value) {
  if (typeof value !== 'object') {
    return value.toString();
  }

  let classTokens = !Array.isArray(value) ? Object.keys(value).filter((className) => {
    return value[className];
  }) : value;

  classTokens = classTokens.filter((className, index, tokens) => {
    return tokens.indexOf(className) === index;
  });

  return classTokens.join(' ');
}

function resolveStyle(value) {
  if (Array.isArray(value)) {
    throw new Error('Style cannot be use as array!');
  }

  if (typeof value !== 'object') {
    return value.toString();
  }

  return Object.entries(value).map(([key, value]) => {
    if (/^[a-z]*[A-Z]/.test(key)) {
      const keyTokens = key.split(/(?=[A-Z])/).map((token) => {
        return token.toLowerCase();
      });

      key = keyTokens.join('-');
    }

    return `${key}: ${value}`;
  }).join('; ');
}


/**
 *
 * @param {RenderNode} node
 */
function resolveElementAttributes(node) {
  for (let [key, value] of Object.entries(node.pendingProps)) {
    if (key.startsWith('on')) {
      node.addListener(key.substring(2).toLowerCase(), value);
      continue;
    }

    if (key === 'class') {
      value = resolveClassName(value);
    } else if (key === 'style') {
      value = resolveStyle(value);
    }
    if (node.elementRef.tagName.toLowerCase() === 'svg') {
      node.elementRef.setAttribute(key, value);
    } else {
      node.elementRef.setAttribute(key, value);
    }
  }
}

/**
 *
 * @param {RenderNode} node
 * @param {string} selector
 */
function findClosestNode(node, selector) {
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
 * @param {RenderNode} renderNode
 * @param {number} index
 */
function createElement(renderNode, index) {
  if (renderNode.type === 'text') {
    renderNode.elementRef = document.createTextNode(renderNode.tag);
  } else if (renderNode.type === 'element') {
    const closestWithNS = findClosestNode(renderNode, '[xmlns]');
    const xmlns = renderNode.pendingProps.xmlns ?? closestWithNS?.pendingProps.xmlns ?? '';

    if (xmlns) {
      renderNode.elementRef = document.createElementNS(xmlns, renderNode.tag);
    } else {
      renderNode.elementRef = document.createElement(renderNode.tag);
    }

    resolveElementAttributes(renderNode);
  }

  const parentEl = findClosestDOMNode(renderNode);
  const childAt = parentEl.children[index];

  parentEl.insertBefore(renderNode.elementRef, childAt);
}

/**
 *
 * @param {Record<string, any>} oldProps
 * @param {Record<string, any>} pendingProps
 * @returns {PropDiff[]}
 */
function diffProps(oldProps, pendingProps) {
  /** @type {PropDiff[]} */
  const propDiffs = [];

  for (const [key, value] of Object.entries(pendingProps)) {
    if (oldProps[key] === undefined || oldProps[key] === null) {
      propDiffs.push({ type: 'Add', name: key, value });
    } else if (value !== oldProps[key]) {
      propDiffs.push({ type: 'Update', name: key, value, });
    }
  }

  for (const [key, value] of Object.entries(oldProps)) {
    if (pendingProps[key] === undefined || pendingProps[key] === null) {
      propDiffs.push({ type: 'Remove', name: key, value });
    }
  }

  return propDiffs;
}

/**
 *
 * @param {RenderNode} renderNode
 * @param {string} propName
 * @param {any} propValue
 */
function handleRemovingProps(renderNode, propName, propValue) {
  if (propName.startsWith('on')) {
    renderNode.removeListener(propName.substring(2).toLowerCase(), propValue);
  } else {
    renderNode.elementRef.removeAttribute(propName);
  }
}

/**
 *
 * @param {RenderNode} renderNode
 * @param {string} propName
 * @param {any} propValue
 */
function handleUpdatingProps(renderNode, propName, propValue) {
  if (propName.startsWith('on')) {
    const eventName = propName.substring(2).toLowerCase();
    renderNode.removeListener(eventName, renderNode.oldProps[eventName]);
    renderNode.addListener(eventName, propValue);
  } else if (propName === 'class') {
    propValue = resolveClassName(propValue);
  } else if (propName === 'style') {
    propValue = resolveStyle(propValue);
  }

  if (!propName.startsWith('on')) {
    renderNode.elementRef.setAttribute(propName, propValue);
  }
}

/**
 *
 * @param {RenderNode} renderNode
 * @param {string} propName
 * @param {any} propValue
 */
function handleAddingProps(renderNode, propName, propValue) {
  if (propName.startsWith('on')) {
    renderNode.addListener(propName.substring(2).toLowerCase(), propValue);
    return;
  }

  if (propName === 'class') {
    propValue = resolveClassName(propValue);
  } else if (propName === 'style') {
    propValue = resolveStyle(propValue);
  }

  renderNode.elementRef.setAttribute(propName, propValue);
}

/**
 *
 * @param {RenderNode} renderNode
 */
function updateElement(renderNode) {
  const diffedProps = diffProps(renderNode.oldProps, renderNode.pendingProps);

  if (!renderNode.elementRef) {
    console.log(renderNode);
  }

  diffedProps.forEach((prop) => {
    if (prop.type === 'Remove' ) {
      handleRemovingProps(renderNode, prop.name, prop.value);
    } else if (prop.type === 'Add' ) {
      handleAddingProps(renderNode, prop.name, prop.value);
    } else if (prop.type === 'Update' ) {
      handleUpdatingProps(renderNode, prop.name, prop.value);
    }
  });
}

/**
 *
 * @param {RenderChange && { nodeRef: RenderNode }} change
 * @param {RenderNode[]} componentNodes
 */
function handlePlacement(change, componentNodes) {
  if (change.nodeRef.type === 'component') {
    componentNodes.unshift(change.nodeRef);
  }

  if (['element', 'text'].includes(change.nodeRef.type)) {
    createElement(change.nodeRef, change.position);
  }

  processComponentNodes(componentNodes, 'mount');
}

/**
 *
 * @param {RenderChange && { nodeRef: RenderNode }} change
 * @param {RenderNode[]} componentNodes
 */
function handleUpdate(change, componentNodes) {
  change.nodeRef.pendingUpdate = false;

  if (change.nodeRef.type === 'component') {
    componentNodes.unshift(change.nodeRef);
  }

  if (['element'].includes(change.nodeRef.type)) {
    updateElement(change.nodeRef);
  }

  processComponentNodes(componentNodes, 'update');
}

/**
 *
 * @param {RenderNode[]} nodes
 * @param {'mount'|'update'}action
 */
function processComponentNodes(nodes, action = 'mount') {
  if (!['mount', 'update'].includes(action)) {
    action = 'mount';
  }

  while (nodes.length > 0) {
    if (action === 'mount' && !nodes[0].allChildrenMounted()) {
      break;
    } else if (action === 'update' && !nodes[0].allChildrenUpdated()) {
      break;
    }

    if (action === 'mount') {
      nodes[0].mounted = true;
      nodes[0].instance.mounted();
    } else if (action === 'update') {
      nodes[0].instance.updated();
    }

    nodes.shift();
  }
}

/**
 *
 * @param {RenderNode} node
 * @param {Component} component
 */
function findNodeByComponent(node, component) {
  let foundNode = null;

  if (node.instance === component) {
    return node;
  }

  node.children.forEach((child) => {
    foundNode = findNodeByComponent(child, component);
  });

  return foundNode;
}

export class CordovaApp {
  constructor() {
    /** @type {HTMLElement} */
    this._rootEl = null;
    /** @type {RenderCallback} */
    this._rootFunc = null;
    /** @type {RenderNode} */
    this._rootRenderNode = null;
    /** @type {RenderNode[]} */
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
    this._rootRenderNode.elementRef = this._rootEl;

    /** @type RenderNode[] */
    const mountComponentNodes = [];
    /** @type RenderNode[] */
    const updateComponentNodes = [];

    newChanges.forEach(change => {
      if (change.effect === 'Placement') {
        handlePlacement(change, mountComponentNodes)
      } else if (change.effect === 'Update') {
        handleUpdate(change, updateComponentNodes)
      }
    });

    cleanNodes(this._rootRenderNode);
  }

  /**
   *
   * @param {Component} component
   */
  onStateChanged(component) {
    const foundNode = findNodeByComponent(this._rootRenderNode, component);

    if (!foundNode) {
      console.warn('Skipping render. A render node not found for component: ' + component.constructor.name);
      return;
    }

    // Request to re-render application.
    foundNode.stateChanged = true;
    this.render();
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