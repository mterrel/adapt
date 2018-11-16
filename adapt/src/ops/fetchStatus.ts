import { InternalError } from "../error";
import { ObserversThatNeedData } from "../observers";
import { adaptServer } from "../server";
import { loadDeployment } from "../server/deployment";
import { build, BuildResults, currentState, withContext } from "./buildAndDeploy";
import {
    defaultDeployCommonOptions,
    DeployCommonOptions,
    DeployState,
    setupLogger,
} from "./common";
import { forkExports } from "./fork";

export interface StatusOptions extends DeployCommonOptions {
    deployID: string;
}

const defaultOptions = {
};

export async function fetchStatus(options: StatusOptions): Promise<DeployState> {
    const finalOptions = {
        ...defaultDeployCommonOptions,
        ...defaultOptions,
        ...options
    };
    const { adaptUrl, deployID, logger: _logger, ...buildOpts } = finalOptions;

    const logger = await setupLogger(_logger);

    try {
        const server = await adaptServer(adaptUrl, {});
        const deployment = await loadDeployment(server, deployID);
        const currState = await currentState({
            deployment,
            logger,
            ...buildOpts
        });

        let result: BuildResults | undefined;
        let needsData: ObserversThatNeedData | undefined;
        await withContext(currState, async (ctx) => {
            result = await build({
                ...currState,
                ctx,
                withStatus: true
            });

            const inAdapt = ctx.Adapt;
            needsData = inAdapt.internal.simplifyNeedsData(result.needsData);
        });

        if (result === undefined) throw new InternalError("result undefined, should be unreachable");
        if (needsData === undefined) throw new InternalError("needsData undefined, should be unreachable");

        return {
            type: "success",
            messages: logger.messages,
            summary: logger.summary,

            domXml: result.domXml,
            stateJson: result.prevStateJson,
            deployID: options.deployID,
            needsData,
            mountedOrigStatus: result.mountedOrigStatus,
        };
    } catch (err) {
        logger.error(`Error fetching deployment status: ${err}`);
        return {
            type: "error",
            messages: logger.messages,
            summary: logger.summary,
            domXml: err.domXml,
        };
    }
}

forkExports(module, "fetchStatus");