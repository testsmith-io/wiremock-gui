package com.wiremock.gui;

import com.github.tomakehurst.wiremock.admin.Router;
import com.github.tomakehurst.wiremock.extension.AdminApiExtension;
import com.github.tomakehurst.wiremock.extension.TemplateHelperProviderExtension;
import com.github.tomakehurst.wiremock.extension.requestfilter.AdminRequestFilterV2;
import com.github.tomakehurst.wiremock.extension.requestfilter.RequestFilterAction;
import com.github.tomakehurst.wiremock.http.Request;
import com.github.tomakehurst.wiremock.http.RequestMethod;
import com.github.tomakehurst.wiremock.http.ResponseDefinition;
import com.github.tomakehurst.wiremock.stubbing.ServeEvent;
import com.github.jknack.handlebars.Helper;

import java.util.HashMap;
import java.util.Map;

public class WireMockGuiExtension implements AdminApiExtension, TemplateHelperProviderExtension, AdminRequestFilterV2 {

    @Override
    public String getName() {
        return "wiremock-gui";
    }

    @Override
    public void contributeAdminApiRoutes(Router router) {
        router.add(RequestMethod.GET, "/gui", GuiPageTask.class);
        router.add(RequestMethod.GET, "/gui/assets/{filename}", GuiStaticAssetTask.class);
        router.add(RequestMethod.POST, "/gui/api/set-scenario-state", GuiSetScenarioStateTask.class);
        router.add(RequestMethod.POST, "/gui/api/login", LoginTask.class);
        router.add(RequestMethod.GET, "/gui/api/auth-check", AuthCheckTask.class);
    }

    @Override
    public Map<String, Helper<?>> provideTemplateHelpers() {
        Map<String, Helper<?>> helpers = new HashMap<>();
        helpers.put("random", new FakerHelper());
        return helpers;
    }

    @Override
    public RequestFilterAction filter(Request request, ServeEvent serveEvent) {
        ResponseDefinition blocked = AuthFilter.check(request);
        if (blocked != null) {
            return RequestFilterAction.stopWith(blocked);
        }
        return RequestFilterAction.continueWith(request);
    }
}
