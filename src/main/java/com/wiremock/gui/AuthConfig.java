package com.wiremock.gui;

import com.github.tomakehurst.wiremock.common.Json;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

/**
 * Loads and holds auth configuration from users.json.
 *
 * If users.json is not found, auth is disabled and all requests pass through.
 *
 * Expected format:
 * {
 *   "tokenExpiryMinutes": 480,
 *   "users": [
 *     { "username": "admin", "password": "pbkdf2:...", "role": "admin" }
 *   ]
 * }
 */
public final class AuthConfig {

    private static volatile AuthConfig instance;

    private final boolean enabled;
    private final byte[] secret;
    private final int tokenExpiryMinutes;
    private final Map<String, UserEntry> users;

    private AuthConfig() {
        Path path = Paths.get("users.json");
        if (!Files.exists(path)) {
            this.enabled = false;
            this.secret = new byte[0];
            this.tokenExpiryMinutes = 0;
            this.users = Collections.emptyMap();
            return;
        }

        try {
            String content = new String(Files.readAllBytes(path));
            @SuppressWarnings("unchecked")
            Map<String, Object> config = Json.read(content, Map.class);

            this.tokenExpiryMinutes = config.containsKey("tokenExpiryMinutes")
                    ? ((Number) config.get("tokenExpiryMinutes")).intValue()
                    : 480;

            // HMAC secret: from config or generate random
            if (config.containsKey("secret") && config.get("secret") instanceof String) {
                this.secret = Base64.getDecoder().decode((String) config.get("secret"));
            } else {
                this.secret = TokenUtil.generateSecret();
            }

            // parse users
            Map<String, UserEntry> userMap = new LinkedHashMap<>();
            Object usersObj = config.get("users");
            if (usersObj instanceof List) {
                for (Object item : (List<?>) usersObj) {
                    if (item instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> u = (Map<String, Object>) item;
                        String username = (String) u.get("username");
                        String password = (String) u.get("password");
                        String role = (String) u.get("role");
                        if (username != null && password != null && role != null) {
                            userMap.put(username, new UserEntry(username, password, role));
                        }
                    }
                }
            }

            this.users = Collections.unmodifiableMap(userMap);
            this.enabled = !this.users.isEmpty();
        } catch (Exception e) {
            throw new RuntimeException("Failed to load users.json: " + e.getMessage(), e);
        }
    }

    public static AuthConfig getInstance() {
        if (instance == null) {
            synchronized (AuthConfig.class) {
                if (instance == null) {
                    instance = new AuthConfig();
                }
            }
        }
        return instance;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public byte[] getSecret() {
        return secret;
    }

    public int getTokenExpiryMinutes() {
        return tokenExpiryMinutes;
    }

    public UserEntry findUser(String username) {
        return users.get(username);
    }

    public static final class UserEntry {
        public final String username;
        public final String passwordHash;
        public final String role;

        UserEntry(String username, String passwordHash, String role) {
            this.username = username;
            this.passwordHash = passwordHash;
            this.role = role;
        }
    }
}
