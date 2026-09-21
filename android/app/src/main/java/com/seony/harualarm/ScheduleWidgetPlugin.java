package com.seony.harualarm;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "ScheduleWidget")
public class ScheduleWidgetPlugin extends Plugin {
    static final String PREFERENCES = "schedule_widget";

    @PluginMethod
    public void update(PluginCall call) {
        JSArray items = call.getArray("items");
        SharedPreferences.Editor editor = getContext()
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .clear();

        int count = items == null ? 0 : Math.min(items.length(), 2);
        try {
            for (int index = 0; index < count; index++) {
                JSONObject item = items.getJSONObject(index);
                editor.putString("id_" + index, item.optString("id"));
                editor.putString("date_" + index, item.optString("date"));
                editor.putString("time_" + index, item.optString("time"));
                editor.putString("title_" + index, item.optString("title"));
                editor.putBoolean("enabled_" + index, item.optBoolean("enabled"));
            }
        } catch (JSONException exception) {
            call.reject("위젯 일정을 처리할 수 없습니다.", exception);
            return;
        }

        editor.putInt("count", count).apply();
        ScheduleWidgetProvider.updateAll(getContext());
        call.resolve();
    }
}