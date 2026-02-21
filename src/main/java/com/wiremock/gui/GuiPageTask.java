package com.wiremock.gui;

import com.github.tomakehurst.wiremock.admin.AdminTask;
import com.github.tomakehurst.wiremock.common.url.PathParams;
import com.github.tomakehurst.wiremock.core.Admin;
import com.github.tomakehurst.wiremock.http.ResponseDefinition;
import com.github.tomakehurst.wiremock.stubbing.ServeEvent;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder.responseDefinition;

public class GuiPageTask implements AdminTask {

    @Override
    public ResponseDefinition execute(Admin admin, ServeEvent serveEvent, PathParams pathParams) {
        try (InputStream is = getClass().getResourceAsStream("/wiremock-gui/index.html")) {
            if (is == null) {
                return responseDefinition()
                        .withStatus(404)
                        .withBody("WireMock GUI not found. Ensure the GUI assets are bundled in the JAR.")
                        .withHeader("Content-Type", "text/plain")
                        .build();
            }
            String html = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            return responseDefinition()
                    .withStatus(200)
                    .withBody(html)
                    .withHeader("Content-Type", "text/html; charset=utf-8")
                    .withHeader("Cache-Control", "no-cache")
                    .build();
        } catch (IOException e) {
            return responseDefinition()
                    .withStatus(500)
                    .withBody("Error reading GUI: " + e.getMessage())
                    .withHeader("Content-Type", "text/plain")
                    .build();
        }
    }
}
