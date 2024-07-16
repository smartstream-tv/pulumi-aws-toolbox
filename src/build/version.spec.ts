import { getVersion } from "./version";

test('getVersion wrong dir', async () => {
    await expect(() => getVersion('doesnotexist')).rejects.toThrow();
});

test('getVersion for src/database', async () => {
    expect(await getVersion('src/database')).toBe(`b5461773`);
});

test('getVersion for multiple paths', async () => {
    expect(await getVersion('src/database', 'resources/ses-proxy-mailer')).toBe(`d96b98da`);
});
