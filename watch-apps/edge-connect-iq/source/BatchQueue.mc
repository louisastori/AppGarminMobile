using Toybox.Application;
using Toybox.Lang;

const BATCH_QUEUE_ITEMS_STORAGE_KEY = "batch_queue.items";
const BATCH_QUEUE_SEQUENCE_STORAGE_KEY = "batch_queue.sequence";
const BATCH_QUEUE_LAST_ACK_STORAGE_KEY = "batch_queue.last_ack_batch_id";

class BatchQueue {
    var mItems;
    var mSequence;
    var mLastAckBatchId;

    function initialize() {
        mItems = [];
        mSequence = 0;
        mLastAckBatchId = null;
        loadState();
    }

    function nextSequence() {
        mSequence += 1;
        return mSequence;
    }

    function enqueue(batch) {
        mItems.add(batch);
        persistState();
    }

    function acknowledge(batchId) {
        mLastAckBatchId = batchId;
        for (var itemIndex = 0; itemIndex < mItems.size(); itemIndex += 1) {
            if (mItems[itemIndex].batchId == batchId) {
                mItems.remove(itemIndex);
                persistState();
                return;
            }
        }

        persistState();
    }

    function clear() {
        mItems = [];
        persistState();
    }

    function getPendingCount() {
        return mItems.size();
    }

    function peek() {
        if (mItems.size() == 0) {
            return null;
        }

        return mItems[0];
    }

    function getLastAckBatchId() {
        return mLastAckBatchId;
    }

    function loadState() {
        var storedSequence = Application.Storage.getValue(BATCH_QUEUE_SEQUENCE_STORAGE_KEY);
        if (storedSequence != null) {
            mSequence = storedSequence;
        }

        var storedLastAckBatchId = Application.Storage.getValue(BATCH_QUEUE_LAST_ACK_STORAGE_KEY);
        if (storedLastAckBatchId != null) {
            mLastAckBatchId = storedLastAckBatchId;
        }

        var storedItems = Application.Storage.getValue(BATCH_QUEUE_ITEMS_STORAGE_KEY);
        if (!(storedItems instanceof Lang.Array)) {
            return;
        }

        mItems = [];
        for (var itemIndex = 0; itemIndex < storedItems.size(); itemIndex += 1) {
            var restoredBatch = deserializeBatchEnvelope(storedItems[itemIndex]);
            if (restoredBatch != null) {
                mItems.add(restoredBatch);
                if (restoredBatch.sequence > mSequence) {
                    mSequence = restoredBatch.sequence;
                }
            }
        }
    }

    function persistState() {
        var serializedItems = [];

        for (var itemIndex = 0; itemIndex < mItems.size(); itemIndex += 1) {
            serializedItems.add(mItems[itemIndex].toMessage());
        }

        Application.Storage.setValue(BATCH_QUEUE_ITEMS_STORAGE_KEY, serializedItems);
        Application.Storage.setValue(BATCH_QUEUE_SEQUENCE_STORAGE_KEY, mSequence);
        Application.Storage.setValue(BATCH_QUEUE_LAST_ACK_STORAGE_KEY, mLastAckBatchId);
    }

    function deserializeBatchEnvelope(payload) {
        if (!(payload instanceof Lang.Dictionary)) {
            return null;
        }

        var itemsPayload = payload["items"];
        if (!(itemsPayload instanceof Lang.Array)) {
            return null;
        }

        var restoredItems = [];
        for (var itemIndex = 0; itemIndex < itemsPayload.size(); itemIndex += 1) {
            var restoredItem = deserializeBatchItem(itemsPayload[itemIndex]);
            if (restoredItem != null) {
                restoredItems.add(restoredItem);
            }
        }

        return new BatchEnvelopeRecord(
            payload["batchId"],
            payload["sequence"],
            payload["createdAt"],
            payload.hasKey("lastSampleId") ? payload["lastSampleId"] : null,
            restoredItems
        );
    }

    function deserializeBatchItem(payload) {
        if (!(payload instanceof Lang.Dictionary)) {
            return null;
        }

        var messageType = payload["messageType"];
        if (messageType == "metric_sample") {
            return deserializeMetric(payload);
        }

        if (messageType == "snapshot") {
            return deserializeSnapshot(payload);
        }

        return null;
    }

    function deserializeMetric(payload) {
        return new MetricRecord(
            payload["sampleId"],
            payload["recordedAt"],
            payload["metricKey"],
            payload["metricValue"],
            payload.hasKey("metricUnit") ? payload["metricUnit"] : null,
            payload["sourceDomain"],
            payload["quality"]
        );
    }

    function deserializeSnapshot(payload) {
        var itemsPayload = payload["items"];
        if (!(itemsPayload instanceof Lang.Array)) {
            return null;
        }

        var restoredItems = [];
        for (var itemIndex = 0; itemIndex < itemsPayload.size(); itemIndex += 1) {
            var restoredMetric = deserializeMetric(itemsPayload[itemIndex]);
            if (restoredMetric != null) {
                restoredItems.add(restoredMetric);
            }
        }

        return new SnapshotRecord(
            payload["snapshotId"],
            payload["snapshotType"],
            payload["recordedAt"],
            restoredItems
        );
    }
}
