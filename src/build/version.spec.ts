import { getVersion } from "./version";

test('getVersion wrong dir', async () => {
    await expect(() => getVersion('doesnotexist')).rejects.toThrow();
});

test('getVersion src/database', async () => {
    expect(await getVersion('src/database')).toBe(`b5461773`);
});
