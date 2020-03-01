const path = require("path"),
    fs = require("fs").promises,
    yaml = require("js-yaml"),
    core = require("@actions/core"),
    github = require("@actions/github");

const REPO_DIRECTORY = process.env["GITHUB_WORKSPACE"],
    CONFIG_PATH = path.join(REPO_DIRECTORY, getInput("config-path", ".github/source-dest.yml")),
    token = core.getInput("github-token", { required: true }),
    apply = getInput("apply", "never"),
    context = github.context,
    owner = context.repo.owner,
    repo = context.repo.repo,
    client = new github.GitHub(token);

const getEvent = async () => JSON.parse(await fs.readFile(process.env["GITHUB_EVENT_PATH"]));

async function getYamlConfig() {
    try {
        const text = await fs.readFile(CONFIG_PATH);
        return yaml.safeLoad(text);
    } catch (err) {
        core.info(err); 
        core.debug(err);
        return undefined;
    }
}

async function getConfig() {
    const ymlConfig = await getYamlConfig();
    return ymlConfig;
}

function getInput(name, fallback) {
    const input = core.getInput(name);
    return input || fallback;
}

async function run() {
    try {
        core.debug(JSON.stringify(context.payload));
        core.debug(JSON.stringify(github.context));
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

function labelMap(label) {
    return label.name;
}

async function check() {
    core.info(`In check`);
    const state = context.payload.pull_request.state;
    const config = await getConfig();

    if (state != "open") {
        core.info("Pull request is not open. Stepping out...");
        return;
    }

    if (!config) {
        core.info("Config file not found. Stepping out...");
        return;
    }

    const target = context.payload.pull_request.base.ref;
    const allowedBranches = config[target];
    const source = context.payload.pull_request.head.ref;

    core.info(`From branch "${source}" to "${target}".`);
    core.info(`Allowed combinatios for "${target}" are: `);
    for (const branch of allowedBranches) {
        core.info(` ${target} <- ${branch}.`);
    }
    for (const branch of allowedBranches) {
        core.info(` ${branch} -> ${target} `);
    }

    /*
    core.info(`From branch "${source}" to "${target}".`);
    core.info(JSON.stringify(allowedBranches));

    for (const branch of allowedBranches) {
        core.info(`branch ${branch}.`);
    }

    const label = targetLabels[0];
    core.info(`Applying "${label}" label...`);
    const labelResponse = await client.issues.addLabels({
        issue_number: context.issue.number,
        labels: [label],
        owner,
        repo,
    });
    core.debug(JSON.stringify(labelResponse.data));*/
}

run();