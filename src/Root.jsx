import {Component} from "@/app";
import Header from "@/Header";

export default class Root extends Component {
  render() {
    return (
      <div>
        <div>
          <Header />
          <nav>Navigation</nav>
        </div>
        <ul>
          <li>HTML</li>
          <li>CSS</li>
          <li>JS</li>
          <li>REact</li>
        </ul>
      </div>
    )
  }
}