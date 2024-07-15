/**
 * Returns a IPv6 CIDR for a subnet with 64-bit prefix length contained in the given networkCidr.
 * The subnetIndex can be used to create multiple such subnets that won't overlap.
 * @param networkCidr valid IPv6 CIDR
 * @param subnetIndex must be >= 0
 * @returns the IPv6 CIDR of the subnet
 */
export function computeSubnetIpv6Cidr(networkCidr: string, subnetIndex: number): string {
    const [networkAddress, prefixLengthStr] = networkCidr.split("/");
    const prefixLength = parseInt(prefixLengthStr, 10);

    if (prefixLength != 56) {
        throw new Error("Only a network prefix length of 56 bits is currently supported");
    }

    const expandedAddress = expandIPv6Address(networkAddress);

    const subnetPrefix = expandedAddress.slice(0, 18);
    const subnetCidr = `${subnetPrefix}${subnetIndex}::/64`;
    return compactIpv6Address(subnetCidr);
}

function expandIPv6Address(address: string): string {
    const parts = address.split("::");
    const left = parts[0].split(":").filter(Boolean);
    const right = parts.length > 1 ? parts[1].split(":").filter(Boolean) : [];
    const fill = new Array(8 - left.length - right.length).fill("0");

    return [...left, ...fill, ...right].map(part => part.padStart(4, "0")).join(":");
}

function compactIpv6Address(ipv6Address: string): string {
    const [address, cidr] = ipv6Address.split('/');
    const addressParts = address.split(':');

    const normalizedParts = addressParts.map(part => {
        // Remove leading zeros but keep at least one digit if it's all zeros
        return part.replace(/^0+(?!$)/, '');
    });

    let normalizedAddress = normalizedParts.join(':');

    // Remove consecutive blocks of zeros, ensuring correct IPv6 abbreviation
    normalizedAddress = normalizedAddress.replace(/:0:/, ':');

    return `${normalizedAddress}/${cidr}`;
}
