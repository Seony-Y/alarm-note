package com.seony.harualarm;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class ScheduleWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_SELECT_DATE = "com.seony.harualarm.widget.SELECT_DATE";
    private static final String ACTION_CHANGE_MONTH = "com.seony.harualarm.widget.CHANGE_MONTH";
    private static final String EXTRA_DATE = "date";
    private static final String EXTRA_MONTH_DELTA = "month_delta";
    private static final String KEY_SELECTED_DATE = "selected_date";
    private static final String KEY_DISPLAY_MONTH = "display_month";
    private static final int[] ROW_IDS = {
        R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3
    };
    private static final int[] TIME_IDS = {
        R.id.widget_time_1, R.id.widget_time_2, R.id.widget_time_3
    };
    private static final int[] TITLE_IDS = {
        R.id.widget_title_1, R.id.widget_title_2, R.id.widget_title_3
    };
    private static final int[] TOGGLE_ON_IDS = {
        R.id.widget_toggle_on_1, R.id.widget_toggle_on_2, R.id.widget_toggle_on_3
    };
    private static final int[] TOGGLE_OFF_IDS = {
        R.id.widget_toggle_off_1, R.id.widget_toggle_off_2, R.id.widget_toggle_off_3
    };
    private static final int[] DAY_IDS = {
        R.id.widget_day_1, R.id.widget_day_2, R.id.widget_day_3, R.id.widget_day_4,
        R.id.widget_day_5, R.id.widget_day_6, R.id.widget_day_7, R.id.widget_day_8,
        R.id.widget_day_9, R.id.widget_day_10, R.id.widget_day_11, R.id.widget_day_12,
        R.id.widget_day_13, R.id.widget_day_14, R.id.widget_day_15, R.id.widget_day_16,
        R.id.widget_day_17, R.id.widget_day_18, R.id.widget_day_19, R.id.widget_day_20,
        R.id.widget_day_21, R.id.widget_day_22, R.id.widget_day_23, R.id.widget_day_24,
        R.id.widget_day_25, R.id.widget_day_26, R.id.widget_day_27, R.id.widget_day_28,
        R.id.widget_day_29, R.id.widget_day_30, R.id.widget_day_31, R.id.widget_day_32,
        R.id.widget_day_33, R.id.widget_day_34, R.id.widget_day_35, R.id.widget_day_36,
        R.id.widget_day_37, R.id.widget_day_38, R.id.widget_day_39, R.id.widget_day_40,
        R.id.widget_day_41, R.id.widget_day_42
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(widgetId, createViews(context));
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        SharedPreferences preferences = preferences(context);
        if (ACTION_SELECT_DATE.equals(action)) {
            String date = intent.getStringExtra(EXTRA_DATE);
            if (date != null) {
                preferences.edit()
                    .putString(KEY_SELECTED_DATE, date)
                    .putString(KEY_DISPLAY_MONTH, date.substring(0, 7))
                    .apply();
                updateAll(context);
            }
        } else if (ACTION_CHANGE_MONTH.equals(action)) {
            Calendar month = parseDate(displayMonth(preferences) + "-01");
            month.add(Calendar.MONTH, intent.getIntExtra(EXTRA_MONTH_DELTA, 0));
            String selectedDate = dateKey(month);
            preferences.edit()
                .putString(KEY_SELECTED_DATE, selectedDate)
                .putString(KEY_DISPLAY_MONTH, selectedDate.substring(0, 7))
                .apply();
            updateAll(context);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, ScheduleWidgetProvider.class);
        for (int widgetId : manager.getAppWidgetIds(provider)) {
            manager.updateAppWidget(widgetId, createViews(context));
        }
    }

    private static RemoteViews createViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.schedule_widget);
        SharedPreferences preferences = preferences(context);
        String selectedDate = preferences.getString(KEY_SELECTED_DATE, dateKey(Calendar.getInstance()));
        JSONArray items = readItems(preferences);

        populateCalendar(context, views, preferences, selectedDate, items);
        populateScheduleList(context, views, selectedDate, items);
        views.setTextViewText(
            R.id.widget_selected_date,
            new SimpleDateFormat("M월 d일 EEEE", Locale.KOREAN).format(parseDate(selectedDate).getTime())
        );
        views.setOnClickPendingIntent(
            R.id.widget_add,
            widgetAction(context, "new", null, false, selectedDate, 10)
        );
        views.setOnClickPendingIntent(
            R.id.widget_previous_month,
            widgetBroadcast(context, ACTION_CHANGE_MONTH, null, -1, 901)
        );
        views.setOnClickPendingIntent(
            R.id.widget_next_month,
            widgetBroadcast(context, ACTION_CHANGE_MONTH, null, 1, 902)
        );
        return views;
    }

    private static void populateCalendar(
        Context context,
        RemoteViews views,
        SharedPreferences preferences,
        String selectedDate,
        JSONArray items
    ) {
        String displayMonth = displayMonth(preferences);
        Calendar firstDay = parseDate(displayMonth + "-01");
        views.setTextViewText(
            R.id.widget_month,
            new SimpleDateFormat("yyyy년 M월", Locale.KOREAN).format(firstDay.getTime())
        );

        int visibleMonth = firstDay.get(Calendar.MONTH);
        firstDay.add(Calendar.DAY_OF_MONTH, -(firstDay.get(Calendar.DAY_OF_WEEK) - 1));
        String today = dateKey(Calendar.getInstance());
        for (int index = 0; index < DAY_IDS.length; index++) {
            String date = dateKey(firstDay);
            boolean selected = date.equals(selectedDate);
            boolean isToday = date.equals(today);
            boolean inMonth = firstDay.get(Calendar.MONTH) == visibleMonth;
            int dayOfWeek = firstDay.get(Calendar.DAY_OF_WEEK);
            String marker = hasSchedule(items, date) ? "·" : "";
            views.setTextViewText(DAY_IDS[index], firstDay.get(Calendar.DAY_OF_MONTH) + marker);
            views.setInt(
                DAY_IDS[index],
                "setBackgroundResource",
                selected
                    ? R.drawable.widget_day_selected
                    : isToday ? R.drawable.widget_day_today : android.R.color.transparent
            );
            views.setTextColor(
                DAY_IDS[index],
                selected
                    ? Color.parseColor("#191C22")
                    : calendarTextColor(dayOfWeek, inMonth)
            );
            views.setOnClickPendingIntent(
                DAY_IDS[index],
                widgetBroadcast(context, ACTION_SELECT_DATE, date, 0, 1000 + index)
            );
            firstDay.add(Calendar.DAY_OF_MONTH, 1);
        }
    }

    private static void populateScheduleList(
        Context context,
        RemoteViews views,
        String selectedDate,
        JSONArray items
    ) {
        int row = 0;
        for (int index = 0; index < items.length() && row < ROW_IDS.length; index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null || !selectedDate.equals(item.optString("date"))) continue;

            boolean enabled = item.optBoolean("enabled");
            views.setTextViewText(TIME_IDS[row], item.optString("time"));
            views.setTextViewText(TITLE_IDS[row], item.optString("title"));
            views.setViewVisibility(ROW_IDS[row], View.VISIBLE);
            views.setViewVisibility(TOGGLE_ON_IDS[row], enabled ? View.VISIBLE : View.GONE);
            views.setViewVisibility(TOGGLE_OFF_IDS[row], enabled ? View.GONE : View.VISIBLE);
            PendingIntent toggle = widgetAction(
                context,
                "alarm",
                item.optString("id"),
                !enabled,
                selectedDate,
                100 + row
            );
            views.setOnClickPendingIntent(TOGGLE_ON_IDS[row], toggle);
            views.setOnClickPendingIntent(TOGGLE_OFF_IDS[row], toggle);
            row++;
        }

        views.setViewVisibility(R.id.widget_empty, row == 0 ? View.VISIBLE : View.GONE);
        while (row < ROW_IDS.length) {
            views.setViewVisibility(ROW_IDS[row], View.GONE);
            row++;
        }
    }

    private static PendingIntent widgetBroadcast(
        Context context,
        String action,
        String date,
        int monthDelta,
        int requestCode
    ) {
        Intent intent = new Intent(context, ScheduleWidgetProvider.class)
            .setAction(action)
            .setData(Uri.parse("haru-widget://action/" + requestCode));
        if (date != null) intent.putExtra(EXTRA_DATE, date);
        intent.putExtra(EXTRA_MONTH_DELTA, monthDelta);
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static PendingIntent widgetAction(
        Context context,
        String path,
        String id,
        boolean enabled,
        String date,
        int requestCode
    ) {
        Uri.Builder uri = new Uri.Builder()
            .scheme("com.seony.harualarm")
            .authority("widget")
            .appendPath(path)
            .appendQueryParameter("date", date);
        if (id != null) {
            uri.appendQueryParameter("id", id);
            uri.appendQueryParameter("enabled", Boolean.toString(enabled));
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, uri.build(), context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(ScheduleWidgetPlugin.PREFERENCES, Context.MODE_PRIVATE);
    }

    private static JSONArray readItems(SharedPreferences preferences) {
        try {
            return new JSONArray(preferences.getString("items", "[]"));
        } catch (JSONException exception) {
            return new JSONArray();
        }
    }

    private static boolean hasSchedule(JSONArray items, String date) {
        for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item != null && date.equals(item.optString("date"))) return true;
        }
        return false;
    }

    private static String displayMonth(SharedPreferences preferences) {
        return preferences.getString(
            KEY_DISPLAY_MONTH,
            new SimpleDateFormat("yyyy-MM", Locale.US).format(Calendar.getInstance().getTime())
        );
    }

    private static Calendar parseDate(String value) {
        String[] parts = value.split("-");
        Calendar date = Calendar.getInstance();
        date.clear();
        date.set(
            Integer.parseInt(parts[0]),
            Integer.parseInt(parts[1]) - 1,
            Integer.parseInt(parts[2])
        );
        return date;
    }

    private static String dateKey(Calendar date) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date.getTime());
    }

    private static int calendarTextColor(int dayOfWeek, boolean inMonth) {
        if (!inMonth) return Color.parseColor("#5E636D");
        if (dayOfWeek == Calendar.SUNDAY) return Color.parseColor("#E74D59");
        if (dayOfWeek == Calendar.SATURDAY) return Color.parseColor("#4C9BE8");
        return Color.parseColor("#E2E4E8");
    }
}