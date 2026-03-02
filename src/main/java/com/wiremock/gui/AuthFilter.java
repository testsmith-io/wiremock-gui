package com.wiremock.gui;

import com.github.tomakehurst.wiremock.http.Request;
import com.github.tomakehurst.wiremock.http.RequestMethod;
import com.github.tomakehurst.wiremock.http.ResponseDefinition;

import static com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder.responseDefinition;

/**
 * Utility class that checks authentication and RBAC for admin requests.
 * Not a WireMock extension itself — called from WireMockGuiExtension.filter().
 */
public final class AuthFilter {

    private AuthFilter() {}

    /**
     * Check if the request is allowed.
     * @return null if allowed, or a ResponseDefinition to block with.
     */
    public static ResponseDefinition check(Request request) {
        AuthConfig config = AuthConfig.getInstance();
        if (!config.isEnabled()) return null;

        String url = request.getUrl();

        // allowlist: no auth required
        if (isAllowlisted(url)) return null;

        // extract token
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return jsonResponse(401, "Authentication required");
        }

        String token = authHeader.substring(7);
        TokenUtil.TokenPayload payload = TokenUtil.validateToken(token, config.getSecret());
        if (payload == null) {
            return jsonResponse(401, "Invalid or expired token");
        }

        // RBAC check
        if (!isAllowed(payload.role, request.getMethod(), url)) {
            return jsonResponse(403, "Insufficient permissions");
        }

        return null; // allowed
    }

    private static boolean isAllowlisted(String url) {
        // Strip /__admin prefix if present — the filter may receive either form
        String path = url.startsWith("/__admin") ? url.substring("/__admin".length()) : url;
        return path.equals("/gui")
            || path.startsWith("/gui/assets/")
            || path.equals("/gui/api/login")
            || path.equals("/gui/api/auth-check")
            || path.equals("/health");
    }

    static boolean isAllowed(String role, RequestMethod method, String url) {
        if ("admin".equals(role)) return true;

        // Normalize: strip /__admin prefix if present
        String path = url.startsWith("/__admin") ? url.substring("/__admin".length()) : url;

        boolean readOnly = RequestMethod.GET.equals(method)
                        || RequestMethod.HEAD.equals(method)
                        || RequestMethod.OPTIONS.equals(method);

        if ("viewer".equals(role)) return readOnly;

        // editor: read + write, except admin-only endpoints
        if ("editor".equals(role)) {
            if (readOnly) return true;
            if (path.startsWith("/recordings/") && !path.endsWith("/status")) return false;
            if (path.equals("/reset")) return false;
            if (path.equals("/shutdown")) return false;
            if (path.equals("/settings") && RequestMethod.POST.equals(method)) return false;
            return true;
        }

        return false; // unknown role
    }

    private static ResponseDefinition jsonResponse(int status, String message) {
        return responseDefinition()
                .withStatus(status)
                .withBody("{\"error\":\"" + message + "\"}")
                .withHeader("Content-Type", "application/json")
                .build();
    }
}
