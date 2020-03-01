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
    }
    catch (err) {
        core.debug(err);
        return undefined;
    }
}

async function getConfig() {
    const ymlConfig = await getYamlConfig();
    core.debug(JSON.stringify(ymlConfig));
    return ymlConfig;
}

function getInput(name, fallback) {
    const input = core.getInput(name);
    return input || fallback;
}

async function run() {
    try {
        core.debug(JSON.stringify(token));
        core.debug(JSON.stringify(context.payload));
        if (github.context.eventName != "pull_request") {
            core.info("This action is supposed to run for pushes to pull requests only. Stepping out...");
            return;
        }
        const event = await getEvent();
        core.debug(JSON.stringify(event));
        if (!["labeled", "unlabeled"].includes(event.action)) {
            core.info("This action is supposed to run for labeled and unlabeled pull requests only. Stepping out...");
            return;
        }
        await check();
    }
    catch (err) {
        //Even if it's a valid situation, we want to fail the action in order to be able to find the issue and fix it.
        core.setFailed(err.message);
        core.debug(JSON.stringify(err));
    }
}

function labelMap(label) {
    return label.name;
}

async function check() {
    if (context.payload.pull_request.state != "open") {
        core.info("Pull request is not open. Stepping out...");
        return;
    }
    const config = await getConfig();
    if (!config) {
        core.info("Config file not found. Stepping out...");
        return;
    }
    core.info(`Config file loaded from ${CONFIG_PATH}`);
    const target = context.payload.pull_request.base.ref,
        targetLabels = config[target];
    if (!targetLabels) {
        core.info(`Branch ${target} not specified in the config file. Stepping out...`);
        return;
    }
    const prLabels = context.payload.pull_request.labels.map(labelMap);
    for (const label of targetLabels) {
        if (prLabels.includes(label)) {
            core.info(`Found label "${label}". Stepping out...`);
            return;
        }
        core.debug(`Label ${label} not found.`);
    }
    if (apply == "never") {
        core.setFailed("Missing respective label.");
        core.info("`Apply` is set to `never`. Skipping...");
        return;
    }
    if (targetLabels.length > 1 && apply == "single") {
        core.info("Multiple respective labels found, but `apply` is set to `single`. Skipping...");
        return;
    }
    const label = targetLabels[0];
    core.info(`Applying "${label}" label...`);
    const labelResponse = await client.issues.addLabels({
        issue_number: context.issue.number,
        labels: [label],
        owner,
        repo,
    });
    core.debug(JSON.stringify(labelResponse.data));
}

run();