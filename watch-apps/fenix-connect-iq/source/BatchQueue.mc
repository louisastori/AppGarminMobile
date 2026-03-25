class BatchQueue {
    var mItems;
    var mSequence;
    var mLastAckBatchId;

    function initialize() {
        mItems = [];
        mSequence = 0;
        mLastAckBatchId = null;
    }

    function nextSequence() {
        mSequence += 1;
        return mSequence;
    }

    function enqueue(batch) {
        mItems.add(batch);
    }

    function acknowledge(batchId) {
        mLastAckBatchId = batchId;
        for (var itemIndex = 0; itemIndex < mItems.size(); itemIndex += 1) {
            if (mItems[itemIndex].batchId == batchId) {
                mItems.remove(itemIndex);
                return;
            }
        }
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
}
