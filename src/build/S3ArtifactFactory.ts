import { spawn } from "child_process";
import { S3Artifact } from "./S3Artifact";


// export class S3ArtifactFactory {
//     private artifact: S3Artifact;


//     constructor(artifact: S3Artifact) {
//         this.artifact = artifact;
//     }

// }

export async function buildLocally(args: BuildLocalArgs): Promise<S3Artifact> {
    await executeCommand(args.workingDir, args.command);
    return args.artifact;
}

export async function executeCommand(workingDir: string, command: string) {
    return new Promise((resolve, reject) => {
        const childProcess = spawn(command, {
            cwd: workingDir,
            shell: true,
        });

        // Stream the stdout data to the console
        childProcess.stdout.on('data', (data: Buffer) => {
            process.stdout.write(data.toString());
        });

        // Stream the stderr data to the console
        childProcess.stderr.on('data', (data: Buffer) => {
            process.stderr.write(data.toString());
        });

        // Handle process close
        childProcess.on('close', (code: number) => {
            if (code === 0) {
                resolve(`Command finished with exit code ${code}`);
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        // Handle errors
        childProcess.on('error', (error: Error) => {
            reject(new Error(`Error executing command: ${error.message}`));
        });
    });
}

export interface BuildLocalArgs {
    readonly artifact: S3Artifact;
    readonly workingDir: string;
    readonly command: string;

    /**
     * The path of the directory that will be used for the artifact's content. Relativ to workingDir.
     */
    readonly outputDir: string;
}
