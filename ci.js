// pacival
// omnici

const frontendStore = new S3ArtifactStore({
  artifactName: "frontend",
});

// create a factory to build artifacts
// members functions are async and resolve to a S3Artifact object or null (S3ArtifactProvider)
const factory = new S3ArtifactFactory(frontendStore.getArtifactVersion("v1.2.34"));

new Lambda({
  artifact: factory.buildLocally({ // builds on same machine, requires aws-cli to be installed
    workspace: "./portal",
    command: "npm run build",
    outDir: "build",
  }),
})

// or:
// artifactFactory.buildWithNxShell({ // builds on same machine, but with nix
//   packages: "awscli",
//   // ...
// }),

new Website({
  artifact: factory.chain([
    factory.useExistingFrom({
      bucket: "dev-main-frontend-artifacts",
    }),
    factory.onCondition(isDev, factory.buildWithCodeBuild({
      instanceType: "t3.medium",
      image: buildImage({ // TODO buildImage will be a similar chained factory based ECR
        image: "nodejs:22",
        src: "builders/frontend", // image must include awscli
        // docker context is the entire repo - includes frontend/package.json
      }),
      src: "frontend",
      command: "npm run build",
      outDir: "build", // takes output from build/ dir by default
    })),
  ]).toOutput()
})

