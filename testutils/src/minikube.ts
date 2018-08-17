import * as uutils from "@usys/utils";
import Docker = require("dockerode");
import * as fs from "fs";
import * as jsYaml from "js-yaml";
import * as ld from "lodash";
import * as sb from "stream-buffers";
import * as util from "util";

// tslint:disable-next-line:no-var-requires
const stripAnsi = require("strip-ansi");

export interface MinikubeInfo {
    docker: Docker;
    container: Docker.Container;
    network: Docker.Network;
    kubeconfig: object;
    stop: () => Promise<void>;
}

async function dockerExec(container: Docker.Container, command: string[]): Promise<string> {
    const exec = await container.exec({
        AttachStdin: false,
        AttachStdout: true,
        AttachStderr: false,
        Cmd: command
    });

    const info = await exec.start();
    const buf = new sb.WritableStreamBuffer();
    const errBuf = new sb.WritableStreamBuffer();
    info.modem.demuxStream(info.output, buf, errBuf);
    return new Promise<string>((res, rej) => {
        info.output.on("end", async () => {
            const inspectInfo = await exec.inspect();
            if (inspectInfo.Running !== false) {
                rej(new Error(`dockerExec: ${util.inspect(command)} stream ended with process still running?!`));
                return;
            }
            if (inspectInfo.ExitCode !== 0) {
                // tslint:disable-next-line:max-line-length
                const msg = `dockerExec: ${util.inspect(command)} process exited with error (code: ${inspectInfo.ExitCode})`;
                rej(new Error(msg));
                return;
            }
            res(buf.getContentsAsString());
        });
    });
}

async function getKubeconfig(_docker: Docker, container: Docker.Container): Promise<object> {
    const configYAML = await dockerExec(container, ["cat", "/kubeconfig"]);

    const kubeconfig = jsYaml.safeLoad(configYAML);
    for (const cluster of kubeconfig.clusters) {
        const server = (cluster.cluster.server as string);
        cluster.cluster.server = server.replace("localhost", "kubernetes");
        cluster.cluster.server = server.replace("127.0.0.1", "kubernetes");
    }

    return kubeconfig;
}

async function getSelfContainer(docker: Docker): Promise<Docker.Container> {
    const entries = fs.readFileSync("/proc/self/cgroup").toString().split(/\r?\n/);
    if (entries.length === 0) throw new Error("Cannot get own container id!");
    const entry = entries[0];
    const [, , path] = entry.split(":");
    const psplit = path.split("/");
    const id = ld.last(psplit);
    if (id === undefined) throw new Error("Cannot get own container id!");
    return docker.getContainer(id);
}

async function runMinikubeContainer(
    docker: Docker,
    containerName: string,
    networkName: string) {

    const opts: Docker.ContainerCreateOptions = {
        name: containerName,
        AttachStdin: false,
        AttachStdout: false,
        AttachStderr: false,
        Tty: false,
        OpenStdin: false,
        StdinOnce: false,
        HostConfig: {
            AutoRemove: true,
            NetworkMode: networkName,
            Privileged: true
        },
        NetworkingConfig: {
            EndpointsConfig: {
                [networkName]: {
                    Aliases: ["kubernetes"]
                }
            }
        },
        Env: [],
        Image: "quay.io/aspenmesh/minikube-dind",
        Volumes: {},
    };

    const container = await docker.createContainer(opts);
    return container.start();
}

async function getNetwork(docker: Docker, container: Docker.Container) {
    const info = await container.inspect();
    const networkName = Object.keys(info.NetworkSettings.Networks)[0];
    return docker.getNetwork(networkName);
}

async function createNetwork(docker: Docker, name: string): Promise<Docker.Network> {
    return docker.createNetwork({ Name: name });
}

async function addToNetwork(container: Docker.Container, network: Docker.Network) {
    await network.connect({ Container: container.id });
}

async function removeFromNetwork(container: Docker.Container, network: Docker.Network) {
    await network.disconnect({ Container: container.id });
}

async function waitFor(
    iterations: number,
    pollSec: number,
    timeoutMsg: string,
    action: () => Promise<boolean>): Promise<void> {

    for (let i = 0; i < iterations; i++) {
        if (await action()) return;
        await uutils.sleep(pollSec * 1000);
    }
    throw new Error(timeoutMsg);
}

async function waitForKubeConfig(docker: Docker, container: Docker.Container): Promise<object | undefined> {
    let config: object | undefined;
    await waitFor(20, 5, "Timed out waiting for kubeconfig", async () => {
        try {
            config = await getKubeconfig(docker, container);
            return true;
        } catch (err) {
            if (! /exited with error/.test(err.message)) throw err;
            return false;
        }
    });
    return config;
}

async function waitForMiniKube(container: Docker.Container) {
    await waitFor(20, 5, "Timed out waiting for Minikube", async () => {
        try {
            const statusColor = await dockerExec(container, ["kubectl", "cluster-info"]);
            const status = stripAnsi(statusColor) as string;
            if (/^Kubernetes master is running at/.test(status)) {
                return true;
            }
        } catch (err) {
            if (! /exited with error/.test(err.message)) throw err;
        }
        return false;
    });
}

function secondsSince(start: number): number {
    return (Date.now() - start) / 1000;
}

export async function startTestMinikube(): Promise<MinikubeInfo> {
    const stops: (() => Promise<void>)[] = [];
    async function stop() {
        for (const f of stops) {
            await f();
        }
    }

    const startTime = Date.now();
    let kubeconfig: object | undefined;

    try {
        const docker = new Docker({ socketPath: "/var/run/docker.sock" });
        const self = await getSelfContainer(docker);
        let container: Docker.Container;
        let network: Docker.Network;

        if (process.env.ADAPT_TEST_MINIKUBE) {
            container = docker.getContainer(process.env.ADAPT_TEST_MINIKUBE);
            network = await getNetwork(docker, container);
            kubeconfig = await getKubeconfig(docker, container);
        } else {
            // tslint:disable-next-line:no-console
            console.log(`    Starting Minikube`);
            const newContainerName = `test_minikube_${self.id}_${process.pid}`;
            network = await createNetwork(docker, newContainerName);
            stops.unshift(async () => network.remove());
            if (network.id === undefined) throw new Error("Network id was undefined!");
            container = await runMinikubeContainer(docker, newContainerName, network.id);
            stops.unshift(async () => container.stop());

            kubeconfig = await waitForKubeConfig(docker, container);
            const configTime = secondsSince(startTime);
            // tslint:disable-next-line:no-console
            console.log(`    Got kubeconfig (${configTime} seconds)`);
        }

        if (!kubeconfig) throw new Error("Internal Error: should be unreachable");

        await waitForMiniKube(container);
        const totalTime = secondsSince(startTime);
        // tslint:disable-next-line:no-console
        console.log(`\n    Minikube ready in ${totalTime} seconds`);

        await addToNetwork(self, network);

        stops.unshift(async () => removeFromNetwork(self, network));

        return { docker, container, network, kubeconfig, stop };
    } catch (e) {
        await stop();
        throw e;
    }
}

export async function stopTestMinikube(info: MinikubeInfo): Promise<void> {
    await info.stop();
}