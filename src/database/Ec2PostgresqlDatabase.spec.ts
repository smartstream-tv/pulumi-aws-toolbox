import { resolveOutput } from "../util/pulumi";
import { createInitScript } from "./Ec2PostgresqlDatabase";

test('createInitScript', async () => {
    const script = await resolveOutput(createInitScript("/dev/xvdf", "12345678"));
    expect(script).toContain(`ALTER USER postgres PASSWORD '12345678'`);
});
