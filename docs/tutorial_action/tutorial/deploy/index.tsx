import Adapt from "@adpt/core";
import { LocalFile } from "./LocalFile";

function App() {
    return <LocalFile path="hello.txt" contents="Hello world!\n" />;
    //return null;
}

Adapt.stack("default", <App />);

