// tslint:disable
import { ChangeType } from "@adpt/core";
import { Action, ActionContext, ShouldAct } from "@adpt/cloud/dist/src/action";
import fs from "fs-extra";

export interface LocalFileProps {
    path: string;
    contents: string;
}

export interface LocalFileState {
    lastPath?: string;
}


export class LocalFile extends Action<LocalFileProps, LocalFileState> {

    initialState() {
        return {};
    }

    async shouldAct(diff: ChangeType, context: ActionContext): Promise<ShouldAct> {
        const path = this.props.path;
        const contents = await this.getContents(path);
        let detail;

        if (diff === "delete") {
            // Element is being deleted. Does the file exist on disk?
            if (contents !== undefined)
                detail = `Deleting file ${path}`;
        } else {
            // Element is being created or possibly modified.
            if (contents === undefined)
                detail = `Creating file ${path}`;
            else if (contents !== this.props.contents)
                detail = `Updating file ${path}`;
        }

        if (this.state.lastPath && this.state.lastPath !== path) {
            detail += ` and deleting file ${this.state.lastPath}`;
        }

        // If detail is unset, then no changes are required
        if (!detail) return false;

        // Return a ShouldAct object that says action is required and a string
        // that describes the action
        return { act: true, detail };
    }

    // Returns the contents of a file or undefined if the file doesn't exist
    async getContents(path: string) {
        try {
            return await fs.readFile(path, 'utf8');
        } catch (err) {
            if (err.code === 'ENOENT') return undefined; // File doesn't exist
            else throw err; // Any other error
        }
    }

    async action(diff: ChangeType, context: ActionContext) {
        const path = this.props.path;

        if (this.state.lastPath && this.state.lastPath !== path) {
            await fs.remove(this.state.lastPath);
        }

        if (diff === "delete") {
            // Removes the file, ignoring if the file does not exist
            await fs.remove(path);
        } else {
            await fs.writeFile(path, this.props.contents);
            // Remember the path of the file we created/updated
            this.setState({ lastPath: path });
        }
    }
}
