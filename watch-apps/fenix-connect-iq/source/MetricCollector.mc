using Toybox.Activity;
using Toybox.ActivityMonitor;
using Toybox.Sensor;
using Toybox.System;
using Toybox.UserProfile;

class MetricCollector {
    var mBatchQueue;
    var mSampleSequence;
    var mLatestHeartRate;
    var mLatestSteps;
    var mLatestRecovery;

    function initialize(batchQueue) {
        mBatchQueue = batchQueue;
        mSampleSequence = 0;
        mLatestHeartRate = 0;
        mLatestSteps = 0;
        mLatestRecovery = 0;
    }

    function captureBatch() {
        var timestamp = buildTimestamp();
        var sequence = mBatchQueue.nextSequence();
        var liveItems = buildLiveItems(timestamp, sequence);
        var snapshot = buildDailySnapshot(timestamp, sequence);
        var items = [];

        for (var liveIndex = 0; liveIndex < liveItems.size(); liveIndex += 1) {
            items.add(liveItems[liveIndex]);
        }

        items.add(snapshot);

        return new BatchEnvelopeRecord(
            "fenix-batch-" + sequence,
            sequence,
            timestamp,
            snapshot.items[snapshot.items.size() - 1].sampleId,
            items
        );
    }

    function getDisplayLines() {
        return [
            "HR " + mLatestHeartRate + " bpm",
            "Steps " + mLatestSteps,
            "Recovery " + mLatestRecovery + " h"
        ];
    }

    function buildLiveItems(timestamp, sequence) {
        var activityInfo = Activity.getActivityInfo();
        var dailyInfo = ActivityMonitor.getInfo();
        var sensorInfo = Sensor.getInfo();
        var heartRate = resolveHeartRate(activityInfo, sequence);
        var stress = resolveStressScore(dailyInfo, sequence);
        var respiration = resolveRespirationRate(dailyInfo, sequence);
        var spo2 = resolveOxygenSaturation(sensorInfo);
        var elapsedTime = resolveElapsedTime(activityInfo, sequence);
        var elapsedDistance = resolveElapsedDistance(activityInfo, sequence);
        var speed = resolveCurrentSpeed(activityInfo, sequence);
        var cadence = resolveCurrentCadence(activityInfo, sequence);
        var timerState = resolveTimerState(activityInfo);

        if (dailyInfo != null && dailyInfo.steps != null) {
            mLatestSteps = dailyInfo.steps;
        }

        mLatestHeartRate = heartRate;

        return [
            buildMetric(timestamp, "heart_rate_bpm", heartRate, "bpm", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "stress_score", stress, null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "respiration_rate_bpm", respiration, "rpm", GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "spo2_percent", spo2, "%", GarminContract.SOURCE_SENSOR, GarminContract.QUALITY_DERIVED),
            buildMetric(timestamp, "activity_timer_state", timerState, null, GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_DERIVED),
            buildMetric(timestamp, "activity_elapsed_time_s", elapsedTime, "s", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "activity_elapsed_distance_m", elapsedDistance, "m", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "activity_current_speed_mps", speed, "m/s", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "activity_current_cadence_rpm", cadence, "rpm", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE)
        ];
    }

    function buildDailySnapshot(timestamp, sequence) {
        var dailyInfo = ActivityMonitor.getInfo();
        var profile = UserProfile.getProfile();
        var steps = (dailyInfo != null && dailyInfo.steps != null) ? dailyInfo.steps : 7800 + sequence;
        var stepGoal = (dailyInfo != null && dailyInfo.stepGoal != null) ? dailyInfo.stepGoal : 10000;
        var calories = (dailyInfo != null && dailyInfo.calories != null) ? dailyInfo.calories : 610;
        var distance = (dailyInfo != null && dailyInfo.distance != null) ? dailyInfo.distance : 6200;
        var floorsClimbed = (dailyInfo != null && dailyInfo.floorsClimbed != null) ? dailyInfo.floorsClimbed : 8;
        var floorsDescended = (dailyInfo != null && dailyInfo.floorsDescended != null) ? dailyInfo.floorsDescended : 7;
        var moveBarLevel = (dailyInfo != null && dailyInfo.moveBarLevel != null) ? dailyInfo.moveBarLevel : 1;
        var recovery = (dailyInfo != null && dailyInfo.timeToRecovery != null) ? dailyInfo.timeToRecovery : 18;
        var restingHeartRate = (profile != null && profile.restingHeartRate != null) ? profile.restingHeartRate : 52;
        var averageRestingHeartRate = (profile != null && profile.averageRestingHeartRate != null) ? profile.averageRestingHeartRate : 55;
        var vo2maxRunning = (profile != null && profile.vo2maxRunning != null) ? profile.vo2maxRunning : 51;
        var vo2maxCycling = (profile != null && profile.vo2maxCycling != null) ? profile.vo2maxCycling : 49;

        mLatestSteps = steps;
        mLatestRecovery = recovery;

        return new SnapshotRecord(
            "fenix-daily-" + sequence,
            GarminContract.SNAPSHOT_DAILY,
            timestamp,
            [
                buildMetric(timestamp, "steps", steps, null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "step_goal", stepGoal, null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "calories_kcal", calories, "kcal", GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "distance_m", distance, "m", GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "floors_climbed", floorsClimbed, null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "floors_descended", floorsDescended, null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "move_bar_level", moveBarLevel, null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "time_to_recovery_h", recovery, "h", GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "resting_heart_rate_bpm", restingHeartRate, "bpm", GarminContract.SOURCE_USER_PROFILE, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "average_resting_heart_rate_bpm", averageRestingHeartRate, "bpm", GarminContract.SOURCE_USER_PROFILE, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "vo2max_running", vo2maxRunning, null, GarminContract.SOURCE_USER_PROFILE, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "vo2max_cycling", vo2maxCycling, null, GarminContract.SOURCE_USER_PROFILE, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "body_battery_percent", 78, "%", GarminContract.SOURCE_SENSOR_HISTORY, GarminContract.QUALITY_HISTORY)
            ]
        );
    }

    function buildMetric(timestamp, metricKey, metricValue, metricUnit, sourceDomain, quality) {
        mSampleSequence += 1;
        return new MetricRecord(
            "sample-" + mSampleSequence,
            timestamp,
            metricKey,
            metricValue,
            metricUnit,
            sourceDomain,
            quality
        );
    }

    function buildTimestamp() {
        var clock = System.getClockTime();
        return padNumber(clock.hour) + ":" + padNumber(clock.min) + ":" + padNumber(clock.sec);
    }

    function padNumber(value) {
        return (value < 10 ? "0" : "") + value;
    }

    function resolveHeartRate(activityInfo, sequence) {
        if (activityInfo != null && activityInfo.currentHeartRate != null) {
            return activityInfo.currentHeartRate;
        }

        return 136 + (sequence % 6);
    }

    function resolveStressScore(dailyInfo, sequence) {
        if (dailyInfo != null && dailyInfo.stressScore != null) {
            return dailyInfo.stressScore;
        }

        return 20 + (sequence % 4);
    }

    function resolveRespirationRate(dailyInfo, sequence) {
        if (dailyInfo != null && dailyInfo.respirationRate != null) {
            return dailyInfo.respirationRate;
        }

        return 15 + (sequence % 3);
    }

    function resolveOxygenSaturation(sensorInfo) {
        if (sensorInfo != null && sensorInfo.oxygenSaturation != null) {
            return sensorInfo.oxygenSaturation;
        }

        return 97;
    }

    function resolveElapsedTime(activityInfo, sequence) {
        if (activityInfo != null && activityInfo.elapsedTime != null) {
            return activityInfo.elapsedTime;
        }

        return 1200 + (sequence * 45);
    }

    function resolveElapsedDistance(activityInfo, sequence) {
        if (activityInfo != null && activityInfo.elapsedDistance != null) {
            return activityInfo.elapsedDistance;
        }

        return 3000 + (sequence * 160);
    }

    function resolveCurrentSpeed(activityInfo, sequence) {
        if (activityInfo != null && activityInfo.currentSpeed != null) {
            return activityInfo.currentSpeed;
        }

        return 3.10 + (sequence * 0.05);
    }

    function resolveCurrentCadence(activityInfo, sequence) {
        if (activityInfo != null && activityInfo.currentCadence != null) {
            return activityInfo.currentCadence;
        }

        return 168 + (sequence % 5);
    }

    function resolveTimerState(activityInfo) {
        if (activityInfo != null && activityInfo.elapsedTime != null && activityInfo.elapsedTime > 0) {
            return "running";
        }

        return "idle";
    }
}
