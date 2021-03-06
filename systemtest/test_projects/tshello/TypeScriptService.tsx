import { DockerImageInstance } from "@adpt/cloud/docker";
import { K8sContainer, Pod, Service } from "@adpt/cloud/k8s";
import { LocalNodeImage } from "@adpt/cloud/nodejs";
import Adapt, { Group, handle, useMethod } from "@adpt/core";

function kubeClusterInfo() {
    // tslint:disable-next-line:no-var-requires
    return { kubeconfig: require("./kubeconfig.json") };
}

export default function TypeScriptService(props: { srcDir: string, port: number, targetPort: number }) {
    const podHandle = handle();

    const img = handle<DockerImageInstance>();
    const imageInfo = useMethod(img, "latestImage");

    return <Group>
        <LocalNodeImage
            handle={img}
            srcDir={props.srcDir}
            options={{ runNpmScripts: "build", packageManager: "yarn" }}
        />
        <Service
            config={kubeClusterInfo()}
            type="LoadBalancer"
            selector={podHandle}
            ports={[{ port: props.port, targetPort: props.targetPort }]}
        />
        {imageInfo ?
            <Pod handle={podHandle} config={kubeClusterInfo()} terminationGracePeriodSeconds={0}>
                <K8sContainer
                    name="typescript-service"
                    image={imageInfo.nameTag!}
                    ports={[{
                        containerPort: props.targetPort,
                        hostPort: props.targetPort
                    }]}
                    imagePullPolicy="Never"
                />
            </Pod>
            : null}
    </Group>;
}
