package com.wiremock.gui;

import com.github.tomakehurst.wiremock.admin.AdminTask;
import com.github.tomakehurst.wiremock.common.url.PathParams;
import com.github.tomakehurst.wiremock.core.Admin;
import com.github.tomakehurst.wiremock.http.ResponseDefinition;
import com.github.tomakehurst.wiremock.stubbing.ServeEvent;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder.responseDefinition;

public class GuiStaticAssetTask implements AdminTask {

    private static final Map<String, String> CONTENT_TYPES = Map.of(
            "js", "application/javascript; charset=utf-8",
            "css", "text/css; charset=utf-8",
            "svg", "image/svg+xml",
            "png", "image/png",
            "ico", "image/x-icon",
            "json", "application/json",
            "woff2", "font/woff2",
            "woff", "font/woff"
    );

    @Override
    public ResponseDefinition execute(Admin admin, ServeEvent serveEvent, PathParams pathParams) {
        String filename = pathParams.get("filename");

        if (filename == null || filename.contains("..")) {
            return responseDefinition()
                    .withStatus(400)
                    .withBody("Invalid filename")
                    .withHeader("Content-Type", "text/plain")
                    .build();
        }

        try (InputStream is = getClass().getResourceAsStream("/wiremock-gui/assets/" + filename)) {
            if (is == null) {
                return responseDefinition()
                        .withStatus(404)
                        .withBody("Asset not found: " + filename)
                        .withHeader("Content-Type", "text/plain")
                        .build();
            }

            byte[] content = is.readAllBytes();
            String contentType = getContentType(filename);

            if (contentType.contains("charset") || contentType.startsWith("text/") || contentType.startsWith("application/javascript") || contentType.startsWith("application/json")) {
                return responseDefinition()
                        .withStatus(200)
                        .withBody(new String(content, StandardCharsets.UTF_8))
                        .withHeader("Content-Type", contentType)
                        .withHeader("Cache-Control", "public, max-age=31536000, immutable")
                        .build();
            } else {
                return responseDefinition()
                        .withStatus(200)
                        .withBase64Body(java.util.Base64.getEncoder().encodeToString(content))
                        .withHeader("Content-Type", contentType)
                        .withHeader("Cache-Control", "public, max-age=31536000, immutable")
                        .build();
            }
        } catch (IOException e) {
            return responseDefinition()
                    .withStatus(500)
                    .withBody("Error reading asset: " + e.getMessage())
                    .withHeader("Content-Type", "text/plain")
                    .build();
        }
    }

    private String getContentType(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex >= 0) {
            String ext = filename.substring(dotIndex + 1).toLowerCase();
            return CONTENT_TYPES.getOrDefault(ext, "application/octet-stream");
        }
        return "application/octet-stream";
    }
}
