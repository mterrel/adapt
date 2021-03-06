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

import { ExecutedQuery, gql, ObserverResponse } from "@adpt/core";
import { execute } from "graphql";
import * as ld from "lodash";
import should from "should";
import { K8sObserver } from "../../src/k8s/k8s_observer";
import { mkInstance } from "../run_minikube";

interface PodType {
    metadata?: {
        name?: string;
    };
}
function checkPods(items?: (PodType | undefined)[]) {
    if (items === undefined) return should(items).not.Undefined();
    if (!ld.isArray(items)) return should(items).Array();

    for (const item of items) {
        if (item === undefined) return should(item).not.Undefined();
        const meta = item.metadata;
        if (meta === undefined) return should(meta).not.Undefined();
        const name = meta.name;
        if (name === undefined) return should(name).not.Undefined();
        const re = /(^(?:kube-dns)|(?:kube-addon-manager)|(?:storage-provisioner)|(?:coredns))-[a-z\-0-9]+$/;
        return should(name).match(re);
    }
    should(items.length).equal(3);
}

function checkObservations(observations: ObserverResponse) {
    should(observations).not.Undefined();
    should(observations).not.Null();

    const context = observations.context;
    should(context).not.Undefined();
    should(Object.keys(context)).length(1);
    const pods = context[Object.keys(context)[0]];
    should(pods).not.Undefined();
    should(pods.kind).equal("PodList");
    should(pods.apiVersion).equal("v1");
    should(pods.metadata).not.Undefined();

    checkPods(pods.items);
}

describe("k8s observer tests", () => {
    let observer: K8sObserver;
    let queries: ExecutedQuery[];
    let kubeconfig: object;

    before("Construct schema", async function () {
        this.timeout(mkInstance.setupTimeoutMs);
        this.slow(17 * 1000);
        observer = new K8sObserver();
        observer.schema; //Force slow construction of schema once for whole suite
        kubeconfig = await mkInstance.kubeconfig;
    });

    before(() => {
        queries = [
            {
                query: gql`query ($kubeconfig: JSON!) {
                    withKubeconfig(kubeconfig: $kubeconfig) {
                        listCoreV1NamespacedPod(namespace: "kube-system") {
                            kind
                            items { metadata { name } }
                        }
                    }
                }`,
                variables: { kubeconfig }
            },
            {
                query: gql`query ($kubeconfig: JSON!) {
                    withKubeconfig(kubeconfig: $kubeconfig) {
                        listCoreV1NamespacedPod(namespace: "kube-system") {
                            kind,
                            apiVersion,
                            items { metadata { name } }
                        }
                    }
                }`,
                variables: { kubeconfig }
            }
        ];
    });

    beforeEach("Instantiate observer", function () {
        this.slow(500);
        this.timeout(2 * 1000);
        observer = new K8sObserver();
    });

    it("should observe running system pods", async function () {
        this.slow(500);
        this.timeout(5000);

        const observations = await observer.observe(queries);
        checkObservations(observations);
    });

    it("should query running system pods", async function () {
        this.slow(500);
        this.timeout(5000);

        const schema = observer.schema;
        let result = await execute(
            schema,
            queries[0].query,
            undefined,
            undefined,
            queries[0].variables);
        if (result.errors === undefined) return should(result.errors).not.Undefined();
        should(result.errors).length(1);
        should(result.errors[0]!.message).match(/Adapt Observer Needs Data/);

        const observations = await observer.observe(queries);
        checkObservations(observations); //Tested above but makes debuggin easier

        result = await execute(
            schema,
            queries[0].query,
            observations.data,
            observations.context,
            queries[0].variables);
        should(result.errors).Undefined();

        const data = result.data;
        if (data == null) throw should(data).be.ok();
        if (data.withKubeconfig === undefined) return should(data.withKubeconfig).not.Undefined();

        const podList = data.withKubeconfig.listCoreV1NamespacedPod;
        if (podList === undefined) return should(podList).not.Undefined();

        should(podList.kind).equal("PodList");
        should(podList.apiVersion).Undefined();
        checkPods(podList.items);
    });

});
