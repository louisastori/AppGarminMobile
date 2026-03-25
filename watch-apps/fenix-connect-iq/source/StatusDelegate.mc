using Toybox.WatchUi;

class StatusDelegate extends WatchUi.BehaviorDelegate {
    var mCollector;
    var mLinkService;
    var mView;

    function initialize(collector, linkService, view) {
        BehaviorDelegate.initialize();
        mCollector = collector;
        mLinkService = linkService;
        mView = view;
    }

    function onSelect() {
        mLinkService.captureAndSyncNow("watch-select");
        mView.refresh();
        return true;
    }

    function onMenu() {
        mLinkService.requestSyncNow("watch-menu");
        mView.refresh();
        return true;
    }

    function onBack() {
        return false;
    }
}
