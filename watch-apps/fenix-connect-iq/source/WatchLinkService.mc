using Toybox.Communications;
using Toybox.Lang;
using Toybox.System;

class WatchLinkService {
    var mBatchQueue;
    var mCollector;
    var mLastSyncAt;
    var mLinkState;
    var mLastErrorCode;
    var mLastBatchId;
    var mHandshakeSent;
    var mPhoneReachable;

    function initialize(batchQueue, collector) {
        mBatchQueue = batchQueue;
        mCollector = collector;
        mLastSyncAt = "jamais";
        mLinkState = GarminContract.HEALTH_DISCONNECTED;
        mLastErrorCode = null;
        mLastBatchId = null;
        mHandshakeSent = false;
        mPhoneReachable = false;
    }

    function start() {
        Communications.registerForPhoneAppMessages(method(:onPhoneAppMessage));
        mLinkState = GarminContract.HEALTH_CONNECTING;
        emitHandshake();
    }

    function captureAndSyncNow(reason) {
        var batch = mCollector.captureBatch();
        queueBatch(batch);
        transmitNextPendingBatch(reason);
        return batch;
    }

    function queueBatch(batch) {
        mBatchQueue.enqueue(batch);
        mLinkState = GarminContract.HEALTH_DEGRADED;
        mLastBatchId = batch.batchId;
        mLastSyncAt = batch.createdAt;
    }

    function acknowledgeLastQueuedBatch() {
        var pendingBatch = mBatchQueue.peek();
        if (pendingBatch == null) {
            return;
        }

        mBatchQueue.acknowledge(pendingBatch.batchId);
        mLastBatchId = pendingBatch.batchId;
        mLastSyncAt = buildTimestamp();
        mLinkState = GarminContract.HEALTH_CONNECTED;
        mLastErrorCode = null;
    }

    function requestSyncNow(reason) {
        emitHandshake();

        if (mBatchQueue.getPendingCount() == 0) {
            captureAndSyncNow(reason);
            return;
        }

        transmitNextPendingBatch(reason);
    }

    function getStatusLine() {
        return mLinkState + " | pending " + mBatchQueue.getPendingCount();
    }

    function getDisplayLines() {
        var lines = [
            "LIEN",
            "Etat " + mLinkState,
            "Phone " + (mPhoneReachable ? "ok" : "off"),
            "Queue " + mBatchQueue.getPendingCount(),
            "Sync " + mLastSyncAt
        ];

        if (mLastErrorCode != null) {
            lines.add("Err " + compactErrorCode(mLastErrorCode));
        }

        return lines;
    }

    function getLastSyncAt() {
        return mLastSyncAt;
    }

    function onPhoneAppMessage(msg as Communications.PhoneAppMessage) as Void {
        var payload = normalizePhonePayload(msg.data);
        if (payload == null) {
            emitSyncDiagnostic(
                GarminContract.DIAGNOSTIC_BATCH_REJECTED,
                "Payload telephone non reconnu.",
                null
            );
            return;
        }

        var messageType = payload["messageType"];
        if (messageType == null) {
            emitSyncDiagnostic(
                GarminContract.DIAGNOSTIC_BATCH_REJECTED,
                "messageType absent dans le payload telephone.",
                null
            );
            return;
        }

        if (messageType == "sync_request") {
            requestSyncNow("phone-request");
            return;
        }

        if (messageType == "batch_ack") {
            handleBatchAck(payload);
            return;
        }

        emitSyncDiagnostic(
            GarminContract.DIAGNOSTIC_BATCH_REJECTED,
            "messageType inconnu: " + messageType,
            null
        );
    }

    function handleBatchAck(payload) {
        var batchId = payload["batchId"];
        if (batchId == null) {
            emitSyncDiagnostic(
                GarminContract.DIAGNOSTIC_BATCH_REJECTED,
                "batchId absent dans batch_ack.",
                null
            );
            return;
        }

        mBatchQueue.acknowledge(batchId);
        mLastBatchId = batchId;
        mLastSyncAt = payload.hasKey("acknowledgedAt") ? payload["acknowledgedAt"] : buildTimestamp();
        mLastErrorCode = null;
        mPhoneReachable = true;
        mLinkState = GarminContract.HEALTH_CONNECTED;
        transmitMessage(buildLinkStatusMessage(), null);

        if (mBatchQueue.getPendingCount() > 0) {
            transmitNextPendingBatch("post-ack");
        }
    }

    function transmitNextPendingBatch(reason) {
        var pendingBatch = mBatchQueue.peek();
        if (pendingBatch == null) {
            transmitMessage(buildLinkStatusMessage(), null);
            return;
        }

        mLinkState = GarminContract.HEALTH_CONNECTING;
        mLastErrorCode = null;
        transmitMessage(pendingBatch.toMessage(), pendingBatch.batchId);
    }

    function emitHandshake() {
        transmitMessage(buildDeviceHelloMessage(), null);
        transmitMessage(buildDeviceCapabilitiesMessage(), null);
        mHandshakeSent = true;
    }

    function onTransmitSuccess(messageType, batchId) {
        mPhoneReachable = true;
        mLinkState = GarminContract.HEALTH_CONNECTED;
        mLastErrorCode = null;

        if (batchId != null) {
            mLastBatchId = batchId;
            mLastSyncAt = buildTimestamp();
        }

        if (messageType == "batch_envelope" || messageType == "device_capabilities") {
            transmitMessage(buildLinkStatusMessage(), null);
        }
    }

    function onTransmitError(messageType, batchId) {
        mPhoneReachable = false;
        mLinkState = GarminContract.HEALTH_ERROR;
        mLastErrorCode = GarminContract.DIAGNOSTIC_PHONE_UNREACHABLE;

        if (batchId != null) {
            mLastBatchId = batchId;
        }
    }

    function transmitMessage(payload, batchId) {
        var messageType = payload["messageType"];
        var listener = new WatchTransmitListener(self, messageType, batchId);
        Communications.transmit(payload, null, listener);
    }

    function buildDeviceHelloMessage() {
        return {
            "messageType" => "device_hello",
            "deviceId" => "fenix7pro-ciq",
            "deviceKind" => GarminContract.DEVICE_KIND,
            "deviceModel" => GarminContract.DEVICE_MODEL,
            "firmwareVersion" => "watch-runtime-pending",
            "appVersion" => GarminContract.APP_VERSION,
            "timezoneOffsetMinutes" => 60
        };
    }

    function buildDeviceCapabilitiesMessage() {
        return {
            "messageType" => "device_capabilities",
            "supportedMetrics" => GarminContract.getSupportedMetrics(),
            "supportsBufferedSync" => true,
            "supportsLiveMode" => true,
            "maxBatchItems" => 24,
            "maxBufferedSamples" => 240
        };
    }

    function buildLinkStatusMessage() {
        return {
            "messageType" => "link_status",
            "recordedAt" => buildTimestamp(),
            "health" => mLinkState,
            "pendingBatchCount" => mBatchQueue.getPendingCount(),
            "lastBatchId" => mLastBatchId,
            "lastErrorCode" => mLastErrorCode
        };
    }

    function emitSyncDiagnostic(code, message, batchId) {
        if (!mHandshakeSent && !mPhoneReachable) {
            return;
        }

        transmitMessage(
            {
                "messageType" => "sync_diagnostic",
                "code" => code,
                "message" => message,
                "recordedAt" => buildTimestamp(),
                "batchId" => batchId
            },
            batchId
        );
    }

    function normalizePhonePayload(data) {
        if (data == null) {
            return null;
        }

        if (data instanceof Lang.Dictionary) {
            return data;
        }

        if (data instanceof Lang.Array && data.size() > 0) {
            var firstItem = data[0];
            if (firstItem instanceof Lang.Dictionary) {
                return firstItem;
            }
        }

        return null;
    }

    function buildTimestamp() {
        var clock = System.getClockTime();
        return padNumber(clock.hour) + ":" + padNumber(clock.min) + ":" + padNumber(clock.sec);
    }

    function padNumber(value) {
        return (value < 10 ? "0" : "") + value;
    }

    function compactErrorCode(errorCode) {
        if (errorCode == GarminContract.DIAGNOSTIC_PHONE_UNREACHABLE) {
            return "phone";
        }

        if (errorCode == GarminContract.DIAGNOSTIC_BATCH_REJECTED) {
            return "reject";
        }

        if (errorCode == GarminContract.DIAGNOSTIC_STORAGE_FULL) {
            return "storage";
        }

        if (errorCode == GarminContract.DIAGNOSTIC_SENSOR_UNAVAILABLE) {
            return "sensor";
        }

        if (errorCode == GarminContract.DIAGNOSTIC_PERMISSION_MISSING) {
            return "perm";
        }

        return errorCode;
    }
}

class WatchTransmitListener extends Communications.ConnectionListener {
    var mService;
    var mMessageType;
    var mBatchId;

    function initialize(service, messageType, batchId) {
        mService = service;
        mMessageType = messageType;
        mBatchId = batchId;
    }

    function onComplete() {
        mService.onTransmitSuccess(mMessageType, mBatchId);
    }

    function onError() {
        mService.onTransmitError(mMessageType, mBatchId);
    }
}
