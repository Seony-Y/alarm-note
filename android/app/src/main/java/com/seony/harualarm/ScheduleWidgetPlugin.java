package com.seony.harualarm;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Iterator;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "ScheduleWidget")
public class ScheduleWidgetPlugin extends Plugin {
    static final String PREFERENCES = "schedule_widget";
    static final String KEY_PENDING_TOGGLES = "pending_toggles";
    static final String KEY_NOTIFICATION_DEFINITIONS = "notification_definitions";

    @PluginMethod
    public void update(PluginCall call) {
        JSArray items = call.getArray("items");
        JSArray notifications = call.getArray("notifications");
        boolean authenticated = call.getBoolean("authenticated", false);
        SharedPreferences.Editor editor = getContext()
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit();
        editor
            .putBoolean("authenticated", authenticated)
            .putString("items", items == null ? "[]" : items.toString())
            .putString(
                KEY_NOTIFICATION_DEFINITIONS,
                notifications == null ? "[]" : notifications.toString()
            );
        if (!authenticated) editor.remove(KEY_PENDING_TOGGLES);
        editor.apply();
        ScheduleWidgetProvider.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void consumeToggles(PluginCall call) {
        SharedPreferences preferences = getContext()
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        JSArray toggles = new JSArray();
        try {
            JSONObject pending = new JSONObject(
                preferences.getString(KEY_PENDING_TOGGLES, "{}")
            );
            Iterator<String> scheduleIds = pending.keys();
            while (scheduleIds.hasNext()) {
                String scheduleId = scheduleIds.next();
                JSObject toggle = new JSObject();
                toggle.put("id", scheduleId);
                toggle.put("enabled", pending.optBoolean(scheduleId));
                toggles.put(toggle);
            }
        } catch (JSONException exception) {
            preferences.edit().remove(KEY_PENDING_TOGGLES).apply();
        }
        preferences.edit().remove(KEY_PENDING_TOGGLES).commit();
        JSObject result = new JSObject();
        result.put("toggles", toggles);
        call.resolve(result);
    }
}