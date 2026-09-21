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

public class ScheduleWidgetProvider extends AppWidgetProvider {
    private static final int[] ROW_IDS = {
        R.id.widget_row_1,
        R.id.widget_row_2
    };
    private static final int[] TIME_IDS = {
        R.id.widget_time_1,
        R.id.widget_time_2
    };
    private static final int[] TITLE_IDS = {
        R.id.widget_title_1,
        R.id.widget_title_2
    };
    private static final int[] TOGGLE_ON_IDS = {
        R.id.widget_toggle_on_1,
        R.id.widget_toggle_on_2
    };
    private static final int[] TOGGLE_OFF_IDS = {
        R.id.widget_toggle_off_1,
        R.id.widget_toggle_off_2
    };
    private static final int[] DAY_IDS = {
        R.id.widget_day_1,
        R.id.widget_day_2,
        R.id.widget_day_3,
        R.id.widget_day_4,
        R.id.widget_day_5,
        R.id.widget_day_6,
        R.id.widget_day_7
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(widgetId, createViews(context));
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, ScheduleWidgetProvider.class);
        int[] widgetIds = manager.getAppWidgetIds(provider);
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(widgetId, createViews(context));
        }
    }

    private static RemoteViews createViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.schedule_widget);
        SharedPreferences preferences = context.getSharedPreferences(
            ScheduleWidgetPlugin.PREFERENCES,
            Context.MODE_PRIVATE
        );
        int count = preferences.getInt("count", 0);

        populateWeek(views);
        views.setOnClickPendingIntent(
            R.id.widget_add,
            widgetAction(context, "new", null, false, 10)
        );
        views.setViewVisibility(R.id.widget_empty, count == 0 ? View.VISIBLE : View.GONE);
        for (int index = 0; index < ROW_IDS.length; index++) {
            int rowId = ROW_IDS[index];
            if (index < count) {
                String date = preferences.getString("date_" + index, "");
                String time = preferences.getString("time_" + index, "");
                String title = preferences.getString("title_" + index, "");
                String id = preferences.getString("id_" + index, "");
                boolean enabled = preferences.getBoolean("enabled_" + index, false);
                views.setTextViewText(TIME_IDS[index], time);
                views.setTextViewText(
                    TITLE_IDS[index],
                    ("오늘".equals(date) ? "" : date + "  ") + title
                );
                views.setViewVisibility(rowId, View.VISIBLE);
                views.setViewVisibility(
                    TOGGLE_ON_IDS[index],
                    enabled ? View.VISIBLE : View.GONE
                );
                views.setViewVisibility(
                    TOGGLE_OFF_IDS[index],
                    enabled ? View.GONE : View.VISIBLE
                );
                PendingIntent toggle = widgetAction(
                    context,
                    "alarm",
                    id,
                    !enabled,
                    100 + index
                );
                views.setOnClickPendingIntent(TOGGLE_ON_IDS[index], toggle);
                views.setOnClickPendingIntent(TOGGLE_OFF_IDS[index], toggle);
            } else {
                views.setViewVisibility(rowId, View.GONE);
            }
        }

        Intent openIntent = new Intent(context, MainActivity.class);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.schedule_widget, openPendingIntent);
        return views;
    }

    private static void populateWeek(RemoteViews views) {
        Calendar today = Calendar.getInstance();
        views.setTextViewText(
            R.id.widget_month,
            new SimpleDateFormat("M월 d일 EEEE", Locale.KOREAN).format(today.getTime())
        );

        Calendar day = (Calendar) today.clone();
        int daysSinceMonday = (day.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        day.add(Calendar.DAY_OF_MONTH, -daysSinceMonday);
        String[] weekdays = { "월", "화", "수", "목", "금", "토", "일" };
        for (int index = 0; index < DAY_IDS.length; index++) {
            boolean isToday =
                day.get(Calendar.YEAR) == today.get(Calendar.YEAR) &&
                day.get(Calendar.DAY_OF_YEAR) == today.get(Calendar.DAY_OF_YEAR);
            views.setTextViewText(
                DAY_IDS[index],
                weekdays[index] + "\n" + day.get(Calendar.DAY_OF_MONTH)
            );
            views.setInt(
                DAY_IDS[index],
                "setBackgroundResource",
                isToday ? R.drawable.widget_day_today : android.R.color.transparent
            );
            views.setTextColor(DAY_IDS[index], Color.parseColor(isToday ? "#FFFFFF" : "#77716A"));
            day.add(Calendar.DAY_OF_MONTH, 1);
        }
    }

    private static PendingIntent widgetAction(
        Context context,
        String path,
        String id,
        boolean enabled,
        int requestCode
    ) {
        Uri.Builder uri = new Uri.Builder()
            .scheme("com.seony.harualarm")
            .authority("widget")
            .appendPath(path);
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
}