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
        var sequence = mBatchQueue.getPendingCount() + 1;
        var live = buildLivePreview(sequence);
        var daily = buildDailyPreview(sequence);

        return [
            "LIVE",
            "FC " + formatInteger(live["heartRate"]) + " bpm",
            "Stress " + formatInteger(live["stress"]),
            "Resp " + formatInteger(live["respiration"]) + " rpm",
            "SpO2 " + formatInteger(live["spo2"]) + "%",
            "Timer " + live["timerState"],
            "Temps " + formatElapsedSeconds(live["elapsedTime"]),
            "Dist " + formatDistanceMeters(live["elapsedDistance"]),
            "Speed " + formatOneDecimal(live["speed"]) + " m/s",
            "Cad " + formatInteger(live["cadence"]) + " rpm",
            "JOUR",
            "Pas " + formatInteger(daily["steps"]) + "/" + formatInteger(daily["stepGoal"]),
            "Cal " + formatInteger(daily["calories"]) + " kcal",
            "Dist " + formatDistanceMeters(daily["distance"]),
            "Etages +" + formatInteger(daily["floorsClimbed"]) + " -" + formatInteger(daily["floorsDescended"]),
            "Move " + formatInteger(daily["moveBarLevel"]),
            "Recup " + formatInteger(daily["recovery"]) + " h",
            "RHR " + formatInteger(daily["restingHeartRate"]) + " bpm",
            "RHR7 " + formatInteger(daily["averageRestingHeartRate"]) + " bpm",
            "VO2 run " + formatInteger(daily["vo2maxRunning"]),
            "VO2 velo " + formatInteger(daily["vo2maxCycling"]),
            "BodyBat " + formatInteger(daily["bodyBattery"]) + "%"
        ];
    }

    function buildLiveItems(timestamp, sequence) {
        var live = buildLivePreview(sequence);

        return [
            buildMetric(timestamp, "heart_rate_bpm", live["heartRate"], "bpm", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "stress_score", live["stress"], null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "respiration_rate_bpm", live["respiration"], "rpm", GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "spo2_percent", live["spo2"], "%", GarminContract.SOURCE_SENSOR, GarminContract.QUALITY_DERIVED),
            buildMetric(timestamp, "activity_timer_state", live["timerState"], null, GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_DERIVED),
            buildMetric(timestamp, "activity_elapsed_time_s", live["elapsedTime"], "s", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "activity_elapsed_distance_m", live["elapsedDistance"], "m", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "activity_current_speed_mps", live["speed"], "m/s", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE),
            buildMetric(timestamp, "activity_current_cadence_rpm", live["cadence"], "rpm", GarminContract.SOURCE_ACTIVITY, GarminContract.QUALITY_LIVE)
        ];
    }

    function buildLivePreview(sequence) {
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
        return {
            "heartRate" => heartRate,
            "stress" => stress,
            "respiration" => respiration,
            "spo2" => spo2,
            "timerState" => timerState,
            "elapsedTime" => elapsedTime,
            "elapsedDistance" => elapsedDistance,
            "speed" => speed,
            "cadence" => cadence
        };
    }

    function buildDailySnapshot(timestamp, sequence) {
        var daily = buildDailyPreview(sequence);

        return new SnapshotRecord(
            "fenix-daily-" + sequence,
            GarminContract.SNAPSHOT_DAILY,
            timestamp,
            [
                buildMetric(timestamp, "steps", daily["steps"], null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "step_goal", daily["stepGoal"], null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "calories_kcal", daily["calories"], "kcal", GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "distance_m", daily["distance"], "m", GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "floors_climbed", daily["floorsClimbed"], null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "floors_descended", daily["floorsDescended"], null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "move_bar_level", daily["moveBarLevel"], null, GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "time_to_recovery_h", daily["recovery"], "h", GarminContract.SOURCE_ACTIVITY_MONITOR, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "resting_heart_rate_bpm", daily["restingHeartRate"], "bpm", GarminContract.SOURCE_USER_PROFILE, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "average_resting_heart_rate_bpm", daily["averageRestingHeartRate"], "bpm", GarminContract.SOURCE_USER_PROFILE, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "vo2max_running", daily["vo2maxRunning"], null, GarminContract.SOURCE_USER_PROFILE, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "vo2max_cycling", daily["vo2maxCycling"], null, GarminContract.SOURCE_USER_PROFILE, GarminContract.QUALITY_SNAPSHOT),
                buildMetric(timestamp, "body_battery_percent", daily["bodyBattery"], "%", GarminContract.SOURCE_SENSOR_HISTORY, GarminContract.QUALITY_HISTORY)
            ]
        );
    }

    function buildDailyPreview(sequence) {
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
        var bodyBattery = 78;

        mLatestSteps = steps;
        mLatestRecovery = recovery;

        return {
            "steps" => steps,
            "stepGoal" => stepGoal,
            "calories" => calories,
            "distance" => distance,
            "floorsClimbed" => floorsClimbed,
            "floorsDescended" => floorsDescended,
            "moveBarLevel" => moveBarLevel,
            "recovery" => recovery,
            "restingHeartRate" => restingHeartRate,
            "averageRestingHeartRate" => averageRestingHeartRate,
            "vo2maxRunning" => vo2maxRunning,
            "vo2maxCycling" => vo2maxCycling,
            "bodyBattery" => bodyBattery
        };
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

    function formatInteger(value) {
        if (value == null) {
            return "--";
        }

        return value.format("%.0f");
    }

    function formatOneDecimal(value) {
        if (value == null) {
            return "--";
        }

        return value.format("%.1f");
    }

    function formatDistanceMeters(value) {
        if (value == null) {
            return "--";
        }

        if (value >= 1000) {
            return (value / 1000.0).format("%.1f") + " km";
        }

        return value.format("%.0f") + " m";
    }

    function formatElapsedSeconds(value) {
        if (value == null) {
            return "--:--";
        }

        var totalSeconds = value;
        var hours = totalSeconds / 3600;
        var minutes = (totalSeconds % 3600) / 60;
        var seconds = totalSeconds % 60;

        if (hours > 0) {
            return hours.format("%.0f") + ":" + minutes.format("%02.0f") + ":" + seconds.format("%02.0f");
        }

        return minutes.format("%02.0f") + ":" + seconds.format("%02.0f");
    }
}
