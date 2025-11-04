import {findClosestNode} from "@/cordova-jsx/reconciliation";

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
function handleRemovingProps(renderNode, propName, propValue) {
  if (propName.startsWith('on')) {
    renderNode.removeListener(propName.substring(2).toLowerCase(), propValue);
  } else {
    renderNode.elementRef.removeAttribute(propName);
  }
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
 * @param {number} index
 */
export function createElement(renderNode, index) {
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
 * @param {RenderNode} renderNode
 */
export function updateElement(renderNode) {
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