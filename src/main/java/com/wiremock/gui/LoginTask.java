package com.wiremock.gui;

import com.github.tomakehurst.wiremock.admin.AdminTask;
import com.github.tomakehurst.wiremock.common.Json;
import com.github.tomakehurst.wiremock.common.url.PathParams;
import com.github.tomakehurst.wiremock.core.Admin;
import com.github.tomakehurst.wiremock.http.ResponseDefinition;
import com.github.tomakehurst.wiremock.stubbing.ServeEvent;

import java.util.Map;

import static com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder.responseDefinition;

/**
 * POST /__admin/gui/api/login
 * Body: { "username": "admin", "password": "secret" }
 * Returns: { "token": "...", "username": "admin", "role": "admin", "expiresAt": 1709388000 }
 */
public class LoginTask implements AdminTask {

    @SuppressWarnings("unchecked")
    @Override
    public ResponseDefinition execute(Admin admin, ServeEvent serveEvent, PathParams pathParams) {
        AuthConfig config = AuthConfig.getInstance();
        if (!config.isEnabled()) {
            return responseDefinition()
                    .withStatus(404)
                    .withBody("{\"error\":\"Authentication is not enabled\"}")
                    .withHeader("Content-Type", "application/json")
                    .build();
        }

        try {
            String body = serveEvent.getRequest().getBodyAsString();
            Map<String, Object> parsed = Json.read(body, Map.class);
            String username = (String) parsed.get("username");
            String password = (String) parsed.get("password");

            if (username == null || password == null) {
                return responseDefinition()
                        .withStatus(400)
                        .withBody("{\"error\":\"username and password are required\"}")
                        .withHeader("Content-Type", "application/json")
                        .build();
            }

            AuthConfig.UserEntry user = config.findUser(username);
            if (user == null || !PasswordUtil.verify(password, user.passwordHash)) {
                return responseDefinition()
                        .withStatus(401)
                        .withBody("{\"error\":\"Invalid credentials\"}")
                        .withHeader("Content-Type", "application/json")
                        .build();
            }

            String token = TokenUtil.createToken(user.username, user.role, config.getSecret(), config.getTokenExpiryMinutes());
            long expiresAt = java.time.Instant.now().getEpochSecond() + (config.getTokenExpiryMinutes() * 60L);

            return responseDefinition()
                    .withStatus(200)
                    .withBody("{\"token\":\"" + token
                            + "\",\"username\":\"" + escapeJson(user.username)
                            + "\",\"role\":\"" + escapeJson(user.role)
                            + "\",\"expiresAt\":" + expiresAt + "}")
                    .withHeader("Content-Type", "application/json")
                    .build();

        } catch (Exception e) {
            return responseDefinition()
                    .withStatus(500)
                    .withBody("{\"error\":\"" + escapeJson(e.getMessage()) + "\"}")
                    .withHeader("Content-Type", "application/json")
                    .build();
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
