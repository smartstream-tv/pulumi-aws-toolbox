const af = require("./dist/build/S3ArtifactFactory");

(async function() {
    await af.executeCommand("/home/smartstreamtv/workspace/ipy-scheduler/portal", "npm run build");
})().catch(console.error);