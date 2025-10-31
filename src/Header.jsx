import {Component} from "@/app";

export default class Header extends Component {
  async mounted() {
    await new Promise(resolve => setTimeout(resolve, 5000));
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