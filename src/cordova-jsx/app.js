import { v4 as uuid} from 'uuid';
import {
  cleanNodes,
  createRenderTree,
  findNodeByComponent,
  reconcile, resolveLastMountedNode, resolveRenderChanges,
  unmountRenderNode
} from "@/cordova-jsx/reconciliation";
import {createElement, updateElement} from "@/cordova-jsx/dom";

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

    if (change.nodeRef.ref) {
      change.nodeRef.ref.current = change.nodeRef.elementRef;
    }
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

  /**
   *
   * @param {Record<string, any>} newState
   */
  setState(newState) {
    this.state = newState;
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
  async mounted() {}

  /**
   * a hook is triggered when application is resumed into component.
   */
  async resumed() {}

  /**
   * A hook is triggered when component is re-rendered.
   */
  async updated() {}

  /**
   * A hook is triggered before component is destroyed.
   */
  async destroyed() {}
}

export function createRef(value) {
  const lastMountedNode = resolveLastMountedNode();

  if (!lastMountedNode || lastMountedNode.type !== 'component') {
    throw new Error();
  }

  /** @type {RefObject} */
  const ref = {
    current: value,
  }

  lastMountedNode.refs.push(ref);
  return ref;
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
    const newRoot = createRenderTree(newJSX);

    reconcile(this._rootRenderNode, newRoot);

    const deletions = resolveRenderChanges(this._rootRenderNode);
    const newChanges = resolveRenderChanges(newRoot);

    deletions.forEach((change) => {
      if (change.effect === 'Deletion') {
        unmountRenderNode(change.nodeRef)
      }
    });

    this._rootRenderNode = newRoot;
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
    foundNode.state = component.state;
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