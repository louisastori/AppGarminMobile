using Toybox.Application;

class NouvelleFenixApp extends Application.AppBase {
    var mBatchQueue;
    var mCollector;
    var mLinkService;

    function initialize() {
        AppBase.initialize();
        mBatchQueue = new BatchQueue();
        mCollector = new MetricCollector(mBatchQueue);
        mLinkService = new WatchLinkService(mBatchQueue, mCollector);
        registerBackgroundBridgeEvents();
        mLinkService.start();
    }

    function getInitialView() {
        var view = new StatusView(mCollector, mLinkService);
        var delegate = new StatusDelegate(mCollector, mLinkService, view);
        return [view, delegate];
    }

    function getServiceDelegate() {
        return [new NouvelleFenixBackgroundServiceDelegate()];
    }
}

function getApp() {
    return Application.getApp();
}
