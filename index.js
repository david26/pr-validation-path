const core = require("@actions/core"),
    github = require("@actions/github");

const REPO_DIRECTORY = process.env["GITHUB_WORKSPACE"],
    targetBranch = core.getInput("target-branch", { required: true }),
    allowedOrigens = core.getInput("allowed-branches", { required: true }),
    context = github.context,
    owner = context.repo.owner,
    repo = context.repo.repo;

const getEvent = async () => JSON.parse(await fs.readFile(process.env["GITHUB_EVENT_PATH"]));

function getInput(name, fallback) {
    const input = core.getInput(name);
    return input || fallback;
}

async function run() {
    try {
        if (github.context.eventName != "pull_request") {
            core.info("This actions is only for pull request evaluation. Stepping out...");
            return;
        }
        await check();
    }
    catch (err) {
        core.setFailed(err.message);
        core.debug(JSON.stringify(err));
    }
}

async function check() {    
    const state = context.payload.pull_request.state;    

    if (state != "open") {
        core.info("Pull request is not open. Stepping out...");
        return;
    }

    const target = context.payload.pull_request.base.ref;
    const allowedBranches = allowedOrigens.split(",");
    const source = context.payload.pull_request.head.ref;

    core.info(`Merge branch "${source}" into "${target}".`);
    core.info(`Allowed combinations for ${target} branch are: `);
    for (const branch of allowedBranches) {
        core.info(` ${target} <- ${branch}`);
    }
 
    var isAllowed = false;
    for (var branch of allowedBranches) {
        branch = branch.replace("-*","-");
        core.info(`Evaluating ${branch} with ${source}`);
        if(source.startsWith(branch)===true){
            isAllowed = true;
        }
    }
    core.info(`is allowed -> ${isAllowed}`);
    if(isAllowed===false){
        core.info("Pull request not allowed. Stepping out");
        core.setFailed("Pull request not allowed");
        return;
    }
}

run();