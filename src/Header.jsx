import {Component} from "@/app";

export default class Header extends Component {
  mounted() {
    console.log("Header mounted.");
  }

  updated() {
    console.log("Header updated.");
  }

  render() {
    console.log(this.props.children);
    return (
      <div>
        <h1>Title</h1>
        {this.props.children}
      </div>
    )
  }
}