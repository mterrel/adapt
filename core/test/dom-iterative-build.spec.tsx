/*
 * Copyright 2018-2019 Unbounded Systems, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Adapt, {
    Component,
    Group,
    useState,
} from "../src";

import should = require("should");
import {
    deepFilterElemsToPublic,
    Empty
} from "./testlib";

interface GroupThenEmptyProps {
    id: number;
    witness: (state: GroupThenEmptyState) => void;
}
interface GroupThenEmptyState { didGroup: boolean; }

class GroupThenEmpty extends Component<GroupThenEmptyProps, GroupThenEmptyState> {
    initialState() {
        return { didGroup: false };
    }

    build() {
        this.props.witness(this.state);
        if (this.state.didGroup) {
            return <Empty key={this.props.key} id={this.props.id} />;
        } else {
            this.setState({ didGroup: true });
            return <Group key={this.props.key} />;
        }
    }
}

function Counter() {
    const [ count, setCount ] = useState(0);
    setCount(count + 1);
    return null;
}

describe("DOM Iterative Build Tests", () => {
    it("Should build empty primitive", async () => {
        const orig = <Adapt.Group key="root" />;
        const { contents: dom } = await Adapt.build(orig, null);

        const ref = deepFilterElemsToPublic(orig);

        should(dom).not.equal(orig);
        should(deepFilterElemsToPublic(dom)).eql(ref);
    });

    it("Should rebuild when state is updated", async () => {
        const id = 4;
        const states: GroupThenEmptyState[] = [];
        const orig = <GroupThenEmpty key="root" id={id} witness={(state) => states.push(state)} />;
        const { contents: dom } = await Adapt.build(orig, null);

        const ref = deepFilterElemsToPublic(<Empty key="root" id={id} />);
        should(states).eql([false, true].map((v) => ({ didGroup: v })));
        should(deepFilterElemsToPublic(dom)).eql(ref);
    });

    it("Should throw error for too many build passes", async () => {
        const result = await Adapt.build(<Counter />, null);
        should(result.buildErr).be.True();
        should(result.messages).have.length(1);
        should(result.messages[0].content)
            .match(/DOM build exceeded maximum number of build iterations/);
    });
});
