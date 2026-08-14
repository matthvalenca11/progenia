package com.matthvalenca11.progenia;

/**
 * ZUPT-style push/pull integrator — mirrors the iOS CoreMotion path in ProgeniaArFramePlugin.
 */
final class DeviceMotionTranslation {
    private static final double ROTATION_BLOCK_RAD_S = 0.12;
    private static final double ROTATION_SETTLE_SECONDS = 0.25;

    private double biasX = 0;
    private double biasY = 0;
    private double biasZ = 0;
    private double filteredX = 0;
    private double filteredY = 0;
    private double filteredZ = 0;
    private double velocity = 0;
    private double position = 0;
    private double lastTimestamp = 0;
    private double quietSince = 0;
    private double translationResumeAt = 0;
    private boolean gestureActive = false;
    private int displayRotation = 0;

    void reset() {
        biasX = 0;
        biasY = 0;
        biasZ = 0;
        filteredX = 0;
        filteredY = 0;
        filteredZ = 0;
        velocity = 0;
        position = 0;
        lastTimestamp = 0;
        quietSince = 0;
        translationResumeAt = 0;
        gestureActive = false;
    }

    void setDisplayRotation(int rotation) {
        displayRotation = rotation;
    }

    double update(double ax, double ay, double az, double gyroMagnitude, double timestampSec) {
        if (lastTimestamp <= 0) {
            lastTimestamp = timestampSec;
            return position;
        }

        double dt = Math.min(0.04, timestampSec - lastTimestamp);
        lastTimestamp = timestampSec;
        if (dt <= 0) return position;

        // Turning the phone produces linear-acceleration transients even when
        // it has not translated. Never integrate them into slice depth.
        if (gyroMagnitude >= ROTATION_BLOCK_RAD_S) {
            translationResumeAt = timestampSec + ROTATION_SETTLE_SECONDS;
            velocity = 0;
            gestureActive = false;
            filteredX = 0;
            filteredY = 0;
            filteredZ = 0;
            quietSince = 0;
            return position;
        }
        if (timestampSec < translationResumeAt) {
            velocity = 0;
            gestureActive = false;
            filteredX = 0;
            filteredY = 0;
            filteredZ = 0;
            return position;
        }

        double unbiasedX = ax - biasX;
        double unbiasedY = ay - biasY;
        double unbiasedZ = az - biasZ;
        double accelMagnitude = Math.sqrt(
            unbiasedX * unbiasedX + unbiasedY * unbiasedY + unbiasedZ * unbiasedZ
        );
        boolean quietCandidate = gyroMagnitude < 0.08 && accelMagnitude < 0.045;
        if (quietCandidate) {
            if (quietSince == 0) quietSince = timestampSec;
        } else {
            quietSince = 0;
        }
        double quietDuration = quietSince > 0 ? timestampSec - quietSince : 0;

        if (quietDuration >= 0.35) {
            biasX += (ax - biasX) * 0.025;
            biasY += (ay - biasY) * 0.025;
            biasZ += (az - biasZ) * 0.025;
            unbiasedX = ax - biasX;
            unbiasedY = ay - biasY;
            unbiasedZ = az - biasZ;
        }

        filteredX += (unbiasedX - filteredX) * 0.58;
        filteredY += (unbiasedY - filteredY) * 0.58;
        filteredZ += (unbiasedZ - filteredZ) * 0.58;

        double a;
        switch (displayRotation) {
            case 2: // upside down
                a = filteredY;
                break;
            case 3: // landscape left (90°)
                a = filteredX;
                break;
            case 1: // landscape right (270°)
                a = -filteredX;
                break;
            default: // portrait
                a = -filteredY;
                break;
        }
        if (Math.abs(a) < 0.022) a = 0;

        if (!gestureActive) {
            if (Math.abs(a) < 0.16) return position;
            gestureActive = true;
        }

        if (quietDuration >= 0.12) {
            velocity = 0;
            gestureActive = false;
            filteredX = 0;
            filteredY = 0;
            filteredZ = 0;
            return position;
        }

        velocity += a * dt;
        if (a * velocity < 0) {
            velocity *= Math.exp(-12.0 * dt);
            if (Math.abs(velocity) < 0.012) velocity = 0;
        } else {
            velocity *= Math.exp(-0.65 * dt);
        }

        velocity = Math.min(0.90, Math.max(-0.90, velocity));
        position += velocity * dt * 1.5;
        if (position > 0.15) {
            position = 0.15;
            velocity = 0;
        } else if (position < -0.15) {
            position = -0.15;
            velocity = 0;
        }
        return position;
    }
}
