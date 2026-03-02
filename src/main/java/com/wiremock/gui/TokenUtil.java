package com.wiremock.gui;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

/**
 * HMAC-SHA256 token creation and validation using only Java built-ins.
 *
 * Token format: base64url(json_payload).base64url(hmac_signature)
 * Payload: {"sub":"username","role":"admin","exp":1709388000}
 */
public final class TokenUtil {

    private static final String HMAC_ALG = "HmacSHA256";
    private static final Base64.Encoder B64E = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private TokenUtil() {}

    public static byte[] generateSecret() {
        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        return secret;
    }

    public static String createToken(String username, String role, byte[] secret, int expiryMinutes) {
        long exp = Instant.now().getEpochSecond() + (expiryMinutes * 60L);
        String payload = "{\"sub\":\"" + escapeJson(username)
                + "\",\"role\":\"" + escapeJson(role)
                + "\",\"exp\":" + exp + "}";
        String encodedPayload = B64E.encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String signature = B64E.encodeToString(hmac(encodedPayload.getBytes(StandardCharsets.UTF_8), secret));
        return encodedPayload + "." + signature;
    }

    public static TokenPayload validateToken(String token, byte[] secret) {
        if (token == null) return null;
        int dot = token.indexOf('.');
        if (dot < 0) return null;

        String encodedPayload = token.substring(0, dot);
        String encodedSignature = token.substring(dot + 1);

        // verify signature
        byte[] expectedSig = hmac(encodedPayload.getBytes(StandardCharsets.UTF_8), secret);
        byte[] actualSig;
        try {
            actualSig = B64D.decode(encodedSignature);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!constantTimeEquals(expectedSig, actualSig)) return null;

        // decode payload
        String json;
        try {
            json = new String(B64D.decode(encodedPayload), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }

        // minimal JSON parsing (3 known fields)
        String sub = extractString(json, "sub");
        String role = extractString(json, "role");
        long exp = extractLong(json, "exp");
        if (sub == null || role == null || exp <= 0) return null;

        // check expiry
        if (Instant.now().getEpochSecond() > exp) return null;

        return new TokenPayload(sub, role, exp);
    }

    private static byte[] hmac(byte[] data, byte[] secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALG);
            mac.init(new SecretKeySpec(secret, HMAC_ALG));
            return mac.doFinal(data);
        } catch (Exception e) {
            throw new RuntimeException("HMAC failed", e);
        }
    }

    private static boolean constantTimeEquals(byte[] a, byte[] b) {
        if (a.length != b.length) return false;
        int result = 0;
        for (int i = 0; i < a.length; i++) {
            result |= a[i] ^ b[i];
        }
        return result == 0;
    }

    private static String extractString(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return null;
        start += search.length();
        int end = json.indexOf('"', start);
        if (end < 0) return null;
        return json.substring(start, end);
    }

    private static long extractLong(String json, String key) {
        String search = "\"" + key + "\":";
        int start = json.indexOf(search);
        if (start < 0) return -1;
        start += search.length();
        int end = start;
        while (end < json.length() && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '-')) {
            end++;
        }
        try {
            return Long.parseLong(json.substring(start, end));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public static class TokenPayload {
        public final String username;
        public final String role;
        public final long exp;

        public TokenPayload(String username, String role, long exp) {
            this.username = username;
            this.role = role;
            this.exp = exp;
        }
    }
}
