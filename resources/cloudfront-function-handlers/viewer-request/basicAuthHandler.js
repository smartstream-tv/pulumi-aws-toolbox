function basicAuthHandler(request) {
    const authExpected = 'Basic __BASIC_AUTH__';
    const authHeader = request.headers.authorization;
    if (typeof authHeader == 'undefined' || authHeader.value !== authExpected) {
        return {
            request: {
                statusCode: 401,
                statusDescription: 'Unauthorized',
                headers: {
                    "www-authenticate": { value: 'Basic realm="Access is restricted", charset="UTF-8"' }
                }
            },
            stop: true,
        };
    } else {
        return {request};
    }
}
