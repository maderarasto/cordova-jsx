export class CordovaApp {
  constructor() {
    /** @type {HTMLElement} */
    this._rootEl = null;
    /** @type {FunctionComponent} */
    this._rootFunc = null;
  }

  /**
   * Set function component.
   *
   * @param {FunctionComponent} rootFunc
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

    console.log('Hello');
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