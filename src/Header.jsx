import {Component} from "@/app";

export default class Header extends Component {
  render() {
    return (
      <h1 className="title">Hlavicka {this.props.num}</h1>
    )
  }
}