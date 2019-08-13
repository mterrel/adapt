import { InternalError, withTmpDir } from "@adpt/utils";
import db from "debug";
import execa, { ExecaError, ExecaReturns } from "execa";
import fs from "fs-extra";
import ld from "lodash";
import * as path from "path";
import randomstring from "randomstring";
import shellwords from "shellwords-ts";
import { Readable } from "stream";
import { ContainerStatus } from "../Container";
import {
    DockerBuildOptions,
    DockerContainerProps,
    DockerGlobalOptions,
    File,
    ImageIdString,
    ImageInfo,
    ImageNameString,
    NameTagString,
    RepoDigestString,
} from "./types";

const debug = db("adapt:cloud:docker");
// Enable with DEBUG=adapt:cloud:docker:out*
const debugOut = db("adapt:cloud:docker:out");
let cmdId = 0;

// Should move to utils
function streamToDebug(s: Readable, d: db.IDebugger, prefix?: string) {
    prefix = prefix ? `[${prefix}] ` : "";
    s.on("data", (chunk) => d(prefix + chunk.toString()));
    s.on("error", (err) => debug(prefix, err));
}

export const pickGlobals = (opts: DockerGlobalOptions): DockerGlobalOptions =>
    ld.pick(opts, "dockerHost");

/**
 * Common version of busybox to use internally.
 * @internal
 */
export const busyboxImage = "busybox:1";

/*
 * Staged build utilities
 */

async function writeFiles(pwd: string, files: File[]) {
    // Strip any leading slash
    files = files.map((f) => {
        return f.path.startsWith("/") ?
            { path: f.path.slice(1), contents: f.contents } :
            f;
    });
    // Make any directories required
    const dirs = ld.uniq(files
        .map((f) => path.dirname(f.path))
        .filter((d) => d !== "."));
    await Promise.all(dirs.map(async (d) => fs.mkdirp(path.resolve(pwd, d))));

    await Promise.all(files.map(async (f) => {
        const contents = ld.isString(f.contents) ? Buffer.from(f.contents) : f.contents;
        return fs.writeFile(path.resolve(pwd, f.path), contents);
    }));
}

export async function buildFilesImage(files: File[], opts: DockerGlobalOptions) {
    const dockerfile = `
        FROM scratch
        COPY . /
        `;
    return withTmpDir(async (dir) => {
        await writeFiles(dir, files);
        return dockerBuild("-", dir, {
            ...pickGlobals(opts),
            forceRm: true,
            imageName: "adapt-tmp-files",
            uniqueTag: true,
            stdin: dockerfile,
        });
    }, { prefix: "adapt-docker-build" });
}

export async function withFilesImage<T>(files: File[] | undefined,
    opts: DockerGlobalOptions,
    fn: (img: ImageInfo | undefined) => T | Promise<T>): Promise<T> {

    if (!files || files.length === 0) return fn(undefined);

    const image = await buildFilesImage(files, opts);
    try {
        return await fn(image);
    } finally {
        await dockerRemoveImage({ nameOrId: image.id, ...opts });
    }
}

export interface ExecDockerOptions extends DockerGlobalOptions {
    stdin?: string;
}

async function execDocker(args: string[], options: ExecDockerOptions) {
    const globalArgs = [];
    if (options.dockerHost) globalArgs.push("-H", options.dockerHost);

    args = globalArgs.concat(args);
    const opts = options.stdin ? { input: options.stdin } : undefined;

    const cmdDebug =
        debugOut.enabled ? debugOut.extend((++cmdId).toString()) :
            debug.enabled ? debug :
                null;
    if (cmdDebug) cmdDebug(`Running: ${"docker " + args.join(" ")}`);
    const ret = execa("docker", args, opts);
    if (debugOut.enabled && cmdDebug) {
        streamToDebug(ret.stdout, cmdDebug);
        streamToDebug(ret.stderr, cmdDebug);
    }

    return ret;
}

export const defaultDockerBuildOptions = {
    forceRm: true,
    uniqueTag: false,
};

export async function dockerBuild(
    dockerfile: string,
    contextPath: string,
    options: DockerBuildOptions = {}): Promise<ImageInfo> {

    const opts = { ...defaultDockerBuildOptions, ...options };
    let nameTag: string | undefined;

    const args = ["build", "-f", dockerfile];

    if (dockerfile === "-" && !opts.stdin) {
        throw new Error(`dockerBuild: stdin option must be set if dockerfile is "-"`);
    }

    if (opts.forceRm) args.push("--force-rm");
    if (opts.uniqueTag && !opts.imageName) {
        throw new Error(`dockerBuild: imageName must be set if uniqueTag is true`);
    }
    if (opts.imageName) {
        const tag = createTag(opts.imageTag, opts.uniqueTag);
        nameTag = tag ? `${opts.imageName}:${tag}` : opts.imageName;
        if (!opts.uniqueTag) args.push("-t", nameTag);
    }
    args.push(contextPath);

    const cmdRet = await execDocker(args, opts);
    const { stdout, stderr } = cmdRet;
    if (debug.enabled) debugBuild(cmdRet);

    const match = /^Successfully built ([0-9a-zA-Z]+)$/mg.exec(stdout);
    if (!match || !match[1]) throw new Error("Could not extract image sha\n" + stdout + "\n\n" + stderr);

    const id = await dockerImageId(match[1], opts);
    if (id == null) throw new Error(`Built image ID not found`);

    if (opts.uniqueTag) {
        const prevId = opts.prevUniqueTag && await dockerImageId(opts.prevUniqueTag, opts);
        if (prevId === id) nameTag = opts.prevUniqueTag; // prev points to current id
        else {
            if (!nameTag) throw new InternalError(`nameTag not set`);
            await dockerTag({
                existing: id,
                newTag: nameTag,
                ...pickGlobals(opts),
            });
        }
    }

    const ret: ImageInfo = { id };
    if (nameTag) ret.nameTag = nameTag;
    return ret;
}

function debugBuild(cmdRet: execa.ExecaReturns) {
    const steps: string[] = [];
    let cur = "";
    cmdRet.stdout.split("\n").forEach((l) => {
        if (l.startsWith("Step")) {
            if (cur) steps.push(cur);
            cur = l;
        } else if (l.startsWith(" ---> ")) {
            cur += l;
        }
    });
    if (cur) steps.push(cur);
    const cached = cur.includes("Using cache");
    debug(`docker ${cmdRet.cmd}:\n  Cached: ${cached}\n  ${steps.join("\n  ")}`);
}

/**
 * Fetch the image id for a Docker image
 *
 * @internal
 */
export async function dockerImageId(name: string, opts: DockerGlobalOptions = {}): Promise<ImageIdString | undefined> {
    try {
        const inspect = await dockerInspect([name], { type: "image", ...opts });
        if (inspect.length > 1) throw new Error(`Multiple images found`);
        if (inspect.length === 0) return undefined;

        return inspect[0].Id;

    } catch (err) {
        throw new Error(`Error getting image id for ${name}: ${err.message}`);
    }
}

export interface DockerTagOptions extends DockerGlobalOptions {
    existing: ImageNameString | ImageIdString;
    newTag: NameTagString;
}
export async function dockerTag(options: DockerTagOptions) {
    const { existing, newTag } = options;
    await execDocker(["tag", existing, newTag], options);
}

export interface DockerRemoveImageOptions extends DockerGlobalOptions {
    nameOrId: ImageNameString | ImageIdString;
    force?: boolean;
}

const dockerRemoveImageDefaults = {
    force: false,
};

export async function dockerRemoveImage(options: DockerRemoveImageOptions) {
    const opts = { ...dockerRemoveImageDefaults, ...options };

    const args = ["rmi"];
    if (opts.force) args.push("--force");
    args.push(opts.nameOrId);

    await execDocker(args, opts);
}

function createTag(baseTag: string | undefined, appendUnique: boolean): string | undefined {
    if (!baseTag && !appendUnique) return undefined;
    let tag = baseTag || "";
    if (baseTag && appendUnique) tag += "-";
    if (appendUnique) {
        tag += randomstring.generate({
            length: 8,
            charset: "alphabetic",
            readable: true,
            capitalization: "lowercase",
        });
    }
    return tag;
}

export interface InspectReport extends ContainerStatus { }

export interface DockerInspectOptions extends DockerGlobalOptions {
    type?: "container" | "image" | "network";
}

function isExecaError(e: Error): e is ExecaError {
    if (!e.message.startsWith("Command failed:")) return false;
    if (!("code" in e)) return false;
    return true;
}

/**
 * Run docker inspect and return the parsed output
 *
 * @internal
 */
export async function dockerInspect(namesOrIds: string[], opts: DockerInspectOptions = {}): Promise<InspectReport[]> {
    const execArgs = ["inspect"];
    if (opts.type) execArgs.push(`--type=${opts.type}`);
    let inspectRet: ExecaReturns;
    try {
        inspectRet = await execDocker([...execArgs, ...namesOrIds], opts);
    } catch (e) {
        if (isExecaError(e) && e.stderr.startsWith("Error: No such")) {
            inspectRet = e;
        } else throw e;
    }
    try {
        const inspect = JSON.parse(inspectRet.stdout);
        if (!Array.isArray(inspect)) throw new Error(`docker inspect result is not an array`);
        return inspect;
    } catch (err) {
        throw new Error(`Error inspecting docker objects ${namesOrIds}: ${err.message}`);
    }
}

/**
 * Run docker stop
 *
 * @internal
 */
export async function dockerStop(namesOrIds: string[], opts: DockerGlobalOptions): Promise<void> {
    const args = ["stop", ...namesOrIds];
    await execDocker(args, opts);
}

/**
 * Run docker rm
 *
 * @internal
 */
export async function dockerRm(namesOrIds: string[], opts: DockerGlobalOptions): Promise<void> {
    const args = ["rm", ...namesOrIds];
    await execDocker(args, opts);
}

/**
 * Options for {@link docker.dockerRun}
 *
 * @internal
 */
export interface DockerRunOptions extends DockerContainerProps {
    background?: boolean;
    name?: string;
    image: ImageNameString;
}

const defaultDockerRunOptions = {
    background: true,
};

/**
 * Run a container via docker run
 *
 * @internal
 */
export async function dockerRun(options: DockerRunOptions) {
    const opts = { ...defaultDockerRunOptions, ...options };
    const { background, labels, name, portBindings, } = opts;
    const args: string[] = ["run"];

    if (background) args.push("-d");
    if (name) args.push("--name", name);
    if (labels) {
        for (const l of Object.keys(labels)) {
            args.push("--label", `${l}=${labels[l]}`); //FIXME(manishv) better quoting/format checking here
        }
    }
    if (opts.autoRemove) args.push("--rm");
    if (portBindings) {
        const portArgs = Object.keys(portBindings).map((k) => `-p${k}:${portBindings[k]}`);
        args.push(...portArgs);
    }
    if (opts.stopSignal) args.push("--stop-signal", opts.stopSignal);

    args.push(opts.image);
    if (typeof opts.command === "string") args.push(...shellwords.split(opts.command));
    if (Array.isArray(opts.command)) args.push(...opts.command);

    return execDocker(args, opts);
}

/**
 * Options for dockerPush.
 *
 * @internal
 */
export interface DockerPushOptions extends DockerGlobalOptions {
    nameTag: NameTagString;
}

/**
 * Push an image to a registry
 *
 * @internal
 */
export async function dockerPush(opts: DockerPushOptions): Promise<void> {
    const args: string[] = ["push", opts.nameTag];
    await execDocker(args, opts);
}

/**
 * Options for dockerPull.
 *
 * @internal
 */
export interface DockerPullOptions extends DockerGlobalOptions {
    /**
     * Image to pull.
     * @remarks
     * See {@link docker.ImageNameString} for more details. If the registry
     * portion of imageName is absent, the official Docker registry is
     * assumed.
     */
    imageName: ImageNameString;
}

/**
 * Information about an image that has been successfully pulled from a
 * registry.
 *
 * @internal
 */
export interface DockerPullInfo {
    id: ImageIdString;
    repoDigest: RepoDigestString;
}

/**
 * Push an image to a registry
 *
 * @internal
 */
export async function dockerPull(opts: DockerPullOptions): Promise<DockerPullInfo> {
    const args: string[] = ["pull", opts.imageName];
    const repo = removeTag(opts.imageName);

    const { stdout } = await execDocker(args, opts);

    const m = stdout.match(/Digest:\s+(\S+)/);
    if (!m) throw new Error(`Output from docker pull did not contain Digest. Output:\n${stdout}`);
    const repoDigest = `${repo}@${m[1]}`;

    const info = await dockerInspect([repoDigest], { type: "image", ...pickGlobals(opts) });
    if (info.length !== 1) {
        throw new Error(`Unexpected number of images (${info.length}) match ${repoDigest}`);
    }
    return {
        id: info[0].Id,
        repoDigest,
    };
}

/**
 * Given a *valid* ImageNameString, removes the optional tag and returns only the
 * `[registry/]repo` portion.
 * NOTE(mark): This does not attempt to be a generic parser for all Docker
 * image name strings because there's ambiguity in how to parse that requires
 * context of where it came from or which argument of which CLI it is.
 */
function removeTag(imageName: ImageNameString): ImageNameString {
    const parts = imageName.split(":");
    switch (parts.length) {
        case 1:
            // 0 colons - no tag present
            break;
        case 2:
            // 1 colon - Could be either from hostname:port or :tag
            // If it's hostname:port, then parts[1] *must* include a slash
            // else it's a tag, so dump it.
            if (!parts[1].includes("/")) parts.pop();
            break;
        case 3:
            // 2 colons - last part is the tag
            parts.pop();
            break;
        default:
            throw new Error(`Invalid docker image name '${imageName}'`);
    }
    return parts.join(":");
}