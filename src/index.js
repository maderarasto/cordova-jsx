import App from "@/App";
import {createApp} from "@/cordova-jsx/app";

createApp({
  mountEl: '#app',
  render() {
    return <App />
  }
});