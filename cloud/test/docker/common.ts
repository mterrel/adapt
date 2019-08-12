import execa from "execa";
import { uniq } from "lodash";
import should from "should";
import { adaptDockerDeployIDKey, NameTagString } from "../../src/docker";
import { dockerInspect, dockerPull, dockerRemoveImage } from "../../src/docker/cli";

export async function deleteAllContainers(deployID: string) {
    try {
        const ctrList = await execa.stdout("docker", ["ps", "-a", "-q",
            "--filter", `label=${adaptDockerDeployIDKey}=${deployID}`]);
        if (!ctrList) return;
        const ctrs = ctrList.split(/\s+/);
        if (ctrs.length > 0) await execa("docker", ["rm", "-f", ...ctrs]);
    } catch (err) {
        // tslint:disable-next-line: no-console
        console.log(`Error deleting containers (ignored):`, err);
    }
}

export async function deleteAllImages(deployID: string) {
    try {
        const imgList = await execa.stdout("docker", ["image", "ls", "-q",
            "--filter", `label=${adaptDockerDeployIDKey}=${deployID}`]);
        if (!imgList) return;
        const imgs = uniq(imgList.split(/\s+/m));
        if (imgs.length > 0) await execa("docker", ["rmi", "-f", ...imgs]);
    } catch (err) {
        // tslint:disable-next-line: no-console
        console.log(`Error deleting images (ignored):`, err);
    }
}

export async function checkRegistryImage(registryTag: NameTagString) {
    // Remove the tag locally and ensure it's gone
    await dockerRemoveImage({ nameOrId: registryTag });
    let regTagInfo = await dockerInspect([registryTag]);
    should(regTagInfo).be.Array().of.length(0);

    // Now pull the tag and verify it's back
    await dockerPull({ imageName: registryTag });
    regTagInfo = await dockerInspect([registryTag]);
    should(regTagInfo).be.Array().of.length(1);
}
