import {Component} from "@/app";
import Header from "@/Header";
import img from '@public/img/logo.png';

const listItems = [
  { id: 1, name: 'HTML' },
  { id: 2, name: 'CSS' },
  { id: 3, name: 'Javascript' },
  { id: 4, name: 'Node.js' },
];

export default class Root extends Component {
  constructor(props) {
    super(props);

    this.state = {
      id: 1,
    };

    this.handleClick = this.handleClick.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  mounted() {
    // setTimeout(() => {
    //   this.setState({
    //     id: 10,
    //   });
    // }, 5000)
  }

  handleClick() {
    this.setState({
      id: this.state.id + 1,
    });
  }

  handleSubmit(ev) {
    ev.preventDefault();
    console.log(ev);
  }

  handleTextChange(ev) {
    console.log(ev);
  }

  render() {
    return (
      <div style={{ fontSize: '1rem', color: this.state.id % 2 === 0 ? 'red' : 'black' }}>
        <div id="top-header" class={`class-1 class-2`}>
          <Header num={this.state.id}>
            <h2>Hello Cordova</h2>
          </Header>
          <nav>Navigation</nav>
        </div>
        <p>State: {this.state.id}</p>
        <ul>
          {listItems.map((item, i) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
        <form onsubmit={this.handleSubmit}>
          <input type="text" onInput={this.handleTextChange} />
          <input type="submit" />
        </form>
        <img src={img} alt="" />
        <button onclick={this.handleClick}>Click</button>
      </div>
    )
  }
}