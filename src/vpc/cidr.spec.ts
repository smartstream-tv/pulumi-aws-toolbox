import { computeSubnetIpv6Cidr } from "./cidr";

test('computeSubnetIpv6Cidr', () => {
    expect(computeSubnetIpv6Cidr('2a05:d024:5a::/56', 0)).toBe('2a05:d024:5a::/64');
    expect(computeSubnetIpv6Cidr('2a05:d024:5a::/56', 2)).toBe('2a05:d024:5a:2::/64');

    expect(computeSubnetIpv6Cidr('2a05:d014:a87:1f00::/56', 5)).toBe('2a05:d014:a87:1f05::/64');
});
