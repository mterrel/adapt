import {
    AdaptElement,
    isMountedElement,
} from "@usys/adapt";
import { sha256hex } from "@usys/utils";
import AWS from "aws-sdk";

import { CFResourceProps } from "./CFResource";

export interface Tagged {
    Tags?: AWS.EC2.Tag[];
}

export const adaptDeployIdTag = "adapt:deployID";
export const adaptStackIdTag = "adapt:stackID";
export const adaptResourceIdTag = "adapt:resourceID";

export function addTag(input: Tagged, tag: string, value: string) {
    if (input.Tags == null) input.Tags = [];
    for (const t of input.Tags) {
        if (t.Key === tag) {
            t.Value = value;
            return;
        }
    }
    input.Tags.push({
        Key: tag,
        Value: value,
    });
}

export function getTag(obj: Tagged, tag: string) {
    if (obj.Tags) {
        for (const t of obj.Tags) {
            if (t.Key === tag) return t.Value;
        }
    }
    return undefined;
}

export function adaptResourceIdFromElem(el: AdaptElement<CFResourceProps>): string {
    return adaptIdFromElem(el.props.Type, el);
}

export function adaptIdFromElem(prefix: string, el: AdaptElement<{}>): string {
    if (!isMountedElement(el)) {
        throw new Error("Can only compute name of mounted elements");
    }
    return adaptId(prefix, el.id);
}

export function adaptId(prefix: string, elementId: string): string {
    const replaceRe = /[^a-z0-9]/ig;
    const name = prefix + sha256hex(elementId).slice(0, 32);
    // Remove all invalid chars
    return name.replace(replaceRe, "");
}