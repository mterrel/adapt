import { MultiError } from "@usys/utils";
import { DocumentNode as Query } from "graphql";
import ld from "lodash";
import pSettle from "p-settle";
import { CustomError } from "ts-custom-error";
import util from "util";
import { childrenToArray, isMountedElement } from "../src/jsx";
import { BuildData } from "./dom";
import { Variables } from "./observers/obs_manager_deployment";
import { ObserverNameHolder } from "./observers/registry";

export type ObserveForStatus<T = unknown> = (
    observer: ObserverNameHolder,
    query: Query,
    vars?: Variables) => Promise<T | undefined>;

export interface NoStatus {
    noStatus?: string | boolean;
}

export interface Status extends NoStatus {
    childStatus?: Status[];
    [key: string]: any;
}

export class NoStatusAvailable extends CustomError {
    public constructor(message?: string) {
        super("No Status Available: " + (message ? message : "<no message>"));
    }
}

function hasChildren(x: any): x is { children: unknown } {
    return "children" in x;
}

export async function noStatusOnError(f: () => unknown | Promise<unknown>): Promise<Status> {
    try {
        // tslint:disable-next-line:await-promise
        return (await f()) as Status; //FIXME(manishv) update when we fix status types
    } catch (e) {
        if (ld.isError(e)) return { noStatus: e.message };
        return { noStatus: util.inspect(e) };
    }
}

export async function defaultChildStatus<P extends object, S = unknown>(
    props: P, mgr: ObserveForStatus, data: BuildData): Promise<Status> {
    let childArray = data.origChildren;
    if (childArray === undefined && hasChildren(props)) {
        childArray = childrenToArray(props.children);
    }

    if (childArray !== undefined) {
        const children = childArray.filter(isMountedElement);
        const childStatusP = children.map((c) => noStatusOnError(() => c.status(mgr)));
        const childStatus = await Promise.all(childStatusP);
        return {
            childStatus
        };
    }
    return { noStatus: "element has no children" };
}

export async function defaultStatus<P extends object, S = unknown>(
    props: P,
    mgr: ObserveForStatus,
    data: BuildData): Promise<Status> {

    const succ = data.successor;

    if (succ === undefined) return defaultChildStatus(props, mgr, data);
    if (succ === null) return { noStatus: "successor was null" };
    return noStatusOnError(() => succ.status());
}

function noTransform(val: unknown): Status {
    if (val == null) return { noStatus: `Error: parent status is null`};
    return val as Status;
}

export async function mergeDefaultChildStatus<P extends object, S extends object>(
    props: P,
    parentStatus: object | Promise<object>,
    mgr: ObserveForStatus,
    data: BuildData,
    transformParentStatus = noTransform): Promise<Status> {

    const childrenP = defaultChildStatus(props, mgr, data);
    const [ parentResult, childrenResult ] =
        await pSettle([ Promise.resolve(parentStatus), childrenP ]);

    if (childrenResult.isRejected) throw childrenResult.reason;
    const children: Status = childrenResult.value as any;
    if (children == null) throw new Error(`Error: status for children is null`);

    let stat: Status;
    if (parentResult.isFulfilled) {
        stat = transformParentStatus(parentResult.value);
    } else {
        const err = parentResult.reason;
        if (!ld.isError(err)) throw err;
        stat = (err instanceof MultiError &&
            err.errors.length === 1 &&
            err.errors[0].message) ?
            { noStatus: err.errors[0].message } :
            stat = { noStatus: err.message };
    }

    if (Array.isArray(children.childStatus) && children.childStatus.length > 0) {
        stat.childStatus = children.childStatus;
    }

    return stat;
}
