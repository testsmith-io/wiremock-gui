package com.wiremock.gui;

import com.github.tomakehurst.wiremock.admin.AdminTask;
import com.github.tomakehurst.wiremock.common.url.PathParams;
import com.github.tomakehurst.wiremock.core.Admin;
import com.github.tomakehurst.wiremock.http.ResponseDefinition;
import com.github.tomakehurst.wiremock.stubbing.ServeEvent;

import static com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder.responseDefinition;

/**
 * GET /__admin/gui/api/auth-check
 *
 * Returns auth status. This endpoint is allowlisted (no auth required)
 * so the frontend can check whether auth is enabled before showing login.
 *
 * Response when auth disabled:  { "authEnabled": false }
 * Response when authenticated:  { "authEnabled": true, "authenticated": true, "username": "admin", "role": "admin" }
 * Response when not authed:     { "authEnabled": true, "authenticated": false }
 */
public class AuthCheckTask implements AdminTask {

    @Override
    public ResponseDefinition execute(Admin admin, ServeEvent serveEvent, PathParams pathParams) {
        AuthConfig config = AuthConfig.getInstance();

        if (!config.isEnabled()) {
            return jsonResponse("{\"authEnabled\":false}");
        }

        // try to validate token from header
        String authHeader = serveEvent.getRequest().getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            TokenUtil.TokenPayload payload = TokenUtil.validateToken(token, config.getSecret());
            if (payload != null) {
                return jsonResponse("{\"authEnabled\":true,\"authenticated\":true"
                        + ",\"username\":\"" + escapeJson(payload.username)
                        + "\",\"role\":\"" + escapeJson(payload.role) + "\"}");
            }
        }

        return jsonResponse("{\"authEnabled\":true,\"authenticated\":false}");
    }

    private static ResponseDefinition jsonResponse(String body) {
        return responseDefinition()
                .withStatus(200)
                .withBody(body)
                .withHeader("Content-Type", "application/json")
                .build();
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
