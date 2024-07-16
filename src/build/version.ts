import * as child_process from "child_process";
import * as fs from "fs";
import { promisify } from "util";

const exec = promisify(child_process.exec);

/**
 * Computes a version for a given path in the repository using the git history.
 * Useful for building immutable build artifacts.
 * 
 * Determines the hash of the git commit when the given path was last changed and truncates it to eight characters.
 * Git CLI must be installed!
 * 
 * @param path relative to the current working dir
 */
export async function getVersion(path: string): Promise<string> {
    // check that the path exists
    await fs.promises.access(path);

    const { stdout } = await exec(`git log -n 1 --pretty=format:%H -- '${path}'`);
    if (stdout.trim().length == 0) throw new Error(`Path ${path} not found in history`);

    const version = stdout.substring(0, 8);
    return version;
}
