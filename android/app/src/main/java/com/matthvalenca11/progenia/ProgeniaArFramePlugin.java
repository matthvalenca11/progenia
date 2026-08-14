package com.matthvalenca11.progenia;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.HandlerThread;
import android.view.Surface;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ProgeniaArFrame")
public class ProgeniaArFramePlugin extends Plugin implements SensorEventListener {
    private static final int SENSOR_DELAY = SensorManager.SENSOR_DELAY_GAME;
    private static final long EMIT_INTERVAL_NANOS = 33_333_333L;

    private final DeviceMotionTranslation translation = new DeviceMotionTranslation();
    private final HandlerThread sensorThread = new HandlerThread("ProgeniaDeviceMotion");

    private SensorManager sensorManager;
    private Handler sensorHandler;
    private Sensor rotationSensor;
    private Sensor linearAccelSensor;
    private Sensor gyroSensor;
    private Sensor gravitySensor;

    private volatile String streamMode = null;
    private volatile int sampleSeq = 0;
    private volatile int rxCount = 0;
    private volatile int lastRxHz = 0;
    private long lastHzTick = System.nanoTime();
    private long lastEmitTimestamp = 0;

    private volatile double pendingW = 1;
    private volatile double pendingX = 0;
    private volatile double pendingY = 0;
    private volatile double pendingZ = 0;

    private float[] latestLinearAccel = new float[3];
    private float[] latestGyro = new float[3];
    private float[] latestGravity = new float[3];
    private boolean hasLinearAccel = false;
    private boolean hasGyro = false;
    private boolean hasGravitySample = false;

    @Override
    public void load() {
        Context context = getContext();
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            rotationSensor = pickSensor(Sensor.TYPE_GAME_ROTATION_VECTOR, Sensor.TYPE_ROTATION_VECTOR);
            linearAccelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
            gyroSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
            gravitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY);
        }
        sensorThread.start();
        sensorHandler = new Handler(sensorThread.getLooper());
    }

    private Sensor pickSensor(int primary, int fallback) {
        Sensor sensor = sensorManager.getDefaultSensor(primary);
        if (sensor == null) {
            sensor = sensorManager.getDefaultSensor(fallback);
        }
        return sensor;
    }

    @PluginMethod
    public void startDeviceMotionStream(PluginCall call) {
        if (sensorManager == null || rotationSensor == null) {
            call.reject("Sensores de orientação não estão disponíveis neste aparelho.");
            return;
        }

        stopStreamInternal();

        streamMode = "native-device-motion";
        sampleSeq = 0;
        rxCount = 0;
        lastRxHz = 0;
        lastHzTick = System.nanoTime();
        lastEmitTimestamp = 0;
        translation.reset();
        translation.setDisplayRotation(getDisplayRotation());

        hasLinearAccel = false;
        hasGyro = false;
        hasGravitySample = false;
        latestLinearAccel[0] = 0;
        latestLinearAccel[1] = 0;
        latestLinearAccel[2] = 0;
        latestGyro[0] = 0;
        latestGyro[1] = 0;
        latestGyro[2] = 0;
        latestGravity[0] = 0;
        latestGravity[1] = 0;
        latestGravity[2] = 0;

        sensorManager.registerListener(this, rotationSensor, SENSOR_DELAY, sensorHandler);
        if (linearAccelSensor != null) {
            sensorManager.registerListener(this, linearAccelSensor, SENSOR_DELAY, sensorHandler);
        }
        if (gyroSensor != null) {
            sensorManager.registerListener(this, gyroSensor, SENSOR_DELAY, sensorHandler);
        }
        if (gravitySensor != null) {
            sensorManager.registerListener(this, gravitySensor, SENSOR_DELAY, sensorHandler);
        }

        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("mode", "native-device-motion");
        call.resolve(result);
    }

    @PluginMethod
    public void resetDeviceMotionTranslation(PluginCall call) {
        translation.reset();
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopStream(PluginCall call) {
        stopStreamInternal();
        call.resolve();
    }

    @PluginMethod
    public void pollOrientation(PluginCall call) {
        JSObject payload = new JSObject();
        payload.put("ok", sampleSeq > 0);
        payload.put("w", pendingW);
        payload.put("x", pendingX);
        payload.put("y", pendingY);
        payload.put("z", pendingZ);
        payload.put("seq", sampleSeq);
        payload.put("rxHz", lastRxHz);
        payload.put("wsTxHz", 0);
        payload.put("wsClients", 0);
        call.resolve(payload);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!"native-device-motion".equals(streamMode)) return;

        switch (event.sensor.getType()) {
            case Sensor.TYPE_LINEAR_ACCELERATION:
                latestLinearAccel[0] = event.values[0];
                latestLinearAccel[1] = event.values[1];
                latestLinearAccel[2] = event.values[2];
                hasLinearAccel = true;
                return;
            case Sensor.TYPE_GYROSCOPE:
                latestGyro[0] = event.values[0];
                latestGyro[1] = event.values[1];
                latestGyro[2] = event.values[2];
                hasGyro = true;
                return;
            case Sensor.TYPE_GRAVITY:
                latestGravity[0] = event.values[0];
                latestGravity[1] = event.values[1];
                latestGravity[2] = event.values[2];
                hasGravitySample = true;
                return;
            case Sensor.TYPE_GAME_ROTATION_VECTOR:
            case Sensor.TYPE_ROTATION_VECTOR:
                break;
            default:
                return;
        }

        float[] quaternion = new float[4];
        SensorManager.getQuaternionFromVector(quaternion, event.values);
        double x = quaternion[0];
        double y = quaternion[1];
        double z = quaternion[2];
        double w = quaternion[3];

        double gyroMagnitude = 0;
        if (hasGyro) {
            gyroMagnitude = Math.sqrt(
                latestGyro[0] * latestGyro[0]
                    + latestGyro[1] * latestGyro[1]
                    + latestGyro[2] * latestGyro[2]
            );
        }

        double ax = hasLinearAccel ? latestLinearAccel[0] : 0;
        double ay = hasLinearAccel ? latestLinearAccel[1] : 0;
        double az = hasLinearAccel ? latestLinearAccel[2] : 0;
        double accelMagnitude = Math.sqrt(ax * ax + ay * ay + az * az);
        boolean stationary = gyroMagnitude < 0.045 && accelMagnitude < 0.025;

        translation.setDisplayRotation(getDisplayRotation());
        double timestampSec = event.timestamp / 1_000_000_000.0;
        double translationPosition = translation.update(ax, ay, az, gyroMagnitude, timestampSec);

        sampleSeq += 1;
        rxCount += 1;
        long now = System.nanoTime();
        if (now - lastHzTick >= 1_000_000_000L) {
            lastRxHz = rxCount;
            rxCount = 0;
            lastHzTick = now;
        }

        pendingW = w;
        pendingX = x;
        pendingY = y;
        pendingZ = z;

        if (event.timestamp - lastEmitTimestamp < EMIT_INTERVAL_NANOS) return;
        lastEmitTimestamp = event.timestamp;

        double gx = hasGravitySample ? latestGravity[0] : 0;
        double gy = hasGravitySample ? latestGravity[1] : 0;
        double gz = hasGravitySample ? latestGravity[2] : 0;

        JSObject gravity = new JSObject();
        gravity.put("x", gx);
        gravity.put("y", gy);
        gravity.put("z", gz);
        JSObject calibration = new JSObject();
        calibration.put("accelAccuracy", 3);
        calibration.put("gyroAccuracy", 3);
        calibration.put("stationary", stationary);
        calibration.put("calibrationReady", true);
        JSObject orientation = new JSObject();
        orientation.put("w", w);
        orientation.put("x", x);
        orientation.put("y", y);
        orientation.put("z", z);
        orientation.put("seq", sampleSeq);
        orientation.put("gravity", gravity);
        orientation.put("calibration", calibration);
        orientation.put("translationPosition", translationPosition);
        notifyListeners("orientation", orientation);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // no-op
    }

    @Override
    protected void handleOnPause() {
        if ("native-device-motion".equals(streamMode)) {
            stopStreamInternal();
        }
    }

    private int getDisplayRotation() {
        WindowManager windowManager = getActivity().getWindowManager();
        if (windowManager == null) return Surface.ROTATION_0;
        switch (windowManager.getDefaultDisplay().getRotation()) {
            case Surface.ROTATION_90:
                return 3;
            case Surface.ROTATION_180:
                return 2;
            case Surface.ROTATION_270:
                return 1;
            default:
                return Surface.ROTATION_0;
        }
    }

    private void stopStreamInternal() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        streamMode = null;
        sampleSeq = 0;
        rxCount = 0;
        lastRxHz = 0;
        translation.reset();
    }
}
