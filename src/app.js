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

    /** @type {RenderNode[]} */
    this.children = [];
    /** @type {RenderNode} */
    this.parent = null;
    /** @type {Component} */
    this.instance = this.type === 'component' ? new tag() : null;
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

    if (node._type === 'component') {
      RenderNode.fromJSX(node.instance.render(), node);
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

    const clonedTree = Object.assign({}, this._rootRenderNode);
    const newJSX = this._rootFunc();
    const newTree = createRenderTree(newJSX);
    const newTree2 = createRenderTree(newJSX);

    this._resolveNodeChanges(newTree, newTree2);
  }

  /**
   *
   * @param {RenderNode} realNode
   * @param {RenderNode} newNode
   * @private
   */
  _resolveNodeChanges(realNode, newNode) {
    if (realNode && realNode.tag !== newNode.tag) {
      // mark realNode for deletion
      // mount newNode as new
      return;
    }

    if (!realNode) {
      // mark newNode for placement
    } else {
      // remember state from realNode
      // mark newNode for update
    }

    let position = 0;

    while (position < newNode.children.length) {
      const realNodeChild = realNode.children[position];
      const newNodeChild = newNode.children[position];

      // find matching child node in real node
      // resolve node changes with match child node

      position++;
    }


    while (position < realNode.children.length) {
      // mark realNode for deletion
      position++;
    }
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