import {Component} from "@/app";

export default class Header extends Component {
  mounted() {
    console.log("Header mounted.");
  }

  updated() {
    console.log("Header updated.");
  }

  render() {
    return (
      <h1 className="title">Hlavicka {this.props.num}</h1>
    )
  }
}