import * as unbs from "../../src";
// tslint:disable-next-line:no-duplicate-imports
import { Component, Group } from "../../src";
import MongoContainer from "./MongoContainer";
import NodecellarContainer from "./NodecellarContainer";

export interface Props {
    webPort?: number;
    webStatusPort?: 8081;
    mongoHostname?: string;
    mongoPort?: number;
    dockerHost?: string;
}

export default class Nodecellar extends Component<Props> {
    static defaultProps = {
        webPort: 8080,
        webStatusPort: 8081,
        mongoHostname: "mongo",
        mongoPort: 27017,
        dockerHost: "unix:///var/run/docker.sock",
    };

    build() {
        const props = this.props;

        return (
            <Group>
                <MongoContainer
                    name={props.mongoHostname}
                    mongoPort={props.mongoPort}
                    webStatusPort={props.webStatusPort}
                    dockerHost={props.dockerHost!}
                />

                <NodecellarContainer
                    port={props.webPort!}
                    mongoHostname={props.mongoHostname!}
                    mongoPort={props.mongoPort!}
                    dockerHost={props.dockerHost!}
                />
            </Group>
        );
    }
}
