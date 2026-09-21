package com.seony.harualarm;

import android.content.Intent;
import android.provider.AlarmClock;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import org.json.JSONException;

@CapacitorPlugin(name = "DeviceAlarm")
public class DeviceAlarmPlugin extends Plugin {
    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        String message = call.getString("message", "하루알람");

        if (hour == null || minute == null) {
            call.reject("알람 시간이 필요합니다.");
            return;
        }

        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_MESSAGE, message)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, false);

        JSArray days = call.getArray("days");
        if (days != null && days.length() > 0) {
            ArrayList<Integer> repeatDays = new ArrayList<>();
            try {
                for (int index = 0; index < days.length(); index++) {
                    repeatDays.add(days.getInt(index));
                }
            } catch (JSONException exception) {
                call.reject("반복 요일을 처리할 수 없습니다.", exception);
                return;
            }
            intent.putExtra(AlarmClock.EXTRA_DAYS, repeatDays);
        }

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("휴대폰에서 기본 시계 앱을 찾을 수 없습니다.");
            return;
        }

        getActivity().startActivity(intent);
        call.resolve();
    }
}
