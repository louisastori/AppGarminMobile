using Toybox.System;
using Toybox.Time;
using Toybox.Time.Gregorian;

module GarminContract {
    const PROTOCOL_VERSION = 1;
    const DEVICE_ID = "fenix7pro-ciq";
    const DEVICE_KIND = "fenix";
    const DEVICE_MODEL = "fenix 7 Pro";
    const APP_VERSION = "0.1.0-alpha";
    const IDLE_BACKGROUND_SYNC_INTERVAL_SECONDS = 1800;
    const ACTIVITY_PHONE_SYNC_INTERVAL_SECONDS = 60;
    const SNAPSHOT_DAILY = "daily";
    const SNAPSHOT_ACTIVITY = "activity";
    const SNAPSHOT_PROFILE = "profile";
    const QUALITY_LIVE = "live";
    const QUALITY_HISTORY = "history";
    const QUALITY_SNAPSHOT = "snapshot";
    const QUALITY_DERIVED = "derived";
    const SOURCE_ACTIVITY = "activity";
    const SOURCE_ACTIVITY_MONITOR = "activity_monitor";
    const SOURCE_SENSOR = "sensor";
    const SOURCE_USER_PROFILE = "user_profile";
    const SOURCE_SENSOR_HISTORY = "sensor_history";
    const HEALTH_DISCONNECTED = "disconnected";
    const HEALTH_CONNECTING = "connecting";
    const HEALTH_CONNECTED = "connected";
    const HEALTH_DEGRADED = "degraded";
    const HEALTH_ERROR = "error";
    const DIAGNOSTIC_PHONE_UNREACHABLE = "phone_unreachable";
    const DIAGNOSTIC_BATCH_REJECTED = "batch_rejected";
    const DIAGNOSTIC_STORAGE_FULL = "storage_full";
    const DIAGNOSTIC_SENSOR_UNAVAILABLE = "sensor_unavailable";
    const DIAGNOSTIC_PERMISSION_MISSING = "permission_missing";

    const LIVE_METRICS = [
        "heart_rate_bpm",
        "stress_score",
        "respiration_rate_bpm",
        "spo2_percent",
        "activity_timer_state",
        "activity_elapsed_time_s",
        "activity_elapsed_distance_m",
        "activity_current_speed_mps",
        "activity_current_cadence_rpm"
    ];

    const CONDITIONAL_METRICS = [
        "temperature_c",
        "pressure_pa",
        "heading_deg",
        "power_w"
    ];

    const SNAPSHOT_METRICS = [
        "steps",
        "step_goal",
        "calories_kcal",
        "distance_m",
        "floors_climbed",
        "floors_descended",
        "move_bar_level",
        "time_to_recovery_h",
        "resting_heart_rate_bpm",
        "average_resting_heart_rate_bpm",
        "vo2max_running",
        "vo2max_cycling",
        "body_battery_percent"
    ];

    function getSupportedMetrics() {
        var supportedMetrics = [];

        for (var liveIndex = 0; liveIndex < LIVE_METRICS.size(); liveIndex += 1) {
            supportedMetrics.add(LIVE_METRICS[liveIndex]);
        }

        for (var conditionalIndex = 0; conditionalIndex < CONDITIONAL_METRICS.size(); conditionalIndex += 1) {
            supportedMetrics.add(CONDITIONAL_METRICS[conditionalIndex]);
        }

        for (var snapshotIndex = 0; snapshotIndex < SNAPSHOT_METRICS.size(); snapshotIndex += 1) {
            supportedMetrics.add(SNAPSHOT_METRICS[snapshotIndex]);
        }

        return supportedMetrics;
    }

    function buildBatchId(sequence) {
        return buildScopedId("batch", sequence);
    }

    function buildSnapshotId(snapshotType, sequence) {
        return buildScopedId(snapshotType, sequence);
    }

    function buildSampleId(sequence) {
        return buildScopedId("sample", sequence);
    }

    function buildUtcTimestamp() {
        var now = Time.now();
        var info = Gregorian.utcInfo(now, Time.FORMAT_SHORT);

        return info.year.format("%.0f")
            + "-" + padTwoDigits(info.month)
            + "-" + padTwoDigits(info.day)
            + "T" + padTwoDigits(info.hour)
            + ":" + padTwoDigits(info.min)
            + ":" + padTwoDigits(info.sec)
            + "Z";
    }

    function getTimezoneOffsetMinutes() {
        var clock = System.getClockTime();
        return (clock.timeZoneOffset + clock.dst) / 60;
    }

    function buildFirmwareVersionString() {
        var settings = System.getDeviceSettings();
        var firmwareVersion = settings.firmwareVersion;

        if (firmwareVersion != null && firmwareVersion.size() >= 2) {
            return firmwareVersion[0].format("%.0f") + "." + padTwoDigits(firmwareVersion[1]);
        }

        return "firmware-pending";
    }

    function buildScopedId(scope, sequence) {
        var nowValue = Time.now().value();

        return DEVICE_ID
            + "-" + scope
            + "-" + nowValue.format("%.0f")
            + "-" + sequence.format("%.0f");
    }

    function padTwoDigits(value) {
        return (value < 10 ? "0" : "") + value.format("%.0f");
    }
}

class MetricRecord {
    var sampleId;
    var recordedAt;
    var metricKey;
    var metricValue;
    var metricUnit;
    var sourceDomain;
    var quality;

    function initialize(sampleId, recordedAt, metricKey, metricValue, metricUnit, sourceDomain, quality) {
        self.sampleId = sampleId;
        self.recordedAt = recordedAt;
        self.metricKey = metricKey;
        self.metricValue = metricValue;
        self.metricUnit = metricUnit;
        self.sourceDomain = sourceDomain;
        self.quality = quality;
    }

    function toMessage() {
        return {
            "messageType" => "metric_sample",
            "sampleId" => self.sampleId,
            "recordedAt" => self.recordedAt,
            "metricKey" => self.metricKey,
            "metricValue" => self.metricValue,
            "metricUnit" => self.metricUnit,
            "sourceDomain" => self.sourceDomain,
            "quality" => self.quality
        };
    }
}

class SnapshotRecord {
    var snapshotId;
    var snapshotType;
    var recordedAt;
    var items;

    function initialize(snapshotId, snapshotType, recordedAt, items) {
        self.snapshotId = snapshotId;
        self.snapshotType = snapshotType;
        self.recordedAt = recordedAt;
        self.items = items;
    }

    function toMessage() {
        var payloadItems = [];

        for (var itemIndex = 0; itemIndex < self.items.size(); itemIndex += 1) {
            payloadItems.add(self.items[itemIndex].toMessage());
        }

        return {
            "messageType" => "snapshot",
            "snapshotId" => self.snapshotId,
            "snapshotType" => self.snapshotType,
            "recordedAt" => self.recordedAt,
            "items" => payloadItems
        };
    }
}

class BatchEnvelopeRecord {
    var batchId;
    var sequence;
    var createdAt;
    var lastSampleId;
    var items;

    function initialize(batchId, sequence, createdAt, lastSampleId, items) {
        self.batchId = batchId;
        self.sequence = sequence;
        self.createdAt = createdAt;
        self.lastSampleId = lastSampleId;
        self.items = items;
    }

    function toMessage() {
        var payloadItems = [];

        for (var itemIndex = 0; itemIndex < self.items.size(); itemIndex += 1) {
            payloadItems.add(self.items[itemIndex].toMessage());
        }

        return {
            "messageType" => "batch_envelope",
            "batchId" => self.batchId,
            "sequence" => self.sequence,
            "createdAt" => self.createdAt,
            "lastSampleId" => self.lastSampleId,
            "items" => payloadItems
        };
    }
}
