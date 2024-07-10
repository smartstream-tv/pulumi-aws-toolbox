const af = require("./dist/build/S3ArtifactFactory");

(async function() {
    await af.executeCommand("/home/smartstreamtv/workspace/ipy-scheduler/portal", "npm run build");
})().catch(console.error);


// TODO only if needed, in pulumi run phase
// const portalArtifact = await pat.build.buildLocally({
//     artifact: portalArtifactStore.getArtifactVersion("manual"),
//     //workingDir: `${__dirname}/portal`,
//     command: "npm run build",
//     outputDir: "./build"
// });
