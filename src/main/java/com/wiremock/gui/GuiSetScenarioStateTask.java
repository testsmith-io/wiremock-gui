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
 * Custom endpoint that sets scenario state using the request body
 * instead of URL path parameters, avoiding URL-encoding issues
 * with scenario names containing spaces or special characters.
 *
 * POST /__admin/gui/api/set-scenario-state
 * Body: { "scenarioName": "my scenario", "state": "step_2" }
 */
public class GuiSetScenarioStateTask implements AdminTask {

    @SuppressWarnings("unchecked")
    @Override
    public ResponseDefinition execute(Admin admin, ServeEvent serveEvent, PathParams pathParams) {
        try {
            String body = serveEvent.getRequest().getBodyAsString();
            Map<String, Object> parsed = Json.read(body, Map.class);

            String scenarioName = (String) parsed.get("scenarioName");
            String state = (String) parsed.get("state");

            if (scenarioName == null || scenarioName.isEmpty()) {
                return responseDefinition()
                        .withStatus(400)
                        .withBody("{\"error\": \"scenarioName is required\"}")
                        .withHeader("Content-Type", "application/json")
                        .build();
            }
            if (state == null || state.isEmpty()) {
                return responseDefinition()
                        .withStatus(400)
                        .withBody("{\"error\": \"state is required\"}")
                        .withHeader("Content-Type", "application/json")
                        .build();
            }

            admin.setScenarioState(scenarioName, state);

            return responseDefinition()
                    .withStatus(200)
                    .withBody("{\"scenarioName\": \"" + escapeJson(scenarioName) + "\", \"state\": \"" + escapeJson(state) + "\"}")
                    .withHeader("Content-Type", "application/json")
                    .build();
        } catch (Exception e) {
            return responseDefinition()
                    .withStatus(500)
                    .withBody("{\"error\": \"" + escapeJson(e.getMessage()) + "\"}")
                    .withHeader("Content-Type", "application/json")
                    .build();
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
