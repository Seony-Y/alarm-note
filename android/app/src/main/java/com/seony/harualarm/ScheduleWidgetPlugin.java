package com.seony.harualarm;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScheduleWidget")
public class ScheduleWidgetPlugin extends Plugin {
    static final String PREFERENCES = "schedule_widget";

    @PluginMethod
    public void update(PluginCall call) {
        JSArray items = call.getArray("items");
        SharedPreferences.Editor editor = getContext()
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit();
        editor.putString("items", items == null ? "[]" : items.toString()).apply();
        ScheduleWidgetProvider.updateAll(getContext());
        call.resolve();
    }
}