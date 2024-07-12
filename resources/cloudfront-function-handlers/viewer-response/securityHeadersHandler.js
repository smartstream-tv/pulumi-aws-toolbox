// see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example-function-add-security-headers.html
function securityHeadersHandler(response) {
    // informs browsers that the site should only be accessed using HTTPS
    response.headers['strict-transport-security'] = { value: 'max-age=63072000; includeSubdomains; preload' };

    // indicate that the MIME types advertised in the Content-Type headers should be followed
    response.headers['x-content-type-options'] = { value: 'nosniff' };

    // avoid click-jacking attacks, by ensuring that content is not embedded into other sites
    response.headers['x-frame-options'] = { value: 'DENY' };

    // don't send the Referer header for cross-origin requests.
    response.headers['referrer-policy'] = {value: 'same-origin'};

    return {response};
}
