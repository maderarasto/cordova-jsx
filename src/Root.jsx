import {Component} from "@/app";
import Header from "@/Header";
import img from '@public/img/logo.png';

export default class Root extends Component {
  constructor() {
    super();
    console.log(img);
  }

  handleClick() {
    console.log("clicked");
  }

  render() {
    return (
      <div style={{ fontSize: '1rem', color: 'black' }}>
        <div id="top-header" class={['class-1', 'class-2']}>
          <Header />
          <nav>Navigation</nav>
        </div>
        <ul>
          <li>HTML</li>
          <li>CSS</li>
          <li>JS</li>
          <li>REact</li>
        </ul>
        <img src={img} alt="" />
        <button onclick={this.handleClick.bind(this)}>Click</button>
      </div>
    )
  }
}