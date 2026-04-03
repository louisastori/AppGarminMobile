using Toybox.Background;
using Toybox.Communications;
using Toybox.System;
using Toybox.Time;

function registerBackgroundBridgeEvents() {
    if (!Background.getPhoneAppMessageEventRegistered()) {
        Background.registerForPhoneAppMessageEvent();
    }

    if (!Background.getActivityCompletedEventRegistered()) {
        Background.registerForActivityCompletedEvent();
    }

    if (Background.getTemporalEventRegisteredTime() == null) {
        Background.registerForTemporalEvent(
            new Time.Duration(GarminContract.IDLE_BACKGROUND_SYNC_INTERVAL_SECONDS)
        );
    }
}

function createBackgroundLinkService() {
    var batchQueue = new BatchQueue();
    var collector = new MetricCollector(batchQueue);
    var linkService = new WatchLinkService(batchQueue, collector);
    linkService.enableBackgroundExit();
    return linkService;
}

(:background)
class NouvelleEdgeBackgroundServiceDelegate extends System.ServiceDelegate {
    function initialize() {
        System.ServiceDelegate.initialize();
        registerBackgroundBridgeEvents();
    }

    function onTemporalEvent() {
        registerBackgroundBridgeEvents();
        var linkService = createBackgroundLinkService();
        linkService.requestSyncWithoutHandshake("background-temporal");
    }

    function onPhoneAppMessage(msg as Communications.PhoneAppMessage) {
        registerBackgroundBridgeEvents();
        var linkService = createBackgroundLinkService();
        var payload = linkService.normalizePhonePayload(msg.data);
        if (payload == null) {
            Background.exit(null);
            return;
        }

        linkService.processPhonePayload(payload, false);
    }

    function onActivityCompleted(activity) {
        registerBackgroundBridgeEvents();
        var linkService = createBackgroundLinkService();
        linkService.requestSyncWithoutHandshake("activity-completed");
    }
}
