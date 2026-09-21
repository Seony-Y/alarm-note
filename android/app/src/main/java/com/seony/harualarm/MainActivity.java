package com.seony.harualarm;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(DeviceAlarmPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
