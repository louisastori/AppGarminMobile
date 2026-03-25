module GarminContract {
    const PROTOCOL_VERSION = 1;
    const DEVICE_KIND = "fenix";
    const DEVICE_MODEL = "fenix 7 Pro";
    const APP_VERSION = "0.1.0-alpha";
    const SNAPSHOT_DAILY = "daily";
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

        for (var snapshotIndex = 0; snapshotIndex < SNAPSHOT_METRICS.size(); snapshotIndex += 1) {
            supportedMetrics.add(SNAPSHOT_METRICS[snapshotIndex]);
        }

        return supportedMetrics;
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
